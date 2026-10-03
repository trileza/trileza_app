/**
 * Cloudflare RealtimeKit Messaging Service — Production Infrastructure
 * ────────────────────────────────────────────────────────────────────────
 * Implements RealtimeKit chat, attachments (images/files via Cloudflare CDN),
 * group rooms, pinned messages, read receipts, message editing, deletion,
 * and 1-on-1 / group audio and video calls.
 */
import { nexus, errorMessage } from '../nexus';
import { executeWithAutoRefresh } from '../../utils/authHelper';

export interface RealtimeKitMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string | null;
  receiver_id?: string | null; // For 1-on-1 DM
  group_id?: string | null;   // For Group Chat
  content: string;
  type: 'text' | 'image' | 'file';
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  is_pinned?: boolean;
  is_edited?: boolean;
  created_at: string;
  read_at?: string | null;
}

export interface GroupChat {
  id: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
  members_count: number;
  lastMessage?: RealtimeKitMessage | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

// Local persistent cache keys for groups & pinned messages when offline or testing
const GROUPS_STORAGE_KEY = 'trileza_rtk_groups';
const PINNED_STORAGE_KEY = 'trileza_rtk_pinned';
const MESSAGES_STORAGE_KEY = 'trileza_rtk_messages';

function getStoredArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredArray<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn('[RealtimeKit] Storage write error:', err);
  }
}

/**
 * One rtk_groups row as the UI's GroupChat shape.
 *
 * description and is_private live in metadata because the table has no column
 * for either; keeping the mapping in one place stops the two drifting.
 */
function rowToGroup(row: any): GroupChat {
  const raw = row.members;
  const members: string[] = Array.isArray(raw) ? raw : raw ? Object.keys(raw) : [];
  const meta = row.metadata || {};

  return {
    id: row.id,
    name: row.name,
    description: meta.description ?? null,
    is_private: Boolean(meta.is_private),
    created_by: row.created_by,
    created_at: row.created_at,
    members_count: members.length
  } as GroupChat;
}

export const realtimekitMessagingService = {
  /**
   * Upload attachment (image or document) to Cloudflare / InsForge CDN Storage
   */
  async uploadAttachment(file: File): Promise<{ url: string; name: string; size: number }> {
    try {
      const bucketName = 'chat-attachments';
      const ext = file.name.split('.').pop() || 'file';
      const fileName = `attach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

      const { data, error } = await executeWithAutoRefresh(() =>
        nexus.storage.from(bucketName).upload(fileName, file)
      );
      let publicUrl = '';
      if (!error) {
        const res = nexus.storage.from(bucketName).getPublicUrl(fileName);
        publicUrl = typeof res === 'string' ? res : (res as any)?.data?.publicUrl || '';
      }
      
      return {
        url: publicUrl || URL.createObjectURL(file),
        name: file.name,
        size: file.size,
      };
    } catch (err) {
      console.warn('[RealtimeKit] Storage upload fallback to object URL:', err);
      return {
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
      };
    }
  },

  /**
   * Send Text Message via RealtimeKit Chat System
   */
  async sendTextMessage(
    senderId: string,
    senderName: string,
    senderAvatar: string | null,
    targetId: string,
    content: string,
    isGroup = false
  ): Promise<RealtimeKitMessage> {
    const message: RealtimeKitMessage = {
      id: `rtk-msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      sender_id: senderId,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      receiver_id: isGroup ? null : targetId,
      group_id: isGroup ? targetId : null,
      content: content.trim(),
      type: 'text',
      is_pinned: false,
      is_edited: false,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    // Save to Database / Storage
    await this.persistMessage(message);

    // Notify Realtime Channel
    const channel = isGroup ? `group:${targetId}` : `dm:${targetId}`;
    nexus.realtime.publish(channel, 'new_rtk_message', message).catch(() => {});

    return message;
  },

  /**
   * Send Image Message with preview via RealtimeKit Chat System
   */
  async sendImageMessage(
    senderId: string,
    senderName: string,
    senderAvatar: string | null,
    targetId: string,
    imageUrl: string,
    imageName: string,
    isGroup = false
  ): Promise<RealtimeKitMessage> {
    const message: RealtimeKitMessage = {
      id: `rtk-img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      sender_id: senderId,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      receiver_id: isGroup ? null : targetId,
      group_id: isGroup ? targetId : null,
      content: imageName || 'Sent an image',
      type: 'image',
      attachment_url: imageUrl,
      attachment_name: imageName,
      is_pinned: false,
      is_edited: false,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    await this.persistMessage(message);
    const channel = isGroup ? `group:${targetId}` : `dm:${targetId}`;
    nexus.realtime.publish(channel, 'new_rtk_message', message).catch(() => {});

    return message;
  },

  /**
   * Send File Attachment Message via RealtimeKit Chat System
   */
  async sendFileMessage(
    senderId: string,
    senderName: string,
    senderAvatar: string | null,
    targetId: string,
    fileUrl: string,
    fileName: string,
    fileSize: number,
    isGroup = false
  ): Promise<RealtimeKitMessage> {
    const message: RealtimeKitMessage = {
      id: `rtk-file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      sender_id: senderId,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      receiver_id: isGroup ? null : targetId,
      group_id: isGroup ? targetId : null,
      content: fileName || 'Sent a file attachment',
      type: 'file',
      attachment_url: fileUrl,
      attachment_name: fileName,
      attachment_size: fileSize,
      is_pinned: false,
      is_edited: false,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    await this.persistMessage(message);
    const channel = isGroup ? `group:${targetId}` : `dm:${targetId}`;
    nexus.realtime.publish(channel, 'new_rtk_message', message).catch(() => {});

    return message;
  },

  /**
   * Fetch Public / Private Message History with Pagination
   */
  async fetchMessages(
    userId: string,
    targetId: string,
    isGroup = false,
    limit = 50,
    beforeId?: string
  ): Promise<{ messages: RealtimeKitMessage[]; hasMore: boolean }> {
    let allMsgs: RealtimeKitMessage[] = [];

    try {
      // 1. Try fetching from Database
      if (isGroup) {
        const { data } = await nexus.database
          .from('rtk_messages')
          .select('*')
          .eq('group_id', targetId)
          .order('created_at', { ascending: false })
          .limit(limit + 1);

        if (data && data.length > 0) {
          allMsgs = data;
        }
      } else {
        const { data } = await nexus.database
          .from('rtk_messages')
          .select('*')
          .or(`and(sender_id.eq.${userId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${userId})`)
          .order('created_at', { ascending: false })
          .limit(limit + 1);

        if (data && data.length > 0) {
          allMsgs = data;
        }
      }
    } catch {
      // Database table not available yet, fall back to local persistent storage
    }

    if (allMsgs.length === 0) {
      const stored = getStoredArray<RealtimeKitMessage>(MESSAGES_STORAGE_KEY);
      allMsgs = stored.filter(m => {
        if (isGroup) return m.group_id === targetId;
        return (m.sender_id === userId && m.receiver_id === targetId) ||
               (m.sender_id === targetId && m.receiver_id === userId);
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const hasMore = allMsgs.length > limit;
    const paginated = hasMore ? allMsgs.slice(0, limit) : allMsgs;

    return {
      messages: paginated.reverse(), // Ascending order for chat UI
      hasMore,
    };
  },

  /**
   * Pin a message using meeting.chat.pin
   */
  async pinMessage(messageId: string): Promise<boolean> {
    try {
      await nexus.database
        .from('rtk_messages')
        .update({ is_pinned: true })
        .eq('id', messageId);
    } catch {}

    const stored = getStoredArray<RealtimeKitMessage>(MESSAGES_STORAGE_KEY);
    const updated = stored.map(m => m.id === messageId ? { ...m, is_pinned: true } : m);
    setStoredArray(MESSAGES_STORAGE_KEY, updated);

    // Save to pinned list
    const pinned = getStoredArray<string>(PINNED_STORAGE_KEY);
    if (!pinned.includes(messageId)) {
      setStoredArray(PINNED_STORAGE_KEY, [...pinned, messageId]);
    }
    return true;
  },

  /**
   * Unpin a message using meeting.chat.unpin
   */
  async unpinMessage(messageId: string): Promise<boolean> {
    try {
      await nexus.database
        .from('rtk_messages')
        .update({ is_pinned: false })
        .eq('id', messageId);
    } catch {}

    const stored = getStoredArray<RealtimeKitMessage>(MESSAGES_STORAGE_KEY);
    const updated = stored.map(m => m.id === messageId ? { ...m, is_pinned: false } : m);
    setStoredArray(MESSAGES_STORAGE_KEY, updated);

    const pinned = getStoredArray<string>(PINNED_STORAGE_KEY);
    setStoredArray(PINNED_STORAGE_KEY, pinned.filter(id => id !== messageId));
    return true;
  },

  /**
   * Edit a message using meeting.chat.editMessage
   */
  async editMessage(messageId: string, newContent: string): Promise<boolean> {
    try {
      await nexus.database
        .from('rtk_messages')
        .update({ content: newContent, is_edited: true })
        .eq('id', messageId);
    } catch {}

    const stored = getStoredArray<RealtimeKitMessage>(MESSAGES_STORAGE_KEY);
    const updated = stored.map(m => m.id === messageId ? { ...m, content: newContent, is_edited: true } : m);
    setStoredArray(MESSAGES_STORAGE_KEY, updated);
    return true;
  },

  /**
   * Delete a message using meeting.chat.deleteMessage
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      await nexus.database
        .from('rtk_messages')
        .delete()
        .eq('id', messageId);
    } catch {}

    const stored = getStoredArray<RealtimeKitMessage>(MESSAGES_STORAGE_KEY);
    const updated = stored.filter(m => m.id !== messageId);
    setStoredArray(MESSAGES_STORAGE_KEY, updated);
    return true;
  },

  /**
   * Create a new Group Chat or Study Channel
   */
  async createGroupChat(
    createdByUserId: string,
    createdByName: string,
    createdByAvatar: string | null,
    name: string,
    description: string,
    isPrivate: boolean,
    initialMemberIds: string[]
  ): Promise<GroupChat> {
    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // The creator is always a member. Without this they would create a group
    // and immediately fail the RLS read policy on it.
    const members = Array.from(new Set([createdByUserId, ...initialMemberIds]));

    // description and is_private are not columns on rtk_groups; they live in
    // metadata. The previous version passed them as columns inside a bare
    // try/catch, so every insert failed and was swallowed.
    const { data, error } = await nexus.database
      .from('rtk_groups')
      .insert([{
        id: groupId,
        name: name.trim(),
        created_by: createdByUserId,
        members,
        metadata: {
          description: description.trim() || null,
          is_private: isPrivate,
          created_by_name: createdByName,
          created_by_avatar: createdByAvatar
        }
      }])
      .select()
      .single();

    if (error) throw new Error(errorMessage(error, 'Could not create that group.'));

    return rowToGroup(data);
  },

  /**
   * Fetch all Group Chats for user
   */
  async getGroupChats(userId: string): Promise<GroupChat[]> {
    // From the database, not localStorage.
    //
    // This used to read a browser key and, when it was empty, invent sample
    // groups — "Front-End Mastery Cohort" and friends — and hand them back as
    // though they were real. Every user saw groups nobody had created,
    // messages sent to them reached no one, and clearing site data destroyed
    // the lot. rtk_groups existed the whole time.
    const { data, error } = await nexus.database
      .from('rtk_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Groups] Could not load groups:', error);
      return [];
    }

    // RLS already limits this to groups the caller created or belongs to; the
    // filter is belt and braces for an admin session, which sees everything.
    return (data ?? [])
      .filter((g: any) => {
        const m = g.members;
        const list = Array.isArray(m) ? m : m ? Object.keys(m) : [];
        return list.includes(userId) || g.created_by === userId;
      })
      .map(rowToGroup);
  },

  /**
   * Get Group Members
   */
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await nexus.database
      .from('rtk_groups')
      .select('id, created_by, members, created_at')
      .eq('id', groupId)
      .maybeSingle();

    if (error || !data) return [];

    const raw = (data as any).members;
    const ids: string[] = Array.isArray(raw) ? raw : raw ? Object.keys(raw) : [];
    if (ids.length === 0) return [];

    // Real names, rather than the "Member (abc123)" placeholder the previous
    // version stored — it never had anything but an id to work from.
    const { data: profiles } = await nexus.database
      .from('public_profiles')
      .select('id, full_name, avatar_url')
      .in('id', ids);

    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return ids.map(id => {
      const profile = byId.get(id);
      return {
        id: `gm-${groupId}-${id}`,
        group_id: groupId,
        user_id: id,
        full_name: profile?.full_name || 'Member',
        avatar_url: profile?.avatar_url ?? null,
        role: id === (data as any).created_by ? 'owner' : 'member',
        joined_at: (data as any).created_at
      } as GroupMember;
    });
  },

  /**
   * Add Member to Group
   */
  async addGroupMember(groupId: string, user: { id: string; name: string; avatar?: string }): Promise<GroupMember> {
    const membersKey = `trileza_rtk_members_${groupId}`;
    const current = getStoredArray<GroupMember>(membersKey);
    
    const existing = current.find(m => m.user_id === user.id);
    if (existing) return existing;

    const newMember: GroupMember = {
      id: `gm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      group_id: groupId,
      user_id: user.id,
      full_name: user.name,
      avatar_url: user.avatar,
      role: 'member',
      joined_at: new Date().toISOString(),
    };

    const updated = [...current, newMember];
    setStoredArray(membersKey, updated);

    // Update group members count
    const groups = getStoredArray<GroupChat>(GROUPS_STORAGE_KEY);
    const updatedGroups = groups.map(g => g.id === groupId ? { ...g, members_count: updated.length } : g);
    setStoredArray(GROUPS_STORAGE_KEY, updatedGroups);

    return newMember;
  },

  /**
   * Remove Member from Group
   */
  async removeGroupMember(groupId: string, userId: string): Promise<boolean> {
    const membersKey = `trileza_rtk_members_${groupId}`;
    const current = getStoredArray<GroupMember>(membersKey);
    const updated = current.filter(m => m.user_id !== userId);
    setStoredArray(membersKey, updated);

    const groups = getStoredArray<GroupChat>(GROUPS_STORAGE_KEY);
    const updatedGroups = groups.map(g => g.id === groupId ? { ...g, members_count: updated.length } : g);
    setStoredArray(GROUPS_STORAGE_KEY, updatedGroups);

    return true;
  },

  /**
   * Internal helper to persist message
   */
  async persistMessage(msg: RealtimeKitMessage): Promise<void> {
    const stored = getStoredArray<RealtimeKitMessage>(MESSAGES_STORAGE_KEY);
    setStoredArray(MESSAGES_STORAGE_KEY, [msg, ...stored]);

    try {
      await nexus.database.from('rtk_messages').insert([{
        id: msg.id,
        sender_id: msg.sender_id,
        sender_name: msg.sender_name,
        receiver_id: msg.receiver_id,
        group_id: msg.group_id,
        content: msg.content,
        type: msg.type,
        attachment_url: msg.attachment_url,
        attachment_name: msg.attachment_name,
        attachment_size: msg.attachment_size,
        is_pinned: msg.is_pinned || false,
        created_at: msg.created_at,
      }]);
    } catch {}
  },
};
