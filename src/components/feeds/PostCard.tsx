import React, { useState } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreVertical, 
  Trash2, 
  ShieldCheck,
  Tag as TagIcon
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useFeedStore } from '../../store/feedStore';
import type { FeedPost } from '../../lib/services/feeds';
import { CommentSection } from './CommentSection';
import ReportButton from '../shared/ReportButton';

interface PostCardProps {
  post: FeedPost;
  onProfileClick?: (userId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onProfileClick }) => {
  const { user } = useAuthStore();
  const { toggleLike, deletePost } = useFeedStore();

  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isOwner = user?.id === post.author_id;

  const handleLike = () => {
    toggleLike('post', post.id, post.author_id);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      deletePost(post.id);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/feeds?post=${post.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Format content to highlight #tags and @mentions
  const renderFormattedContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\s+)/);

    return parts.map((part, idx) => {
      if (part.startsWith('#') && part.length > 1) {
        return (
          <span key={idx} className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      if (part.startsWith('@') && part.length > 1) {
        return (
          <span key={idx} className="text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={post.author?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author_id}`}
            alt={post.author?.full_name || 'User'}
            onClick={() => onProfileClick && onProfileClick(post.author_id)}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500/20 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h4
                onClick={() => onProfileClick && onProfileClick(post.author_id)}
                className="font-bold text-slate-900 dark:text-emerald-100 hover:underline cursor-pointer text-sm"
              >
                {post.author?.full_name || 'Trileza Scholar'}
              </h4>
              <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-emerald-500/70">
              <span className="capitalize">{post.author?.role || 'Member'}</span>
              <span>•</span>
              <span>{formatTimestamp(post.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Options Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1F2B24] text-slate-400 dark:text-emerald-500 transition-colors"
          >
            <MoreVertical size={18} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/50 rounded-xl shadow-xl z-20 py-1 min-w-[140px]">
              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-left font-medium transition-colors"
                >
                  <Trash2 size={14} />
                  Delete Post
                </button>
              )}
              <button
                onClick={handleShare}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-700 dark:text-emerald-200 hover:bg-slate-50 dark:hover:bg-[#1F2B24] text-left font-medium transition-colors"
              >
                <Share2 size={14} />
                Share Link
              </button>
              {/* Reporting your own post is not something anyone needs. */}
              {!isOwner && (
                <ReportButton
                  variant="menu-item"
                  targetType="post"
                  targetId={post.id}
                  targetLabel={post.content?.slice(0, 60)}
                  onReported={() => setShowMenu(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content Text */}
      <div className="mt-3.5 text-slate-800 dark:text-emerald-100 text-sm leading-relaxed whitespace-pre-wrap">
        {renderFormattedContent(post.content)}
      </div>

      {/* Tags list */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {post.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Attached Media Grid */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className={`mt-3.5 grid gap-2 rounded-2xl overflow-hidden ${
          post.media_urls.length === 1 ? 'grid-cols-1' : post.media_urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
        }`}>
          {post.media_urls.map((url, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedImage(url)}
              className="cursor-pointer overflow-hidden bg-slate-100 dark:bg-[#1F2B24] max-h-80 group relative"
            >
              <img
                src={url}
                alt="Post media"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={selectedImage}
            alt="Full view"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* Footer Action Bar */}
      <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-slate-100 dark:border-emerald-900/20 text-xs font-semibold text-slate-500 dark:text-emerald-400/80">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              post.is_liked
                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold'
                : 'hover:bg-slate-100 dark:hover:bg-[#1F2B24] hover:text-emerald-600'
            }`}
          >
            <Heart size={16} className={post.is_liked ? 'fill-current text-red-500' : ''} />
            <span>{post.likes_count || 0}</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1F2B24] hover:text-emerald-600 transition-all"
          >
            <MessageCircle size={16} />
            <span>{post.comments_count || 0} Comments</span>
          </button>
        </div>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1F2B24] hover:text-emerald-600 transition-all"
        >
          <Share2 size={16} />
          <span>{copied ? 'Copied!' : 'Share'}</span>
        </button>
      </div>

      {/* Expandable Comments Section */}
      {showComments && (
        <CommentSection
          postId={post.id}
          postAuthorId={post.author_id}
          onProfileClick={onProfileClick}
        />
      )}
    </div>
  );
};
