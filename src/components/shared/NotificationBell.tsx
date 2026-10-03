/**
 * The notification bell.
 *
 * Library notifications were being written faithfully — book approved, loan
 * due tomorrow, a mentor sponsored a book — and the only place they could be
 * seen was a widget on the Feeds page. A mentee whose loan expires tomorrow
 * had no way to find that out unless they happened to open a social feed.
 *
 * This puts them where notifications belong: in the frame, on every page.
 *
 * It reads the same store the Feeds widget does, so the two cannot disagree
 * and a notification read in one is read in the other.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useFeedStore } from '../../store/feedStore';
import { cn } from '../../utils';
import type { FeedNotification } from '../../lib/services/feeds';

/** How long ago, in the shortest form that is still clear. */
const ago = (iso: string): string => {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * The dot colour follows the notification's tone.
 *
 * The library writes 'success', 'warning', 'error' and 'info'; the social feed
 * writes 'like', 'follow' and the rest. One list shows both, so anything
 * unrecognised falls back to neutral rather than vanishing.
 */
const toneClass = (type: string): string => {
  switch (type) {
    case 'success': return 'bg-emerald-500';
    case 'warning': return 'bg-amber-500';
    case 'error':   return 'bg-red-500';
    default:        return 'bg-brand-accent';
  }
};

export const NotificationBell: React.FC<{ className?: string }> = ({ className }) => {
  const { user } = useAuthStore();
  const { notifications, fetchNotifications, markNotificationRead } = useFeedStore();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.resolve(fetchNotifications(user.id)).finally(() => setLoading(false));
  }, [user?.id, fetchNotifications]);

  // Close on an outside click or Escape. Without the keyboard path the panel
  // is a trap for anyone not using a mouse.
  useEffect(() => {
    if (!open) return;

    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user?.id) return null;

  const unread = notifications.filter(n => !n.is_read);

  const openOne = async (n: FeedNotification) => {
    if (!n.is_read) markNotificationRead(n.id);
    setOpen(false);

    // Library notifications carry a link; social ones carry a sender instead.
    if (n.link) navigate(n.link);
    else if (n.sender_id) navigate(`/feeds?user=${n.sender_id}`);
  };

  const markAll = async () => {
    // Fired together rather than awaited in turn: a reader with thirty unread
    // rows should not watch them clear one at a time.
    await Promise.all(unread.map(n => markNotificationRead(n.id)));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'}
        aria-expanded={open}
        className={cn(
          'relative p-2.5 rounded-2xl bg-surface dark:bg-slate-900 border border-border',
          'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
          'shadow-sm hover:shadow-md transition-all cursor-pointer',
          className
        )}
      >
        <Bell size={18} />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center tabular-nums">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-surface dark:bg-slate-900 border border-border shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
              Notifications
            </h3>
            {unread.length > 0 && (
              <button
                onClick={markAll}
                className="text-[10px] font-black uppercase tracking-wider text-brand-primary hover:underline border-none bg-transparent cursor-pointer flex items-center gap-1"
              >
                <Check size={11} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Loader2 size={13} className="animate-spin" /> Loading
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-center space-y-1.5">
                <Bell size={22} className="text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-[11px] font-bold text-slate-500">Nothing yet</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Book approvals, loans running out and sponsorships will appear here.
                </p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => openOne(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border last:border-0 cursor-pointer transition-colors',
                    n.is_read
                      ? 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      : 'bg-brand-primary/5 hover:bg-brand-primary/10'
                  )}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full mt-1.5 shrink-0',
                      n.is_read ? 'bg-slate-300 dark:bg-slate-700' : toneClass(n.type)
                    )}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-black text-slate-800 dark:text-slate-100 truncate">
                      {n.title || 'Notification'}
                    </span>
                    <span className="block text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {n.message}
                    </span>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                      {ago(n.created_at)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
