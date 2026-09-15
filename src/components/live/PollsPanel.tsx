/**
 * PollsPanel — Bespoke White Theme Polls & Q&A
 * ──────────────────────────────────────────────
 * Uses RTK v2.0 polls API: polls.create(question, options[], anonymous, hideVotes),
 * polls.vote(id, index), pollsUpdate event.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, BarChart3, CheckCircle, Trash2, EyeOff, UserX } from 'lucide-react';
import { useMeetingStore, type Poll } from '../../store/meetingStore';

interface PollsPanelProps {
  userRole: 'teacher' | 'student' | 'moderator';
}

const PollsPanel: React.FC<PollsPanelProps> = ({ userRole }) => {
  const { polls, addPoll, votePoll, setActivePanel } = useMeetingStore();
  const isTeacher = userRole === 'teacher' || userRole === 'moderator';

  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [anonymous, setAnonymous] = useState(false);
  const [hideVotes, setHideVotes] = useState(false);

  const handleCreate = () => {
    const validOptions = options.filter(o => o.trim());
    if (!question.trim() || validOptions.length < 2) return;
    // RTK SDK: polls.create(question, options, anonymous, hideVotes) — positional args
    addPoll(question.trim(), validOptions, anonymous, hideVotes);
    setQuestion('');
    setOptions(['', '']);
    setAnonymous(false);
    setHideVotes(false);
    setShowCreate(false);
  };

  const addOption = () => {
    if (options.length < 6) setOptions([...options, '']);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <BarChart3 size={16} className="text-emerald-400" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Polls & Q&A</h3>
        </div>
        <div className="flex items-center gap-2">
          {isTeacher && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-all cursor-pointer"
            >
              <Plus size={14} />
            </button>
          )}
          <button
            onClick={() => setActivePanel('none')}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-all border-none bg-transparent cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Create Poll Form */}
      <AnimatePresence>
        {showCreate && isTeacher && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-slate-800 overflow-hidden"
          >
            <div className="p-4 space-y-4 text-left">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter your question..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold"
              />
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 w-5">{i + 1}.</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = e.target.value;
                        setOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-semibold"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => setOptions(options.filter((_, j) => j !== i))}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/15 transition-all border-none bg-transparent cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Poll Options */}
              <div className="flex items-center gap-4 text-[10px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    className="rounded text-emerald-500 border-slate-700"
                  />
                  <UserX size={12} className="text-slate-500" />
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Anonymous</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideVotes}
                    onChange={(e) => setHideVotes(e.target.checked)}
                    className="rounded text-emerald-500 border-slate-700"
                  />
                  <EyeOff size={12} className="text-slate-500" />
                  <span className="font-bold text-slate-400 uppercase tracking-wider">Hide Votes</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                {options.length < 6 && (
                  <button
                    onClick={addOption}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-500 uppercase tracking-widest transition-colors border-none bg-transparent cursor-pointer"
                  >
                    + Add Option
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-800 transition-all border-none bg-transparent cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 transition-all disabled:opacity-30 disabled:pointer-events-none border-none cursor-pointer"
                >
                  Launch Poll
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Polls List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar text-left">
        {polls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <BarChart3 size={24} className="text-slate-500" />
            </div>
            <p className="text-xs font-bold text-slate-400">No active polls</p>
            {isTeacher && (
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Click + to create one
              </p>
            )}
          </div>
        ) : (
          polls.map((poll) => (
            <PollCard key={poll.id} poll={poll} hideVotes={poll.hideVotes} />
          ))
        )}
      </div>
    </div>
  );
};

// ── Poll Card (using SDK Poll shape) ──

const PollCard: React.FC<{ poll: Poll; hideVotes: boolean }> = ({ poll, hideVotes }) => {
  const { votePoll, meeting } = useMeetingStore();

  // SDK shape: poll.voted is string[] of user IDs who voted
  // SDK shape: poll.options[i] = { text, votes: { id, name }[], count }
  const selfId = meeting?.self?.userId || meeting?.self?.id;
  const hasVoted = selfId ? poll.voted.includes(selfId) : false;
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-sm text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-black text-white leading-tight">{poll.question}</h4>
        <div className="flex items-center gap-1.5 shrink-0">
          {poll.anonymous && (
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[8px] font-black tracking-widest uppercase">
              Anonymous
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const pct = totalVotes > 0 ? Math.round((opt.count / totalVotes) * 100) : 0;
          // Check if the current user voted for this option
          const isSelected = hasVoted && selfId && opt.votes.some(v => v.id === selfId);

          return (
            <button
              key={i}
              onClick={() => !hasVoted && votePoll(poll.id, i)}
              disabled={hasVoted}
              className={`w-full relative overflow-hidden rounded-xl p-3 text-left transition-all border ${
                hasVoted
                  ? 'cursor-default'
                  : 'hover:bg-slate-800 cursor-pointer bg-slate-900 border-slate-700'
              } ${isSelected ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-800 bg-slate-900/50'}`}
            >
              {/* Progress bar */}
              {hasVoted && !hideVotes && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className={`absolute inset-y-0 left-0 ${isSelected ? 'bg-emerald-500/10' : 'bg-slate-800'}`}
                />
              )}
              <div className="relative flex items-center justify-between gap-3 z-10">
                <div className="flex items-center gap-2 min-w-0">
                  {isSelected && <CheckCircle size={14} className="text-emerald-400 shrink-0" />}
                  <span className="text-xs font-bold text-slate-200 truncate">{opt.text}</span>
                </div>
                {hasVoted && !hideVotes && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-slate-500">{opt.count}</span>
                    <span className="text-xs font-black text-slate-400 tabular-nums">{pct}%</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
        {poll.createdBy && <span className="ml-2">· by {poll.createdBy}</span>}
      </p>
    </motion.div>
  );
};

export default PollsPanel;
