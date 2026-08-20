import React, { useState, useEffect } from 'react';
import { Heart, Reply, Trash2, Send, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useFeedStore } from '../../store/feedStore';
import type { FeedComment } from '../../lib/services/feeds';

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  onProfileClick?: (userId: string) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  postAuthorId,
  onProfileClick
}) => {
  const { user } = useAuthStore();
  const { fetchComments, addComment, deleteComment, toggleLike } = useFeedStore();

  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadComments = async () => {
    setLoading(true);
    try {
      const data = await fetchComments(postId);
      setComments(data);
    } catch (err) {
      console.error('[CommentSection] load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [postId]);

  const handleAddRootComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const added = await addComment({
        postId,
        content: newCommentText.trim(),
        postAuthorId
      });
      if (added) {
        setNewCommentText('');
        await loadComments();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddReply = async (parentCommentId: string) => {
    if (!replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const added = await addComment({
        postId,
        content: replyText.trim(),
        parentCommentId,
        postAuthorId
      });
      if (added) {
        setReplyText('');
        setReplyingToId(null);
        await loadComments();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const success = await deleteComment(commentId, postId);
    if (success) {
      await loadComments();
    }
  };

  const handleLikeComment = async (comment: FeedComment) => {
    await toggleLike('comment', comment.id, comment.author_id);
    await loadComments();
  };

  const renderComment = (comment: FeedComment, isNested = false) => {
    const isOwner = user?.id === comment.author_id;

    return (
      <div key={comment.id} className={`flex gap-3 text-xs ${isNested ? 'ml-8 mt-3 pl-3 border-l-2 border-slate-200 dark:border-emerald-900/40' : 'mt-4'}`}>
        <img
          src={comment.author?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.author_id}`}
          alt={comment.author?.full_name || 'User'}
          onClick={() => onProfileClick && onProfileClick(comment.author_id)}
          className="w-7 h-7 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
        />

        <div className="flex-1">
          <div className="bg-slate-100 dark:bg-[#1F2B24] rounded-2xl px-3.5 py-2.5 inline-block max-w-full">
            <div className="flex items-center gap-2">
              <span 
                onClick={() => onProfileClick && onProfileClick(comment.author_id)}
                className="font-bold text-slate-800 dark:text-emerald-100 hover:underline cursor-pointer"
              >
                {comment.author?.full_name || 'Member'}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-emerald-500/70">
                {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-slate-700 dark:text-emerald-200 mt-1 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-4 mt-1 ml-2 text-[11px] font-medium text-slate-500 dark:text-emerald-400/80">
            <button
              onClick={() => handleLikeComment(comment)}
              className={`flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-300 ${comment.is_liked ? 'text-red-500 dark:text-red-400 font-bold' : ''}`}
            >
              <Heart size={12} className={comment.is_liked ? 'fill-current' : ''} />
              <span>{comment.likes_count || 0}</span>
            </button>

            {!isNested && (
              <button
                onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
                className="flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-300"
              >
                <Reply size={12} />
                <span>Reply</span>
              </button>
            )}

            {isOwner && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Inline Reply Box */}
          {replyingToId === comment.id && (
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddReply(comment.id))}
                placeholder={`Reply to ${comment.author?.full_name}...`}
                className="flex-1 bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/50 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={() => handleAddReply(comment.id)}
                disabled={isSubmitting || !replyText.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all"
              >
                Reply
              </button>
            </div>
          )}

          {/* Nested Replies */}
          {comment.replies && comment.replies.map(reply => renderComment(reply, true))}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-emerald-900/20">
      {/* Root comment input */}
      <form onSubmit={handleAddRootComment} className="flex items-center gap-3">
        <img
          src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Me'}`}
          alt={user?.full_name || 'User'}
          className="w-8 h-8 rounded-full object-cover shrink-0"
        />
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 bg-slate-50 dark:bg-[#1F2B24] border border-slate-200 dark:border-emerald-900/40 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            disabled={isSubmitting || !newCommentText.trim()}
            className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl transition-all"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </form>

      {/* Comment List */}
      {loading ? (
        <div className="py-4 text-center text-xs text-slate-400 dark:text-emerald-500/70">
          Loading comments...
        </div>
      ) : comments.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400 dark:text-emerald-500/60 italic text-center py-2">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-1">
          {comments.map(c => renderComment(c))}
        </div>
      )}
    </div>
  );
};
