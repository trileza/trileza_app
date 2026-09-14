import React, { useEffect, useState } from 'react';
import { X, UserPlus, UserCheck, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useFeedStore } from '../../store/feedStore';
import { feedService } from '../../lib/services/feeds';
import type { AuthorProfile, FeedPost } from '../../lib/services/feeds';

interface UserProfileModalProps {
  userId: string | null;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ userId, onClose }) => {
  const { user: currentUser } = useAuthStore();
  const { followUser, unfollowUser } = useFeedStore();

  const [profile, setProfile] = useState<AuthorProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const prof = await feedService.fetchAuthorProfile(userId!);
        if (isMounted) setProfile(prof);

        if (currentUser && currentUser.id !== userId) {
          const following = await feedService.checkIsFollowing(currentUser.id, userId!);
          if (isMounted) setIsFollowing(following);
        }
      } catch (err) {
        console.error('[UserProfileModal] load error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [userId, currentUser]);

  if (!userId) return null;

  const isSelf = currentUser?.id === userId;

  const handleToggleFollow = async () => {
    if (!currentUser || isSelf || actionLoading) return;

    setActionLoading(true);
    try {
      if (isFollowing) {
        const success = await unfollowUser(userId);
        if (success) setIsFollowing(false);
      } else {
        const success = await followUser(userId);
        if (success) setIsFollowing(true);
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Cover Header */}
        <div className="h-28 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/40 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-md transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Profile Card Body */}
        <div className="px-6 pb-6 pt-0 relative">
          {/* Avatar */}
          <div className="-mt-14 mb-4 flex items-end justify-between">
            <img
              src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`}
              alt={profile?.full_name || 'User'}
              className="w-24 h-24 rounded-full ring-4 ring-white dark:ring-[#161F1A] object-cover bg-white shadow-md"
            />

            {!isSelf && currentUser && (
              <button
                onClick={handleToggleFollow}
                disabled={actionLoading}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                  isFollowing
                    ? 'bg-slate-200 dark:bg-[#1F2B24] text-slate-700 dark:text-emerald-300 hover:bg-red-100 hover:text-red-600'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                }`}
              >
                {actionLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isFollowing ? (
                  <>
                    <UserCheck size={14} />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus size={14} />
                    Follow
                  </>
                )}
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-emerald-500">
              Loading profile details...
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-emerald-100">{profile?.full_name}</h3>
                <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
              </div>

              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 capitalize mt-0.5">
                {profile?.role || 'Trileza Scholar'}
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-emerald-900/30 grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 dark:bg-[#1F2B24] p-3 rounded-2xl border border-slate-100 dark:border-emerald-900/20">
                  <span className="block text-xs text-slate-400 dark:text-emerald-500 font-medium">Status</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-emerald-200">Active Scholar</span>
                </div>
                <div className="bg-slate-50 dark:bg-[#1F2B24] p-3 rounded-2xl border border-slate-100 dark:border-emerald-900/20">
                  <span className="block text-xs text-slate-400 dark:text-emerald-500 font-medium">Platform Role</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-emerald-200 capitalize">{profile?.role || 'Mentee'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
