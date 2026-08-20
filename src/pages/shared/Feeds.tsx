import React, { useEffect, useState } from 'react';
import { 
  Rss, 
  Users, 
  User, 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  Compass,
  MessageSquare,
  ShieldCheck,
  UserPlus,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useFeedStore } from '../../store/feedStore';
import { CreatePostCard } from '../../components/feeds/CreatePostCard';
import { PostCard } from '../../components/feeds/PostCard';
import { UserProfileModal } from '../../components/feeds/UserProfileModal';
import { NotificationsWidget } from '../../components/feeds/NotificationsWidget';
import { feedService } from '../../lib/services/feeds';
import type { AuthorProfile } from '../../lib/services/feeds';

interface FeedsProps {
  hideHeader?: boolean;
}

export const Feeds: React.FC<FeedsProps> = ({ hideHeader = false }) => {
  const { user } = useAuthStore();
  const { 
    posts, 
    userPosts,
    loading, 
    refreshing,
    hasMore,
    activeTab, 
    setActiveTab, 
    fetchPosts, 
    initRealtime, 
    cleanupRealtime 
  } = useFeedStore();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<AuthorProfile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user?.id) {
      initRealtime(user.id);
      fetchPosts(user.id, true);
      loadSuggestedUsers();
    }

    return () => {
      cleanupRealtime();
    };
  }, [user?.id]);

  const loadSuggestedUsers = async () => {
    try {
      const users = await feedService.searchUsers('a');
      const filtered = users.filter(u => u.id !== user?.id).slice(0, 5);
      setSuggestedUsers(filtered);

      if (user?.id && filtered.length > 0) {
        const map: Record<string, boolean> = {};
        for (const u of filtered) {
          map[u.id] = await feedService.checkIsFollowing(user.id, u.id);
        }
        setFollowingMap(map);
      }
    } catch (err) {
      console.warn('[Feeds] loadSuggestedUsers error:', err);
    }
  };

  const handleToggleFollow = async (followingId: string) => {
    if (!user?.id) return;
    const isFollowing = followingMap[followingId];
    if (isFollowing) {
      await feedService.unfollowUser(user.id, followingId);
      setFollowingMap(prev => ({ ...prev, [followingId]: false }));
    } else {
      await feedService.followUser(user.id, followingId);
      setFollowingMap(prev => ({ ...prev, [followingId]: true }));
    }
  };

  const handleRefresh = () => {
    if (user?.id) {
      fetchPosts(user.id, true);
    }
  };

  const displayedPosts = activeTab === 'myposts' 
    ? userPosts 
    : posts;

  return (
    <div className={hideHeader ? 'w-full' : 'min-h-screen bg-slate-50 dark:bg-[#0A0E0D] text-slate-900 dark:text-emerald-50 py-6 px-4 sm:px-6 lg:px-8'}>
      <div className={hideHeader ? 'w-full' : 'max-w-6xl mx-auto'}>
        {/* Page Header */}
        {!hideHeader && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                  <Rss size={24} />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-emerald-100 tracking-tight">
                  Community Feed
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-emerald-400/80 mt-1">
                Connect, share insights, and engage with scholars across the Trileza network
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="self-start sm:self-auto px-4 py-2 bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/40 rounded-xl text-xs font-bold text-slate-700 dark:text-emerald-200 hover:border-emerald-500 flex items-center gap-2 transition-all shadow-xs"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-500' : ''} />
              Refresh Feed
            </button>
          </div>
        )}

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Feed Column (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Create Post Component */}
            <CreatePostCard onPostCreated={() => user?.id && fetchPosts(user.id, true)} />

            {/* Feed Filter Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-emerald-900/30 pb-3 overflow-x-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'all'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-white dark:bg-[#161F1A] text-slate-600 dark:text-emerald-400 border border-slate-200 dark:border-emerald-900/30 hover:bg-slate-100 dark:hover:bg-[#1F2B24]'
                }`}
              >
                <Compass size={16} />
                Main Feed
              </button>

              <button
                onClick={() => setActiveTab('myposts')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === 'myposts'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-white dark:bg-[#161F1A] text-slate-600 dark:text-emerald-400 border border-slate-200 dark:border-emerald-900/30 hover:bg-slate-100 dark:hover:bg-[#1F2B24]'
                }`}
              >
                <User size={16} />
                My Posts ({userPosts.length})
              </button>
            </div>

            {/* Posts List */}
            {loading ? (
              <div className="py-16 text-center space-y-3">
                <Loader2 size={32} className="animate-spin text-emerald-500 mx-auto" />
                <p className="text-xs font-medium text-slate-400 dark:text-emerald-500">Loading feeds...</p>
              </div>
            ) : displayedPosts.length === 0 ? (
              /* Empty State */
              <div className="bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/30 rounded-2xl p-10 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                  <MessageSquare size={28} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-emerald-100">No posts yet</h3>
                  <p className="text-xs text-slate-500 dark:text-emerald-400/80 mt-1 max-w-sm mx-auto">
                    No posts yet. Follow users or create a post to share your thoughts with the community!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onProfileClick={(authorId) => setSelectedUserId(authorId)}
                  />
                ))}

                {hasMore && (
                  <div className="pt-4 text-center">
                    <button
                      onClick={() => user?.id && fetchPosts(user.id, false)}
                      disabled={refreshing}
                      className="px-6 py-2.5 bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/40 rounded-xl text-xs font-bold text-slate-700 dark:text-emerald-200 hover:border-emerald-500 transition-all shadow-xs"
                    >
                      {refreshing ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin text-emerald-500" />
                          Loading more...
                        </span>
                      ) : (
                        'Load More Posts'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Widgets Sidebar Column (1 col) */}
          <div className="space-y-6">
            {/* User Mini Profile Box */}
            <div className="bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/30 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3.5">
                <img
                  src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Me'}`}
                  alt={user?.full_name || 'User'}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/20"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-emerald-100 truncate">{user?.full_name}</h3>
                    <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold capitalize truncate">
                    {user?.role || 'Member'}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-emerald-900/20 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-emerald-300">
                <span>My Created Posts</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                  {userPosts.length}
                </span>
              </div>
            </div>

            {/* Realtime Notifications Widget */}
            <NotificationsWidget onNotificationClick={(n) => n.sender_id && setSelectedUserId(n.sender_id)} />

            {/* Suggested Scholars / Follow Recommendations */}
            {suggestedUsers.length > 0 && (
              <div className="bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/30 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-emerald-900/20">
                  <TrendingUp size={16} className="text-emerald-500" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-emerald-100">Suggested Scholars</h3>
                </div>

                <div className="mt-3 space-y-3">
                  {suggestedUsers.map((su) => (
                    <div key={su.id} className="flex items-center justify-between gap-2">
                      <div
                        onClick={() => setSelectedUserId(su.id)}
                        className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={su.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${su.full_name}`}
                          alt={su.full_name}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-emerald-100 truncate">{su.full_name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-emerald-500 capitalize truncate">{su.role || 'Member'}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleFollow(su.id)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                          followingMap[su.id]
                            ? 'bg-slate-100 dark:bg-[#1F2B24] text-slate-600 dark:text-emerald-300'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                        }`}
                      >
                        <UserPlus size={12} />
                        {followingMap[su.id] ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User Profile Detail Modal */}
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      </div>
    </div>
  );
};

export default Feeds;
