/**
 * The reader's side panel and licence banner.
 *
 * Covers the parts of the proposal's reader (section 16) that were missing:
 * bookmarks, a font-size control, and a visible sense of how long a borrowed
 * book has left. Highlights and notes already had storage; they are surfaced
 * here so all four live in one place rather than three menus.
 *
 * The countdown is not decoration. A mentee reading a five-day loan should
 * never be surprised when it ends — the proposal asks the interface to explain
 * expiry rather than let a book quietly stop working.
 */

import React, { useEffect, useState } from 'react';
import {
  Bookmark, BookmarkPlus, Highlighter, StickyNote, Type,
  Clock, Trash2, X, Loader2
} from 'lucide-react';
import { cn } from '../../utils';
import {
  readerService,
  type Bookmark as Mark,
  type Highlight,
  type ReaderNote
} from '../../lib/services/reader';

type Tab = 'bookmarks' | 'highlights' | 'notes';

interface Props {
  userId: string;
  userName: string;
  bookId: string;
  /** Current page, so a bookmark knows where it points. */
  currentPage: number;
  fontScale: number;
  onFontScale: (scale: number) => void;
  onGoToPage: (page: number) => void;
  onClose: () => void;
}

export const ReaderPanel: React.FC<Props> = ({
  userId, userName, bookId, currentPage, fontScale, onFontScale, onGoToPage, onClose
}) => {
  const [tab, setTab] = useState<Tab>('bookmarks');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<ReaderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, h, n] = await Promise.all([
        readerService.listBookmarks(userId, bookId).catch(() => []),
        readerService.listHighlights(userId, bookId).catch(() => []),
        readerService.listNotes(userId, bookId).catch(() => [])
      ]);
      if (!alive) return;
      setMarks(m); setHighlights(h); setNotes(n);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId, bookId]);

  const addMark = async () => {
    setBusy(true);
    try {
      const created = await readerService.addBookmark(
        userId, bookId, String(currentPage), currentPage, `Page ${currentPage}`
      );
      // null means it was already bookmarked, which is not an error.
      if (created) setMarks(prev => [...prev, created].sort((a, b) => (a.page_index ?? 0) - (b.page_index ?? 0)));
    } catch (err) {
      console.error('[Reader] bookmark failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const created = await readerService.addNote(userId, userName, bookId, draft.trim(), currentPage);
      setNotes(prev => [...prev, created]);
      setDraft('');
    } catch (err) {
      console.error('[Reader] note failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const alreadyMarked = marks.some(m => m.page_index === currentPage);

  const tabs: Array<{ key: Tab; label: string; icon: any; count: number }> = [
    { key: 'bookmarks',  label: 'Marks',      icon: Bookmark,    count: marks.length },
    { key: 'highlights', label: 'Highlights', icon: Highlighter, count: highlights.length },
    { key: 'notes',      label: 'Notes',      icon: StickyNote,  count: notes.length }
  ];

  return (
    <div className="w-full sm:w-[340px] h-full flex flex-col bg-slate-900 border-l border-slate-800">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">Your notes</h3>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-colors border-none bg-transparent cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Text size. Part of the proposal's reader list, and the one control a
          reader reaches for most on a phone. */}
      <div className="px-5 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Type size={13} className="text-slate-500 shrink-0" />
          <input
            type="range"
            min={0.8}
            max={1.8}
            step={0.1}
            value={fontScale}
            onChange={(e) => onFontScale(Number(e.target.value))}
            aria-label="Text size"
            className="flex-1 accent-brand-secondary cursor-pointer"
          />
          <span className="text-[10px] font-black text-slate-400 tabular-nums w-9 text-right">
            {Math.round(fontScale * 100)}%
          </span>
        </div>
      </div>

      <div className="flex gap-1 px-3 py-2 border-b border-slate-800 shrink-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border-none cursor-pointer',
              tab === t.key ? 'bg-slate-800 text-white' : 'bg-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            <t.icon size={12} /> {t.label}
            {t.count > 0 && <span className="opacity-60">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <Loader2 size={13} className="animate-spin" /> Loading
          </div>
        ) : tab === 'bookmarks' ? (
          <>
            <button
              onClick={addMark}
              disabled={busy || alreadyMarked}
              className={cn(
                'w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-colors cursor-pointer',
                alreadyMarked
                  ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-default'
                  : 'bg-brand-primary border-transparent text-white hover:bg-brand-primary-hover'
              )}
            >
              <BookmarkPlus size={13} />
              {alreadyMarked ? `Page ${currentPage} is marked` : `Mark page ${currentPage}`}
            </button>

            {marks.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-8 leading-relaxed">
                Nothing marked yet. Mark a page to come back to it.
              </p>
            ) : (
              marks.map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-800"
                >
                  <button
                    onClick={() => onGoToPage(m.page_index ?? 1)}
                    className="flex-1 text-left text-[11px] font-bold text-slate-200 hover:text-white border-none bg-transparent cursor-pointer"
                  >
                    {m.label || `Page ${m.page_index}`}
                  </button>
                  <button
                    onClick={async () => {
                      await readerService.removeBookmark(m.id);
                      setMarks(prev => prev.filter(x => x.id !== m.id));
                    }}
                    aria-label="Remove bookmark"
                    className="p-1 rounded-lg text-slate-600 hover:text-red-400 border-none bg-transparent cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </>
        ) : tab === 'highlights' ? (
          highlights.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-8 leading-relaxed">
              Select text in the book to highlight it.
            </p>
          ) : (
            highlights.map(h => (
              <div key={h.id} className="px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-800 space-y-1.5">
                <p className="text-[11px] text-slate-200 leading-relaxed line-clamp-4">
                  “{h.passage_text}”
                </p>
                {h.comment && (
                  <p className="text-[10px] text-slate-400 italic leading-relaxed">{h.comment}</p>
                )}
                <button
                  onClick={async () => {
                    await readerService.removeHighlight(h.id);
                    setHighlights(prev => prev.filter(x => x.id !== h.id));
                  }}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 border-none bg-transparent cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ))
          )
        ) : (
          <>
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`A note about page ${currentPage}…`}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-brand-secondary resize-none"
              />
              <button
                onClick={addNote}
                disabled={busy || !draft.trim()}
                className="w-full px-4 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest border-none cursor-pointer"
              >
                Save note
              </button>
            </div>

            {notes.map(n => (
              <div key={n.id} className="px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-800 space-y-1.5">
                {n.page_index !== null && (
                  <button
                    onClick={() => onGoToPage(n.page_index!)}
                    className="text-[9px] font-black uppercase tracking-widest text-brand-accent border-none bg-transparent cursor-pointer p-0"
                  >
                    Page {n.page_index}
                  </button>
                )}
                <p className="text-[11px] text-slate-200 leading-relaxed">{n.text}</p>
                <button
                  onClick={async () => {
                    await readerService.removeNote(n.id);
                    setNotes(prev => prev.filter(x => x.id !== n.id));
                  }}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 border-none bg-transparent cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

/**
 * The loan countdown, shown inside the reader.
 *
 * Only for a borrowed licence — an owned book has nothing to count down, and a
 * banner saying so would be noise.
 */
export const LoanBanner: React.FC<{ daysLeft: number | null; licenseType: string | null }> = ({
  daysLeft, licenseType
}) => {
  if (licenseType !== 'borrowed' || daysLeft === null) return null;

  const urgent = daysLeft <= 1;

  return (
    <div
      className={cn(
        'px-4 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest',
        urgent ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'
      )}
    >
      <Clock size={12} />
      {daysLeft === 0
        ? 'This loan ends today'
        : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left on this loan`}
    </div>
  );
};

export default ReaderPanel;
