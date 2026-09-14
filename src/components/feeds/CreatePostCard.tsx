import React, { useState, useRef } from 'react';
import { 
  Image, 
  Tag, 
  Send, 
  X, 
  Sparkles,
  Loader2 
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useFeedStore } from '../../store/feedStore';
import { feedService } from '../../lib/services/feeds';
import type { AuthorProfile } from '../../lib/services/feeds';

interface CreatePostCardProps {
  onPostCreated?: () => void;
}

export const CreatePostCard: React.FC<CreatePostCardProps> = ({ onPostCreated }) => {
  const { user } = useAuthStore();
  const { createPost } = useFeedStore();

  const [content, setContent] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaInputUrl, setMediaInputUrl] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);

  // Mention autocomplete
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<AuthorProfile[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<AuthorProfile[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const CHARACTER_LIMIT = 500;

  // Handle mention detection
  const handleContentChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= CHARACTER_LIMIT) {
      setContent(value);
    }

    // Check for @ mention near cursor
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@(\w*)$/);

    if (match) {
      const q = match[1];
      setMentionQuery(q);
      const results = await feedService.searchUsers(q);
      setMentionResults(results);
      setShowMentionDropdown(results.length > 0);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const selectMention = (profile: AuthorProfile) => {
    if (!textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);
    const newTextBefore = textBeforeCursor.replace(/@\w*$/, `@${profile.full_name} `);
    
    setContent(newTextBefore + textAfterCursor);
    setShowMentionDropdown(false);

    if (!mentionedUsers.some(u => u.id === profile.id)) {
      setMentionedUsers([...mentionedUsers, profile]);
    }
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    const formattedTag = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (formattedTag && !tags.includes(formattedTag)) {
      setTags([...tags, formattedTag]);
    }
    setTagInput('');
    setShowTagInput(false);
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const addMediaUrl = () => {
    if (!mediaInputUrl.trim()) return;
    setMediaUrls([...mediaUrls, mediaInputUrl.trim()]);
    setMediaInputUrl('');
    setShowMediaInput(false);
  };

  const removeMediaUrl = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert file to Data URL for instant local preview and sharing
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setMediaUrls(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaUrls.length === 0) return;

    setIsSubmitting(true);
    try {
      const mentionIds = mentionedUsers.map(u => u.id);
      await createPost({
        content: content.trim(),
        media_urls: mediaUrls,
        tags,
        mentions: mentionIds
      });

      // Reset form
      setContent('');
      setMediaUrls([]);
      setTags([]);
      setMentionedUsers([]);
      if (onPostCreated) onPostCreated();
    } catch (err) {
      console.error('[CreatePostCard] error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex gap-4">
        <img
          src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.full_name || 'Me'}`}
          alt={user?.full_name || 'User'}
          className="w-11 h-11 rounded-full ring-2 ring-emerald-500/20 object-cover shrink-0"
        />

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="Share an insight, question, or accomplishment with the Trileza community..."
            className="w-full bg-slate-50 dark:bg-[#1F2B24] text-slate-800 dark:text-emerald-100 placeholder-slate-400 dark:placeholder-emerald-500/50 rounded-xl p-3.5 border border-slate-200 dark:border-emerald-900/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none min-h-[90px] text-sm transition-all"
          />

          {/* Autocomplete mention dropdown */}
          {showMentionDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/50 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto p-1">
              {mentionResults.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => selectMention(profile)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left transition-colors"
                >
                  <img
                    src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.full_name}`}
                    alt={profile.full_name}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-emerald-100">{profile.full_name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-emerald-500">{profile.role || 'Member'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Attached Media Previews */}
          {mediaUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {mediaUrls.map((url, idx) => (
                <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-emerald-900/50 bg-slate-100 dark:bg-[#1F2B24]">
                  <img src={url} alt="Attached media" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeMediaUrl(idx)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tags list */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40"
                >
                  #{t}
                  <button type="button" onClick={() => removeTag(t)} className="hover:text-red-500">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Tag input row */}
          {showTagInput && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Type tag name..."
                className="text-xs bg-slate-50 dark:bg-[#1F2B24] border border-slate-200 dark:border-emerald-900/50 rounded-lg px-2.5 py-1 text-slate-800 dark:text-emerald-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          )}

          {/* Image URL input row */}
          {showMediaInput && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="url"
                value={mediaInputUrl}
                onChange={(e) => setMediaInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMediaUrl())}
                placeholder="Paste image URL..."
                className="flex-1 text-xs bg-slate-50 dark:bg-[#1F2B24] border border-slate-200 dark:border-emerald-900/50 rounded-lg px-2.5 py-1 text-slate-800 dark:text-emerald-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={addMediaUrl}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Attach
              </button>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-emerald-900/20">
            <div className="flex items-center gap-1 sm:gap-2">
              <label className="cursor-pointer p-2 rounded-lg text-slate-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 transition-colors flex items-center gap-1.5 text-xs font-medium">
                <Image size={18} />
                <span className="hidden sm:inline">Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setShowMediaInput(!showMediaInput)}
                className="p-2 rounded-lg text-slate-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 transition-colors flex items-center gap-1.5 text-xs font-medium"
              >
                <Sparkles size={18} />
                <span className="hidden sm:inline">Image URL</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTagInput(!showTagInput)}
                className="p-2 rounded-lg text-slate-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 transition-colors flex items-center gap-1.5 text-xs font-medium"
              >
                <Tag size={18} />
                <span className="hidden sm:inline">Tag</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-medium ${content.length >= CHARACTER_LIMIT ? 'text-red-500' : 'text-slate-400 dark:text-emerald-500/60'}`}>
                {content.length}/{CHARACTER_LIMIT}
              </span>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || (!content.trim() && mediaUrls.length === 0)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
