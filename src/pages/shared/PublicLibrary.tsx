/**
 * The Library, in the proposal's information architecture.
 *
 *   Discover     the catalogue
 *   My Library   owned, borrowed, expiring, expired, currently reading
 *   Sponsorship  what a mentor has paid for, and requests waiting on them
 *   Requests     what a mentee has asked for
 *
 * Which areas appear depends on the role, because the proposal treats a mentor
 * and a mentee as having genuinely different relationships to the library
 * rather than the same screen with buttons hidden.
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, PlusCircle, X, Library, Users, HandHeart, Compass } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore, canHostLiveSessions } from '../../store/authStore';
import PageHeader from '../../components/shared/PageHeader';
import PublicLibraryWrapper from '../../components/shared/PublicLibraryWrapper';
import AuthorDashboard from './AuthorDashboard';
import MyLibrary from '../../components/library/MyLibrary';
import MentorSponsorship from '../../components/library/MentorSponsorship';
import { licensingService } from '../../lib/services/licensing';
import { Button, Card } from '../../components/ui';
import { Toast } from '../../components/ui/Toast';
import { cn, formatDate } from '../../utils';

type Area = 'discover' | 'mine' | 'sponsorship' | 'requests';

const PublicLibrary: React.FC = () => {
  const { user } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const [showPublishingModal, setShowPublishingModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [area, setArea] = useState<Area>('discover');
  const [requests, setRequests] = useState<any[]>([]);

  // A mentor sees the sponsorship area; a mentee sees their own requests.
  const isMentor = canHostLiveSessions(user) && user?.role !== 'guardian';

  useEffect(() => {
    if (!user?.id || isMentor) return;
    licensingService.myRequests(user.id).then(setRequests).catch(() => {});
  }, [user?.id, isMentor]);

  // A book opened from elsewhere (a detail page, a notification) lands here
  // with ?read=<id>, so the reader is reachable without a separate route.
  useEffect(() => {
    if (params.get('read')) setArea('mine');
    if (params.get('tab') === 'bought' || params.get('tab') === 'borrowed') setArea('mine');
  }, [params]);

  const areas: Array<{ key: Area; label: string; icon: any; show: boolean }> = [
    { key: 'discover',    label: 'Discover',   icon: Compass,   show: true },
    { key: 'mine',        label: 'My Library', icon: Library,   show: Boolean(user?.id) },
    { key: 'sponsorship', label: 'Sponsorship', icon: Users,    show: isMentor },
    { key: 'requests',    label: 'My Requests', icon: HandHeart, show: Boolean(user?.id) && !isMentor }
  ];

  const description = isMentor
    ? 'Buy books for yourself, buy or borrow them for your mentees, and follow how they are read.'
    : 'Browse and buy books, or ask your mentor to sponsor one for you.';

  return (
    <div className="w-full pb-20 animate-in fade-in duration-500 space-y-8 relative">
      <PageHeader
        title={<span>The <span className="text-emerald-400">Library</span></span>}
        description={description}
        tag="Publishing & Lending"
        icon={BookOpen}
        rightContent={
          user?.role !== 'management' ? (
            <Button
              onClick={() => setShowPublishingModal(true)}
              className="w-full sm:w-auto gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-11 sm:h-14 px-4 sm:px-6 font-black uppercase text-[10px] tracking-widest transition-all mt-3 sm:mt-0 cursor-pointer"
            >
              <PlusCircle size={14} /> Publish
            </Button>
          ) : null
        }
      />

      {/* ── Areas ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {areas.filter(a => a.show).map(a => (
          <button
            key={a.key}
            onClick={() => setArea(a.key)}
            className={cn(
              'px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border flex items-center gap-2',
              area === a.key
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
            )}
          >
            <a.icon size={13} /> {a.label}
          </button>
        ))}
      </div>

      {area === 'discover' && <PublicLibraryWrapper />}

      {area === 'mine' && user?.id && (
        <MyLibrary
          userId={user.id}
          onRead={(bookId) => {
            // The reader lives inside the catalogue component, which owns the
            // PDF pipeline; handing it the id through the URL avoids lifting
            // that whole machine up a level just to open a book.
            setParams({ read: bookId });
            setArea('discover');
          }}
          onBrowse={() => setArea('discover')}
        />
      )}

      {area === 'sponsorship' && user?.id && (
        <MentorSponsorship
          mentorId={user.id}
          mentorEmail={user.email || ''}
          notify={(message, type) => setToast({ message, type })}
        />
      )}

      {area === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <HandHeart size={22} />
              </div>
              <p className="text-xs font-bold text-slate-500 max-w-sm mx-auto leading-relaxed">
                You have not asked for any books yet. Open a book and choose
                “Ask my mentor for this”.
              </p>
            </div>
          ) : (
            requests.map(r => (
              <Card
                key={r.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    {r.book_title || 'Book request'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400">
                    Asked {formatDate(r.created_at)}
                  </p>
                </div>

                {/* The status says what happened, including how it was
                    fulfilled — a mentee should know whether they were bought a
                    copy or lent one. */}
                <span className={cn(
                  'px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0',
                  r.status === 'fulfilled' ? 'bg-brand-light text-brand-dark'
                    : r.status === 'declined' ? 'bg-slate-100 text-slate-500'
                    : 'bg-amber-50 text-amber-700'
                )}>
                  {r.status === 'fulfilled'
                    ? (r.fulfilled_as === 'borrow' ? 'Borrowed for you' : 'Bought for you')
                    : r.status}
                </span>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Publishing Modal Portal */}
      {showPublishingModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-md p-0 sm:p-4 md:p-10 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-[3rem] w-full max-w-5xl max-h-[90vh] overflow-y-auto relative shadow-[0_32px_64px_-16px_rgba(0,0,0,0.35)] border border-white/10 dark:border-slate-800 animate-in zoom-in-95 duration-300 mobile-bottom-sheet">
            <button
              onClick={() => setShowPublishingModal(false)}
              className="absolute top-6 right-6 p-3 rounded-2xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white z-10 shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950"
              title="Close Panel"
            >
              <X size={20} />
            </button>

            <div className="p-6 md:p-10">
              <AuthorDashboard inline={true} onClose={() => setShowPublishingModal(false)} />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default PublicLibrary;
