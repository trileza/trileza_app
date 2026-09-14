import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Plus, X, Loader2, ListTodo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../ui';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { schoolOpsService } from '../../lib/services/schoolOps';
import type { TodoItem } from '../../types/school';
import { cn } from '../../utils';

const dueLabel = (iso?: string | null) => {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: 'Overdue', tone: 'text-red-600' };
  if (days === 0) return { text: 'Today', tone: 'text-amber-600' };
  if (days === 1) return { text: 'Tomorrow', tone: 'text-amber-600' };
  return { text: `${days}d`, tone: 'text-slate-400' };
};

/**
 * The dashboard task list.
 *
 * Merges the user's own items with tasks derived live from the data — work due
 * for a student, unmarked submissions for a teacher. Derived rows cannot be
 * ticked off directly; they clear when the underlying work is done, so the list
 * can never disagree with reality.
 */
const TodoWidget: React.FC<{ className?: string }> = ({ className }) => {
  const { user, activeRole } = useAuthStore();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [items, setItems] = useState<TodoItem[]>([]);
  const [derived, setDerived] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const role = (activeRole || resolveActiveRole(user) || 'mentee').toLowerCase();
  const isTeacher = role === 'mentor' || role === 'tutor' || role === 'management' || role === 'staff';

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [manual, auto] = await Promise.all([
        schoolOpsService.listTodos(user.id).catch(() => [] as TodoItem[]),
        schoolOpsService.getDerivedTodos(user.id, isTeacher ? 'teacher' : 'student').catch(() => [] as TodoItem[])
      ]);
      setItems(manual);
      setDerived(auto);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isTeacher]);

  useEffect(() => { load(); }, [load]);

  const addItem = async () => {
    if (!draft.trim() || !user?.id || !tenant?.id) return;
    const title = draft.trim();
    setDraft('');
    setAdding(false);
    try {
      await schoolOpsService.addTodo({ tenant_id: tenant.id, user_id: user.id, title });
      load();
    } catch {
      // Restore what they typed so the text is not lost on failure.
      setDraft(title);
      setAdding(true);
    }
  };

  const toggle = async (item: TodoItem) => {
    // Optimistic: the row disappears immediately, which is what ticking means.
    setItems(prev => prev.filter(i => i.id !== item.id));
    try {
      await schoolOpsService.toggleTodo(item.id, true);
    } catch {
      load();
    }
  };

  const all = [...derived, ...items];

  return (
    <Card className={cn('rounded-[2rem] border-none shadow-xl overflow-hidden flex flex-col', className)}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
          <ListTodo size={16} className="text-emerald-500" />
          To-do
          {all.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 tabular-nums">
              {all.length}
            </span>
          )}
        </h3>
        <button
          onClick={() => setAdding(a => !a)}
          className="text-slate-400 hover:text-emerald-600 p-1 cursor-pointer"
          aria-label="Add a task"
        >
          {adding ? <X size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {adding && (
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addItem();
              if (e.key === 'Escape') { setAdding(false); setDraft(''); }
            }}
            placeholder="What needs doing?"
            className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:border-emerald-500"
          />
          <Button onClick={addItem} disabled={!draft.trim()} size="sm" className="rounded-xl px-4 bg-brand-primary text-white border-none font-bold">
            Add
          </Button>
        </div>
      )}

      {loading ? (
        <div className="p-8 flex justify-center"><Loader2 size={18} className="animate-spin text-emerald-500" /></div>
      ) : all.length === 0 ? (
        <div className="p-8 text-center">
          <CheckCircle2 size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-500">Nothing outstanding</p>
          <p className="text-xs text-slate-400 mt-1">
            {isTeacher ? 'No work waiting to be marked.' : 'You are up to date.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[340px] overflow-y-auto">
          {all.map(item => {
            const due = dueLabel(item.due_at);
            const isDerived = item.source === 'system';

            return (
              <li key={item.id} className="flex items-center gap-3 px-6 py-3">
                {isDerived ? (
                  // Derived rows clear themselves; a checkbox here would lie.
                  <span className="w-4 h-4 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex-none" title="Clears automatically" />
                ) : (
                  <button
                    onClick={() => toggle(item)}
                    className="text-slate-300 hover:text-emerald-500 flex-none cursor-pointer"
                    aria-label={`Mark "${item.title}" done`}
                  >
                    <Circle size={16} />
                  </button>
                )}

                <button
                  onClick={() => item.link_to && navigate(item.link_to)}
                  disabled={!item.link_to}
                  className={cn(
                    'flex-1 min-w-0 text-left',
                    item.link_to && 'cursor-pointer hover:text-emerald-600'
                  )}
                >
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{item.title}</p>
                </button>

                {due && (
                  <span className={cn('text-[10px] font-black uppercase tabular-nums flex-none', due.tone)}>
                    {due.text}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export default TodoWidget;
