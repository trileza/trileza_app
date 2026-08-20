import { create } from 'zustand';
import { feedService } from '../lib/services/feeds';
import type { FeedPost, FeedComment, FeedNotification, AuthorProfile } from '../lib/services/feeds';
import { nexus } from '../lib/nexus';

interface FeedState {
  posts: FeedPost[];
  userPosts: FeedPost[];
  notifications: FeedNotification[];
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  activeTab: 'all' | 'following' | 'myposts';
  currentUserId: string | null;
  realtimeSubscribed: boolean;

  // Actions
  setActiveTab: (tab: 'all' | 'following' | 'myposts') => void;
  initRealtime: (userId: string) => Promise<void>;
  fetchPosts: (userId: string, reset?: boolean) => Promise<void>;
  createPost: (params: { content: string; media_urls?: string[]; tags?: string[]; mentions?: string[] }) => Promise<FeedPost | null>;
  deletePost: (postId: string) => Promise<boolean>;
  toggleLike: (targetType: 'post' | 'comment', targetId: string, targetAuthorId?: string) => Promise<void>;
  fetchComments: (postId: string) => Promise<FeedComment[]>;
  addComment: (params: { postId: string; content: string; parentCommentId?: string; postAuthorId?: string }) => Promise<FeedComment | null>;
  deleteComment: (commentId: string, postId: string) => Promise<boolean>;
  followUser: (followingId: string) => Promise<boolean>;
  unfollowUser: (followingId: string) => Promise<boolean>;
  fetchNotifications: (userId: string) => Promise<void>;
  markNotificationRead: (notifId: string) => Promise<void>;
  cleanupRealtime: () => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  userPosts: [],
  notifications: [],
  loading: false,
  refreshing: false,
  hasMore: true,
  activeTab: 'all',
  currentUserId: null,
  realtimeSubscribed: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  initRealtime: async (userId: string) => {
    if (!userId) return;
    set({ currentUserId: userId });

    try {
      await nexus.realtime.connect();
      
      const userFeedChannel = `user_feed_${userId}`;
      await nexus.realtime.subscribe('global_feeds');
      await nexus.realtime.subscribe(userFeedChannel);

      // Listener for new posts
      nexus.realtime.on('new_post', (payload: any) => {
        if (payload?.post) {
          set((state) => {
            const exists = state.posts.some(p => p.id === payload.post.id);
            if (exists) return state;
            return { posts: [payload.post, ...state.posts] };
          });
        }
      });

      // Listener for post deletion
      nexus.realtime.on('delete_post', (payload: any) => {
        if (payload?.postId) {
          set((state) => ({
            posts: state.posts.filter(p => p.id !== payload.postId),
            userPosts: state.userPosts.filter(p => p.id !== payload.postId)
          }));
        }
      });

      // Listener for new comments
      nexus.realtime.on('new_comment', (payload: any) => {
        if (payload?.postId) {
          set((state) => ({
            posts: state.posts.map(p => {
              if (p.id === payload.postId) {
                return { ...p, comments_count: (p.comments_count || 0) + 1 };
              }
              return p;
            })
          }));
        }
      });

      // Listener for likes
      nexus.realtime.on('new_like', (payload: any) => {
        if (payload?.targetType === 'post' && payload?.targetId) {
          set((state) => ({
            posts: state.posts.map(p => {
              if (p.id === payload.targetId) {
                const isMe = payload.userId === state.currentUserId;
                return {
                  ...p,
                  likes_count: payload.likesCount,
                  is_liked: isMe ? payload.isLiked : p.is_liked
                };
              }
              return p;
            })
          }));
        }
      });

      // Listener for notifications
      nexus.realtime.on('new_notification', (payload: any) => {
        if (payload?.notification) {
          set((state) => ({
            notifications: [payload.notification, ...state.notifications]
          }));
        }
      });

      set({ realtimeSubscribed: true });
    } catch (err) {
      console.warn('[feedStore] initRealtime exception:', err);
    }
  },

  cleanupRealtime: () => {
    const { currentUserId } = get();
    try {
      nexus.realtime.unsubscribe('global_feeds');
      if (currentUserId) {
        nexus.realtime.unsubscribe(`user_feed_${currentUserId}`);
      }
      set({ realtimeSubscribed: false });
    } catch (err) {
      // Ignore
    }
  },

  fetchPosts: async (userId: string, reset = false) => {
    const { posts } = get();
    if (reset) {
      set({ loading: true, posts: [] });
    } else {
      set({ refreshing: true });
    }

    try {
      const fetchedPosts = await feedService.getFeedPosts(userId, 30, reset ? 0 : posts.length);
      
      set((state) => {
        const newPosts = reset ? fetchedPosts : [...state.posts, ...fetchedPosts];
        // Filter user's posts
        const userPosts = newPosts.filter(p => p.author_id === userId);
        return {
          posts: newPosts,
          userPosts,
          loading: false,
          refreshing: false,
          hasMore: fetchedPosts.length >= 30
        };
      });
    } catch (err) {
      console.error('[feedStore] fetchPosts error:', err);
      set({ loading: false, refreshing: false });
    }
  },

  createPost: async (params) => {
    const { currentUserId } = get();
    if (!currentUserId) return null;

    const newPost = await feedService.createPost({
      author_id: currentUserId,
      content: params.content,
      media_urls: params.media_urls,
      tags: params.tags,
      mentions: params.mentions
    });

    if (newPost) {
      set((state) => ({
        posts: [newPost, ...state.posts],
        userPosts: [newPost, ...state.userPosts]
      }));
    }

    return newPost;
  },

  deletePost: async (postId: string) => {
    const { currentUserId } = get();
    if (!currentUserId) return false;

    const success = await feedService.deletePost(postId, currentUserId);
    if (success) {
      set((state) => ({
        posts: state.posts.filter(p => p.id !== postId),
        userPosts: state.userPosts.filter(p => p.id !== postId)
      }));
    }
    return success;
  },

  toggleLike: async (targetType, targetId, targetAuthorId) => {
    const { currentUserId, posts } = get();
    if (!currentUserId) return;

    // Optimistic UI update for post like
    if (targetType === 'post') {
      set({
        posts: posts.map(p => {
          if (p.id === targetId) {
            const willLike = !p.is_liked;
            return {
              ...p,
              is_liked: willLike,
              likes_count: willLike ? p.likes_count + 1 : Math.max(0, p.likes_count - 1)
            };
          }
          return p;
        })
      });
    }

    const { isLiked, likesCount } = await feedService.toggleLike({
      user_id: currentUserId,
      target_type: targetType,
      target_id: targetId,
      target_author_id: targetAuthorId
    });

    if (targetType === 'post') {
      set((state) => ({
        posts: state.posts.map(p => {
          if (p.id === targetId) {
            return { ...p, is_liked: isLiked, likes_count: likesCount };
          }
          return p;
        })
      }));
    }
  },

  fetchComments: async (postId: string) => {
    const { currentUserId } = get();
    return await feedService.getComments(postId, currentUserId || undefined);
  },

  addComment: async (params) => {
    const { currentUserId } = get();
    if (!currentUserId) return null;

    const comment = await feedService.addComment({
      post_id: params.postId,
      author_id: currentUserId,
      content: params.content,
      parent_comment_id: params.parentCommentId,
      post_author_id: params.postAuthorId
    });

    if (comment) {
      set((state) => ({
        posts: state.posts.map(p => {
          if (p.id === params.postId) {
            return { ...p, comments_count: (p.comments_count || 0) + 1 };
          }
          return p;
        })
      }));
    }

    return comment;
  },

  deleteComment: async (commentId: string, postId: string) => {
    const { currentUserId } = get();
    if (!currentUserId) return false;

    const success = await feedService.deleteComment(commentId, currentUserId);
    if (success) {
      set((state) => ({
        posts: state.posts.map(p => {
          if (p.id === postId) {
            return { ...p, comments_count: Math.max(0, (p.comments_count || 1) - 1) };
          }
          return p;
        })
      }));
    }
    return success;
  },

  followUser: async (followingId: string) => {
    const { currentUserId } = get();
    if (!currentUserId) return false;

    return await feedService.followUser(currentUserId, followingId);
  },

  unfollowUser: async (followingId: string) => {
    const { currentUserId } = get();
    if (!currentUserId) return false;

    return await feedService.unfollowUser(currentUserId, followingId);
  },

  fetchNotifications: async (userId: string) => {
    const notifs = await feedService.getUserNotifications(userId);
    set({ notifications: notifs });
  },

  markNotificationRead: async (notifId: string) => {
    await feedService.markNotificationRead(notifId);
    set((state) => ({
      notifications: state.notifications.map(n => n.id === notifId ? { ...n, is_read: true } : n)
    }));
  }
}));
