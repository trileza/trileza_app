/**
 * What a reader sees when a book will not open.
 *
 * The proposal asks that a mentee "never feel that a borrowed book has
 * disappeared without explanation. When access expires, the interface should
 * explain why and provide the permitted next actions."
 *
 * So this distinguishes the two refusals the backend reports. An ended loan
 * and a book you never had access to look identical if you only say "denied",
 * and they call for different things: one is re-borrow or buy, the other is
 * buy or ask a mentor.
 */

import React from 'react';
import { Clock, Lock, ShoppingBag, HandHeart, ArrowLeft } from 'lucide-react';
import { Button } from '../ui';

interface Props {
  /** expired | no_license — anything else is treated as a generic refusal. */
  reason: string;
  bookTitle?: string;
  /** True when a mentor paid for the loan that has now ended. */
  wasSponsored?: boolean;
  onBuy?: () => void;
  onAskMentor?: () => void;
  onBack: () => void;
}

export const ReaderGate: React.FC<Props> = ({
  reason, bookTitle, wasSponsored, onBuy, onAskMentor, onBack
}) => {
  const expired = reason === 'expired';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div
          className={
            'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ' +
            (expired ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-800 text-slate-400')
          }
        >
          {expired ? <Clock size={26} /> : <Lock size={26} />}
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-black text-white">
            {expired ? 'This loan has ended' : 'You do not have this book yet'}
          </h2>

          <p className="text-xs font-bold text-slate-400 leading-relaxed">
            {expired ? (
              <>
                Your borrowing period for
                {bookTitle ? ` “${bookTitle}” ` : ' this book '}
                is over, so it is no longer readable.
                {wasSponsored
                  ? ' Your mentor can borrow it again, or buy you a copy to keep.'
                  : ' You can buy a copy to keep reading.'}
              </>
            ) : (
              <>
                {bookTitle ? `“${bookTitle}” ` : 'This book '}
                is not in your library. Buy a copy, or ask your mentor to get it
                for you.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {onBuy && (
            <Button
              onClick={onBuy}
              className="w-full h-12 rounded-2xl bg-brand-primary hover:bg-brand-primary-hover text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <ShoppingBag size={14} /> Buy a copy
            </Button>
          )}

          {onAskMentor && (
            <Button
              onClick={onAskMentor}
              className="w-full h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <HandHeart size={14} /> Ask my mentor
            </Button>
          )}

          <button
            onClick={onBack}
            className="w-full h-11 rounded-2xl text-slate-500 hover:text-slate-300 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border-none bg-transparent cursor-pointer"
          >
            <ArrowLeft size={13} /> Back to my library
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReaderGate;
