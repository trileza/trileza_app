/**
 * Durable notifications for library events.
 *
 * The library already nudged people over the realtime channel, which reaches
 * whoever happens to have the app open at that second and nobody else. An
 * author whose book was approved overnight learned nothing, ever — the
 * decision existed only as a websocket frame that had already gone.
 *
 * So every event worth telling someone about is written to `notifications`
 * first, and the live nudge is the optimisation on top rather than the
 * mechanism. A stored row survives a closed laptop.
 *
 * Writes here never throw. A notification that fails to save must not roll
 * back the thing it was describing: a book that was approved is still
 * approved even if telling its author failed.
 */

import { nexus } from '../nexus';

/**
 * The library events people are told about.
 *
 * Kept as a closed set so a typo produces a type error rather than a
 * notification nobody ever filters for.
 */
export type LibraryEvent =
  | 'book_approved'
  | 'book_rejected'
  | 'book_scan_flagged'
  | 'license_expiring'
  | 'license_expired'
  | 'sponsorship_requested'
  | 'sponsorship_granted'
  | 'earning_recorded';

/** `type` drives the colour of the row, so it follows the app's palette. */
type Tone = 'success' | 'warning' | 'error' | 'info';

interface Notice {
  title: string;
  message: string;
  tone: Tone;
  link?: string;
}

/**
 * How each event reads to the person receiving it.
 *
 * Written as something a person would say, not as an event name. "Your book
 * is live" tells an author what happened; "book_approved" makes them work it
 * out.
 */
const compose = (event: LibraryEvent, ctx: Record<string, any>): Notice => {
  const title = ctx.bookTitle ? `“${ctx.bookTitle}”` : 'Your book';

  switch (event) {
    case 'book_approved':
      return {
        title: 'Your book is live',
        message: `${title} passed review and is now in the public library.`,
        tone: 'success',
        link: ctx.bookId ? `/library/${ctx.bookId}` : '/library'
      };

    case 'book_rejected':
      return {
        title: 'Your book needs changes',
        message: ctx.notes
          ? `${title} was not approved. ${ctx.notes}`
          : `${title} was not approved. Open it to see the reviewer's notes.`,
        tone: 'error',
        link: '/author'
      };

    case 'book_scan_flagged':
      // The author is told a review is pending, not given the score. A number
      // out of context invites argument with a machine; the reviewer decides.
      return {
        title: 'Your book is being checked',
        message: `${title} was flagged by the automatic content check and is waiting for a person to look at it.`,
        tone: 'warning',
        link: '/author'
      };

    case 'license_expiring':
      return {
        title: 'A borrowed book is due',
        message:
          ctx.daysLeft === 0
            ? `${title} is due back today.`
            : `${title} is due back in ${ctx.daysLeft} day${ctx.daysLeft === 1 ? '' : 's'}.`,
        tone: 'warning',
        link: '/library/mine'
      };

    case 'license_expired':
      return {
        title: 'A loan has ended',
        message: `${title} is no longer readable. You can borrow it again or buy a copy.`,
        tone: 'info',
        link: ctx.bookId ? `/library/${ctx.bookId}` : '/library/mine'
      };

    case 'sponsorship_requested':
      return {
        title: 'A mentee asked for a book',
        message: `${ctx.menteeName || 'A mentee'} asked you for ${title}.`,
        tone: 'info',
        link: '/library/sponsorship'
      };

    case 'sponsorship_granted':
      return {
        title: 'A book was bought for you',
        message: `${ctx.mentorName || 'Your mentor'} got you ${title}. It is in your library now.`,
        tone: 'success',
        link: '/library/mine'
      };

    case 'earning_recorded':
      return {
        title: 'You earned from a sale',
        message: `${title} earned you ₦${Number(ctx.amount || 0).toLocaleString()}.`,
        tone: 'success',
        link: '/author'
      };
  }
};

export const notify = {
  /**
   * Tells one person about one event.
   *
   * Returns whether it was stored, for callers that want to log a miss. It
   * never throws.
   */
  async send(
    userId: string | null | undefined,
    event: LibraryEvent,
    ctx: Record<string, any> = {}
  ): Promise<boolean> {
    if (!userId) return false;

    const notice = compose(event, ctx);

    try {
      const { error } = await nexus.database.from('notifications').insert([{
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user_id: userId,
        title: notice.title,
        message: notice.message,
        type: notice.tone,
        link: notice.link ?? null,
        is_read: false,
        // The event name is kept so a screen can filter or group by it without
        // parsing the prose above, which is written for people and will change.
        metadata: { event, ...ctx }
      }]);

      if (error) {
        console.error('[Notify] Could not store notification:', error);
        return false;
      }
    } catch (err) {
      console.error('[Notify] Could not store notification:', err);
      return false;
    }

    // The live nudge is best-effort on top of the stored row. If it fails the
    // person still sees the notification next time they look.
    try {
      await nexus.realtime.publish(`user:${userId}`, 'notification', {
        event,
        title: notice.title,
        message: notice.message
      });
    } catch {
      /* Offline, or no channel. The row is already saved. */
    }

    return true;
  },

  /** Unread count, for the bell. */
  async unreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await nexus.database
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) return 0;
      return (data ?? []).length;
    } catch {
      return 0;
    }
  },

  async list(userId: string, limit = 30) {
    const { data, error } = await nexus.database
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data ?? [];
  },

  async markRead(id: string) {
    try {
      await nexus.database.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (err) {
      console.error('[Notify] Could not mark as read:', err);
    }
  },

  async markAllRead(userId: string) {
    try {
      await nexus.database
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    } catch (err) {
      console.error('[Notify] Could not mark all as read:', err);
    }
  }
};

export default notify;
