import { nexus } from '../nexus';

export const communityService = {
  /**
   * Fetch latest posts with profile info
   */
  async getPosts() {
    const { data, error } = await nexus.database
      .from('posts')
      .select(`
        *,
        author:profiles(full_name, avatar_url),
        likes_count:post_likes(count),
        comments_count:post_comments(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Create a new post
   */
  async createPost(authorId: string, content: string, imageUrl?: string) {
    const { data, error } = await nexus.database
      .from('posts')
      .insert({ author_id: authorId, content, image_url: imageUrl })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Like/Unlike a post
   */
  async toggleLike(postId: string, userId: string) {
    // Check if already liked
    const { data: existingLike } = await nexus.database
      .from('post_likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingLike) {
      await nexus.database.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
      return false;
    } else {
      await nexus.database.from('post_likes').insert({ post_id: postId, user_id: userId });
      return true;
    }
  },

  /**
   * Add a comment
   */
  async addComment(postId: string, userId: string, content: string) {
    const { data, error } = await nexus.database
      .from('post_comments')
      .insert({ post_id: postId, user_id: userId, content })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
