import React, { useEffect } from 'react';
import { Bell, Heart, MessageSquare, UserPlus, AtSign } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useFeedStore } from '../../store/feedStore';
import type { FeedNotification } from '../../lib/services/feeds';

interface NotificationsWidgetProps {
  onNotificationClick?: (notif: FeedNotification) => void;
}

export const NotificationsWidget: React.FC<NotificationsWidgetProps> = ({ onNotificationClick }) => {
  const { user } = useAuthStore();
  const { notifications, fetchNotifications, markNotificationRead } = useFeedStore();

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id);
    }
  }, [user?.id]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart size={14} className="text-red-500 fill-current" />;
      case 'comment':
        return <MessageSquare size={14} className="text-emerald-500" />;
      case 'follow':
        return <UserPlus size={14} className="text-teal-500" />;
      case 'mention':
        return <AtSign size={14} className="text-purple-500" />;
      default:
        return <Bell size={14} className="text-emerald-500" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="bg-white dark:bg-[#161F1A] border border-slate-200 dark:border-emerald-900/30 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-emerald-900/20">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-sm text-slate-800 dark:text-emerald-100">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-emerald-500/60 italic text-center py-4">
            No notifications yet
          </p>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <div
              key={n.id}
              onClick={() => {
                markNotificationRead(n.id);
                if (onNotificationClick) onNotificationClick(n);
              }}
              className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                n.is_read
                  ? 'bg-slate-50/50 dark:bg-[#1F2B24]/40 border-slate-100 dark:border-emerald-900/10'
                  : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/40 font-medium'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-white dark:bg-[#161F1A] shadow-xs shrink-0 mt-0.5">
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-800 dark:text-emerald-200 leading-snug line-clamp-2">{n.message}</p>
                <span className="text-[10px] text-slate-400 dark:text-emerald-500/70 block mt-1">
                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
