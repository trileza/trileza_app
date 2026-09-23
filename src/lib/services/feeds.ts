import { nexus } from '../nexus';

export interface AuthorProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  role?: string;
  username?: string;
}

export interface FeedPost {
  id: string;
  author_id: string;
  content: string;
  media_urls: string[];
  tags: string[];
  created_at: string;
  updated_at?: string;
  likes_count: number;
  comments_count?: number;
  is_liked?: boolean;
  author?: AuthorProfile;
}

export interface FeedComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id?: string | null;
  content: string;
  created_at: string;
  likes_count?: number;
  is_liked?: boolean;
  author?: AuthorProfile;
  replies?: FeedComment[];
}

export interface FeedNotification {
  id: string;
  user_id: string;
  sender_id?: string;
  type: 'follow' | 'like' | 'comment' | 'mention';
  target_id?: string;
  title?: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender?: AuthorProfile;
}

// Cache profiles in memory to avoid excessive profile queries
const profileCache: Record<string, AuthorProfile> = {};

export async function fetchAuthorProfile(userId: string): Promise<AuthorProfile> {
  if (!userId) return { id: 'unknown', full_name: 'Anonymous User' };
  if (profileCache[userId]) return profileCache[userId];

  try {
    const { data } = await nexus.database
      .from('public_profiles')
      .select('id, full_name, avatar_url, role, username')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      profileCache[userId] = data as AuthorProfile;
      return profileCache[userId];
    }
  } catch (err) {
    console.warn('[Feeds] Failed to fetch profile:', err);
  }

  // Fallback profile if not in DB yet
  const fallback = {
    id: userId,
    full_name: 'Community Member',
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
    role: 'Member'
  };
  profileCache[userId] = fallback;
  return fallback;
}

export async function fetchAuthorProfilesBatch(userIds: string[]): Promise<Record<string, AuthorProfile>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const missing = uniqueIds.filter(id => !profileCache[id]);

  if (missing.length > 0) {
    try {
      const { data } = await nexus.database
        .from('public_profiles')
        .select('id, full_name, avatar_url, role, username')
        .in('id', missing);

      if (data && Array.isArray(data)) {
        data.forEach((p: any) => {
          profileCache[p.id] = p as AuthorProfile;
        });
      }
    } catch (err) {
      console.warn('[Feeds] Batch profile fetch error:', err);
    }
  }

  const result: Record<string, AuthorProfile> = {};
  uniqueIds.forEach(id => {
    result[id] = profileCache[id] || {
      id,
      full_name: 'User',
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`
    };
  });

  return result;
}

export const feedService = {
  fetchAuthorProfile,

  /**
   * Fetch feeds / posts for a user
   */
  async getFeedPosts(currentUserId: string, limit = 20, offset = 0): Promise<FeedPost[]> {
    try {
      // Query newest posts
      const { data: rawPosts, error } = await nexus.database
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error || !rawPosts) {
        console.error('[Feeds] Failed to fetch posts:', error);
        return [];
      }

      // Collect author IDs to batch fetch profiles
      const authorIds = rawPosts.map((p: any) => p.author_id);
      const postIds = rawPosts.map((p: any) => p.id);
      const profiles = await fetchAuthorProfilesBatch(authorIds);

      // Fetch user's likes on these posts
      let userLikedPostIds = new Set<string>();
      if (currentUserId && postIds.length > 0) {
        const { data: likes } = await nexus.database
          .from('likes')
          .select('target_id')
          .eq('user_id', currentUserId)
          .eq('target_type', 'post')
          .in('target_id', postIds);

        if (likes) {
          likes.forEach((l: any) => userLikedPostIds.add(l.target_id));
        }
      }

      // Fetch comments count for each post
      let commentsCountMap: Record<string, number> = {};
      if (postIds.length > 0) {
        const { data: comments } = await nexus.database
          .from('comments')
          .select('post_id');

        if (comments) {
          comments.forEach((c: any) => {
            commentsCountMap[c.post_id] = (commentsCountMap[c.post_id] || 0) + 1;
          });
        }
      }

      // Assemble enriched posts
      const enrichedPosts: FeedPost[] = rawPosts.map((p: any) => ({
        id: p.id,
        author_id: p.author_id,
        content: p.content || '',
        media_urls: p.media_urls || (p.image_url ? [p.image_url] : []),
        tags: p.tags || [],
        created_at: p.created_at,
        updated_at: p.updated_at,
        likes_count: p.likes_count || 0,
        comments_count: commentsCountMap[p.id] || 0,
        is_liked: userLikedPostIds.has(p.id),
        author: profiles[p.author_id]
      }));

      return enrichedPosts;
    } catch (err) {
      console.error('[Feeds] getFeedPosts error:', err);
      return [];
    }
  },

  /**
   * Create a new post
   */
  async createPost(params: {
    author_id: string;
    content: string;
    media_urls?: string[];
    tags?: string[];
    mentions?: string[];
  }): Promise<FeedPost | null> {
    try {
      const postId = 'post_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const newPostObj = {
        id: postId,
        author_id: params.author_id,
        content: params.content,
        media_urls: params.media_urls || [],
        tags: params.tags || [],
        likes_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await nexus.database
        .from('posts')
        .insert([newPostObj])
        .select()
        .single();

      if (error) {
        console.error('[Feeds] createPost error:', error);
        return null;
      }

      const authorProfile = await fetchAuthorProfile(params.author_id);
      const post: FeedPost = {
        id: data.id,
        author_id: data.author_id,
        content: data.content,
        media_urls: data.media_urls || params.media_urls || [],
        tags: data.tags || params.tags || [],
        created_at: data.created_at,
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
        author: authorProfile
      };

      // Broadcast new_post via RealtimeKit
      nexus.realtime.publish('global_feeds', 'new_post', { post }).catch(() => {});
      nexus.realtime.publish(`user_feed_${params.author_id}`, 'new_post', { post }).catch(() => {});

      // Create notifications for mentioned users
      if (params.mentions && params.mentions.length > 0) {
        for (const targetUserId of params.mentions) {
          if (targetUserId !== params.author_id) {
            await this.createNotification({
              user_id: targetUserId,
              sender_id: params.author_id,
              type: 'mention',
              target_id: post.id,
              title: 'New Mention',
              message: `${authorProfile.full_name} mentioned you in a post`
            });
          }
        }
      }

      return post;
    } catch (err) {
      console.error('[Feeds] createPost exception:', err);
      return null;
    }
  },

  /**
   * Update a post
   */
  async updatePost(postId: string, content: string): Promise<boolean> {
    try {
      const { error } = await nexus.database
        .from('posts')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', postId);

      if (error) {
        console.error('[Feeds] updatePost error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Feeds] updatePost exception:', err);
      return false;
    }
  },

  /**
   * Delete a post
   */
  async deletePost(postId: string, authorId: string): Promise<boolean> {
    try {
      const { error } = await nexus.database
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('author_id', authorId);

      if (error) {
        console.error('[Feeds] deletePost error:', error);
        return false;
      }

      // Also clean up associated comments and likes
      try {
        await nexus.database.from('comments').delete().eq('post_id', postId);
        await nexus.database.from('likes').delete().eq('target_type', 'post').eq('target_id', postId);
      } catch (e) {
        // Ignore background cleanup errors
      }

      // Broadcast post deletion
      nexus.realtime.publish('global_feeds', 'delete_post', { postId }).catch(() => {});
      return true;
    } catch (err) {
      console.error('[Feeds] deletePost exception:', err);
      return false;
    }
  },

  /**
   * Fetch comments for a post
   */
  async getComments(postId: string, currentUserId?: string): Promise<FeedComment[]> {
    try {
      const { data: rawComments, error } = await nexus.database
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error || !rawComments) return [];

      const authorIds = rawComments.map((c: any) => c.author_id);
      const commentIds = rawComments.map((c: any) => c.id);
      const profiles = await fetchAuthorProfilesBatch(authorIds);

      // Check comment likes
      let userLikedCommentIds = new Set<string>();
      if (currentUserId && commentIds.length > 0) {
        const { data: likes } = await nexus.database
          .from('likes')
          .select('target_id')
          .eq('user_id', currentUserId)
          .eq('target_type', 'comment')
          .in('target_id', commentIds);

        if (likes) {
          likes.forEach((l: any) => userLikedCommentIds.add(l.target_id));
        }
      }

      const commentMap: Record<string, FeedComment> = {};
      const rootComments: FeedComment[] = [];

      rawComments.forEach((c: any) => {
        const commentObj: FeedComment = {
          id: c.id,
          post_id: c.post_id,
          author_id: c.author_id,
          parent_comment_id: c.parent_comment_id || null,
          content: c.content,
          created_at: c.created_at,
          likes_count: c.likes_count || 0,
          is_liked: userLikedCommentIds.has(c.id),
          author: profiles[c.author_id],
          replies: []
        };
        commentMap[c.id] = commentObj;
      });

      // Build nested hierarchy
      rawComments.forEach((c: any) => {
        const commentObj = commentMap[c.id];
        if (c.parent_comment_id && commentMap[c.parent_comment_id]) {
          commentMap[c.parent_comment_id].replies!.push(commentObj);
        } else {
          rootComments.push(commentObj);
        }
      });

      return rootComments;
    } catch (err) {
      console.error('[Feeds] getComments error:', err);
      return [];
    }
  },

  /**
   * Add a comment
   */
  async addComment(params: {
    post_id: string;
    author_id: string;
    content: string;
    parent_comment_id?: string;
    post_author_id?: string;
  }): Promise<FeedComment | null> {
    try {
      const commentId = 'cmt_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const newCommentObj = {
        id: commentId,
        post_id: params.post_id,
        author_id: params.author_id,
        parent_comment_id: params.parent_comment_id || null,
        content: params.content,
        created_at: new Date().toISOString()
      };

      const { data, error } = await nexus.database
        .from('comments')
        .insert([newCommentObj])
        .select()
        .single();

      if (error) {
        console.error('[Feeds] addComment error:', error);
        return null;
      }

      const authorProfile = await fetchAuthorProfile(params.author_id);
      const comment: FeedComment = {
        id: data.id,
        post_id: data.post_id,
        author_id: data.author_id,
        parent_comment_id: data.parent_comment_id,
        content: data.content,
        created_at: data.created_at,
        likes_count: 0,
        is_liked: false,
        author: authorProfile,
        replies: []
      };

      // Broadcast new_comment event
      nexus.realtime.publish('global_feeds', 'new_comment', { comment, postId: params.post_id }).catch(() => {});
      nexus.realtime.publish(`user_feed_${params.post_author_id || params.author_id}`, 'new_comment', { comment, postId: params.post_id }).catch(() => {});

      // Notify post author
      if (params.post_author_id && params.post_author_id !== params.author_id) {
        await this.createNotification({
          user_id: params.post_author_id,
          sender_id: params.author_id,
          type: 'comment',
          target_id: params.post_id,
          title: 'New Comment',
          message: `${authorProfile.full_name} commented on your post`
        });
      }

      return comment;
    } catch (err) {
      console.error('[Feeds] addComment exception:', err);
      return null;
    }
  },

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string, authorId: string): Promise<boolean> {
    try {
      const { error } = await nexus.database
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('author_id', authorId);

      if (error) return false;
      return true;
    } catch (err) {
      console.error('[Feeds] deleteComment exception:', err);
      return false;
    }
  },

  /**
   * Toggle like on post or comment
   */
  async toggleLike(params: {
    user_id: string;
    target_type: 'post' | 'comment';
    target_id: string;
    target_author_id?: string;
  }): Promise<{ isLiked: boolean; likesCount: number }> {
    try {
      // Check if already liked
      const { data: existing } = await nexus.database
        .from('likes')
        .select('id')
        .eq('user_id', params.user_id)
        .eq('target_type', params.target_type)
        .eq('target_id', params.target_id)
        .maybeSingle();

      let isLiked = false;

      if (existing) {
        // Unlike
        await nexus.database
          .from('likes')
          .delete()
          .eq('id', existing.id);
        isLiked = false;
      } else {
        // Like
        await nexus.database
          .from('likes')
          .insert([{
            user_id: params.user_id,
            target_type: params.target_type,
            target_id: params.target_id,
            created_at: new Date().toISOString()
          }]);
        isLiked = true;
      }

      // Count total likes
      const { data: allLikes } = await nexus.database
        .from('likes')
        .select('id')
        .eq('target_type', params.target_type)
        .eq('target_id', params.target_id);

      const likesCount = allLikes ? allLikes.length : 0;

      // Update post likes_count if target is post
      if (params.target_type === 'post') {
        try {
          await nexus.database
            .from('posts')
            .update({ likes_count: likesCount })
            .eq('id', params.target_id);
        } catch (e) {
          // Ignore
        }
      }

      // Broadcast new_like event
      nexus.realtime.publish('global_feeds', 'new_like', {
        targetType: params.target_type,
        targetId: params.target_id,
        userId: params.user_id,
        isLiked,
        likesCount
      }).catch(() => {});

      // Notify post/comment author if liked
      if (isLiked && params.target_author_id && params.target_author_id !== params.user_id) {
        const senderProfile = await fetchAuthorProfile(params.user_id);
        await this.createNotification({
          user_id: params.target_author_id,
          sender_id: params.user_id,
          type: 'like',
          target_id: params.target_id,
          title: 'New Like',
          message: `${senderProfile.full_name} liked your ${params.target_type}`
        });
      }

      return { isLiked, likesCount };
    } catch (err) {
      console.error('[Feeds] toggleLike error:', err);
      return { isLiked: false, likesCount: 0 };
    }
  },

  /**
   * Follow user
   */
  async followUser(followerId: string, followingId: string): Promise<boolean> {
    try {
      if (followerId === followingId) return false;

      const { error } = await nexus.database
        .from('follows')
        .insert([{
          follower_id: followerId,
          following_id: followingId,
          created_at: new Date().toISOString()
        }]);

      if (error && !error.message?.includes('duplicate')) {
        console.error('[Feeds] followUser error:', error);
        return false;
      }

      const followerProfile = await fetchAuthorProfile(followerId);

      // Broadcast new_follow event
      nexus.realtime.publish('global_feeds', 'new_follow', { followerId, followingId }).catch(() => {});
      nexus.realtime.publish(`user_feed_${followingId}`, 'new_follow', { followerId, followingId }).catch(() => {});

      // Send notification
      await this.createNotification({
        user_id: followingId,
        sender_id: followerId,
        type: 'follow',
        target_id: followerId,
        title: 'New Follower',
        message: `${followerProfile.full_name} started following you`
      });

      return true;
    } catch (err) {
      console.error('[Feeds] followUser exception:', err);
      return false;
    }
  },

  /**
   * Unfollow user
   */
  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    try {
      const { error } = await nexus.database
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

      if (error) return false;
      return true;
    } catch (err) {
      console.error('[Feeds] unfollowUser exception:', err);
      return false;
    }
  },

  /**
   * Check if follower is following user
   */
  async checkIsFollowing(followerId: string, followingId: string): Promise<boolean> {
    try {
      if (!followerId || !followingId) return false;

      const { data } = await nexus.database
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();

      return !!data;
    } catch (err) {
      return false;
    }
  },

  /**
   * Create notification
   */
  async createNotification(params: {
    user_id: string;
    sender_id?: string;
    type: 'follow' | 'like' | 'comment' | 'mention';
    target_id?: string;
    title?: string;
    message: string;
  }): Promise<FeedNotification | null> {
    try {
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

      // `sender_id` and `target_id` are not columns on this table — they live
      // in `metadata`, as the library's notifications already do.
      //
      // Writing them as columns made every insert here fail with PGRST204,
      // and the `if (error) return null` below swallowed it, so no social
      // notification has ever been stored: no follow, like, comment or
      // mention. The realtime broadcast still fired, which is why anyone
      // watching at that instant saw one and nobody else ever did.
      const notifObj = {
        id: notifId,
        user_id: params.user_id,
        type: params.type,
        title: params.title || 'Notification',
        message: params.message,
        is_read: false,
        metadata: {
          sender_id: params.sender_id || null,
          target_id: params.target_id || null
        },
        created_at: new Date().toISOString()
      };

      const { data, error } = await nexus.database
        .from('notifications')
        .insert([notifObj])
        .select()
        .single();

      // Logged rather than swallowed. A silent `return null` here is what hid
      // the broken insert above for as long as it existed.
      if (error) {
        console.error('[Feeds] Could not store notification:', error);
        return null;
      }

      const senderProfile = params.sender_id ? await fetchAuthorProfile(params.sender_id) : undefined;
      const notification: FeedNotification = {
        id: data.id,
        user_id: data.user_id,
        sender_id: data.metadata?.sender_id ?? undefined,
        type: data.type,
        target_id: data.metadata?.target_id ?? undefined,
        title: data.title,
        message: data.message,
        is_read: false,
        created_at: data.created_at,
        sender: senderProfile
      };

      // Broadcast notification event
      nexus.realtime.publish(`user_feed_${params.user_id}`, 'new_notification', { notification }).catch(() => {});

      return notification;
    } catch (err) {
      console.error('[Feeds] createNotification exception:', err);
      return null;
    }
  },

  /**
   * Fetch user notifications
   */
  async getUserNotifications(userId: string): Promise<FeedNotification[]> {
    try {
      const { data, error } = await nexus.database
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error || !data) return [];

      // Read from metadata, where these are actually stored. Rows written
      // before this fix do not exist — every earlier insert failed — so there
      // is no older shape to fall back to.
      const senderIds = data
        .map((n: any) => n.metadata?.sender_id)
        .filter(Boolean);
      const senders = await fetchAuthorProfilesBatch(senderIds);

      return data.map((n: any) => {
        const senderId = n.metadata?.sender_id ?? undefined;
        return {
          id: n.id,
          user_id: n.user_id,
          sender_id: senderId,
          type: n.type || 'like',
          target_id: n.metadata?.target_id ?? undefined,
          title: n.title || 'Notification',
          message: n.message,
          is_read: !!n.is_read,
          created_at: n.created_at,
          sender: senderId ? senders[senderId] : undefined
        };
      });
    } catch (err) {
      console.error('[Feeds] getUserNotifications error:', err);
      return [];
    }
  },

  /**
   * Mark notification as read
   */
  async markNotificationRead(notifId: string): Promise<boolean> {
    try {
      // `read` is not a column; writing it failed the whole update, so
      // marking a notification read never worked either.
      const { error } = await nexus.database
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);

      if (error) {
        console.error('[Feeds] Could not mark notification read:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Feeds] Could not mark notification read:', err);
      return false;
    }
  },

  /**
   * Search users for @mention autocomplete
   */
  async searchUsers(query: string): Promise<AuthorProfile[]> {
    if (!query || query.trim().length === 0) return [];
    try {
      const { data } = await nexus.database
        .from('public_profiles')
        .select('id, full_name, avatar_url, role, username')
        .ilike('full_name', `%${query.trim()}%`)
        .limit(8);

      if (data && Array.isArray(data)) {
        return data as AuthorProfile[];
      }
      return [];
    } catch (err) {
      return [];
    }
  }
};
