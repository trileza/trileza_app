/**
 * Trileza Application Notifications and Deep Linking Manager
 * ─────────────────────────────────────────────────────────────
 * Coordinates native browser Notification API permissions,
 * simulated push triggers, and routing dispatching for deep links.
 */

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  deeplink: string;
  icon?: string;
  timestamp: string;
}

class AppNotificationManager {
  private listeners: Set<(notif: AppNotification) => void> = new Set();

  constructor() {
    // Request permission on boot if supported
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        setTimeout(() => {
          Notification.requestPermission();
        }, 3000);
      }
    }
  }

  /**
   * Subscribe to new notification events
   */
  subscribe(callback: (notif: AppNotification) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Dispatches a notification to the system and app listeners
   */
  trigger(title: string, body: string, deeplink: string, icon = 'https://api.dicebear.com/7.x/bottts/svg?seed=Trileza') {
    const notif: AppNotification = {
      id: `notif_${Date.now()}`,
      title,
      body,
      deeplink,
      icon,
      timestamp: new Date().toISOString()
    };

    // 1. Dispatch to local listeners (UI toast, status indicators)
    this.listeners.forEach(listener => listener(notif));

    // 2. Dispatch to system/browser notifications if permitted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          const sysNotif = new Notification(title, {
            body,
            icon,
            tag: notif.id
          });

          // Deep linking action on notification click
          sysNotif.onclick = (e) => {
            e.preventDefault();
            window.focus();
            window.location.href = deeplink;
          };
        } catch (err) {
          console.warn('[NotificationManager] System notification failed:', err);
        }
      }
    }

    // Save to local notifications inbox/history
    this.saveToInbox(notif);
  }

  private saveToInbox(notif: AppNotification) {
    try {
      const inbox = localStorage.getItem('trileza_notifications_inbox');
      const list = inbox ? JSON.parse(inbox) : [];
      list.unshift(notif);
      localStorage.setItem('trileza_notifications_inbox', JSON.stringify(list.slice(0, 50)));
    } catch (e) {
      console.error('[NotificationManager] Failed to write notification to local history:', e);
    }
  }

  getInbox(): AppNotification[] {
    try {
      const inbox = localStorage.getItem('trileza_notifications_inbox');
      return inbox ? JSON.parse(inbox) : [];
    } catch (e) {
      return [];
    }
  }

  clearInbox() {
    localStorage.removeItem('trileza_notifications_inbox');
  }
}

export const appNotifications = new AppNotificationManager();
