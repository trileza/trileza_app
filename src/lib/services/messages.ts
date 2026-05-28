import { nexus } from '../nexus';

export const messageService = {
  /**
   * Fetch conversations (latest message from each unique chat partner)
   */
  async getConversations(userId: string) {
    const { data, error } = await nexus.database
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Fetch messages between two users
   */
  async getMessages(userId: string, partnerId: string) {
    const { data, error } = await nexus.database
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Send a message
   */
  async sendMessage(senderId: string, receiverId: string, content: string) {
    const { data, error } = await nexus.database
      .from('messages')
      .insert({ sender_id: senderId, receiver_id: receiverId, content })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
