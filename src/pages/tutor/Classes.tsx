import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, AlertTriangle, X, Loader2, UserPlus, Archive, Search } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { classService } from '../../lib/services/classes';
import { nexus } from '../../lib/nexus';
import type { SchoolClass, ClassMember } from '../../types/school';
import { cn } from '../../utils';

/**
 * Class and roster management: create teaching groups, add and remove students.
 * A class is what attendance, the gradebook and the timetable attach to.
 */
const Classes: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selected, setSelected] = useState<SchoolClass | null>(null);
  const [roster, setRoster] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', academic_year: '', room: '' });
  const [creating, setCreating] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);

  const loadClasses = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const list = await classService.listClasses(tenant.id);
      setClasses(list);
      setSelected(prev => (prev ? list.find(c => c.id === prev.id) || null : null));
    } catch (err: any) {
      setError(err.message || 'Could not load classes.');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  const openClass = async (cls: SchoolClass) => {
    setSelected(cls);
    setRosterLoading(true);
    try {
      setRoster(await classService.getRoster(cls.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRosterLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!tenant?.id || !user?.id || !form.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await classService.createClass({
        tenant_id: tenant.id,
        name: form.name.trim(),
        subject: form.subject.trim() || null,
        academic_year: form.academic_year.trim() || null,
        room: form.room.trim() || null,
        lead_teacher_id: user.id
      });
      setShowCreate(false);
      setForm({ name: '', subject: '', academic_year: '', room: '' });
      loadClasses();
    } catch (err: any) {
      setError(err.message || 'Could not create the class.');
    } finally {
      setCreating(false);
    }
  };

  const runSearch = async () => {
    if (!tenant?.id) return;
    setSearching(true);
    try {
      let query = nexus.database
        .from('profiles')
        .select('id, full_name, email, avatar_url, role')
        .eq('tenant_id', tenant.id)
        .limit(25);

      const term = search.trim();
      if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

      const { data, error: qErr } = await query;
      if (qErr) throw new Error(qErr.message);

      const onRoster = new Set(roster.map(r => r.user_id));
      setCandidates(((data || []) as any[]).filter(p => !onRoster.has(p.id)));
    } catch (err: any) {
      setError(err.message || 'Could not search for students.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => { if (showAdd) runSearch(); /* eslint-disable-next-line */ }, [showAdd]);

  const handleAddMembers = async () => {
    if (!selected || picked.size === 0) return;
    try {
      const result = await classService.addMembers(selected.id, Array.from(picked));
      setShowAdd(false);
      setPicked(new Set());
      setSearch('');
      if (result.skipped > 0) {
        setError(`Added ${result.added}. ${result.skipped} were already on the roster.`);
      }
      openClass(selected);
      loadClasses();
    } catch (err: any) {
      setError(err.message || 'Could not add students.');
    }
  };

  const handleRemove = async (userId: string) => {
    if (!selected) return;
    try {
      await classService.removeMember(selected.id, userId);
      openClass(selected);
      loadClasses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleArchive = async (cls: SchoolClass) => {
    try {
      await classService.archiveClass(cls.id);
      if (selected?.id === cls.id) setSelected(null);
      loadClasses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>Classes & <span className="text-emerald-400">Rosters</span></span>}
        description="Teaching groups that attendance, the gradebook and the timetable attach to."
        tag="Class management"
        icon={Users}
        variant="mentor"
        rightContent={
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-11 sm:h-14 px-4 sm:px-6 font-black uppercase text-[10px] tracking-widest mt-3 sm:mt-0"
          >
            <Plus size={14} /> New class
          </Button>
        }
      />

      {error && (
        <Card className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-none" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-amber-400 hover:text-amber-600"><X size={16} /></button>
        </Card>
      )}

      {loading && (
        <Card className="p-12 rounded-[2.5rem] border-none flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="font-bold text-slate-500">Loading classes…</span>
        </Card>
      )}

      {!loading && classes.length === 0 && (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <Users size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No classes yet</h3>
          <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
            A class is a teaching group like "Year 10 Biology, Set B". Create one to start taking a
            register and recording grades.
          </p>
          <Button onClick={() => setShowCreate(true)} className="mt-6 rounded-2xl bg-brand-primary text-white border-none font-bold px-6 h-12">
            Create your first class
          </Button>
        </Card>
      )}

      {!loading && classes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Class list */}
          <div className="lg:col-span-1 space-y-3">
            {classes.map(cls => (
              <Card
                key={cls.id}
                onClick={() => openClass(cls)}
                className={cn(
                  'p-5 rounded-3xl cursor-pointer transition-all border',
                  selected?.id === cls.id
                    ? 'border-emerald-500 shadow-lg shadow-emerald-500/10'
                    : 'border-transparent hover:border-slate-200 dark:hover:border-slate-800'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 dark:text-white truncate">{cls.name}</h3>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                      {[cls.subject, cls.academic_year, cls.room].filter(Boolean).join(' · ') || 'No details set'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-600 dark:text-slate-300 tabular-nums flex-none">
                    {cls.member_count ?? 0}
                  </span>
                </div>
              </Card>
            ))}
          </div>

          {/* Roster */}
          <div className="lg:col-span-2">
            {!selected ? (
              <Card className="p-12 rounded-[2.5rem] border-none text-center h-full flex flex-col items-center justify-center">
                <p className="text-slate-500 font-medium">Select a class to see its roster.</p>
              </Card>
            ) : (
              <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-black text-lg text-slate-900 dark:text-white">{selected.name}</h3>
                    <p className="text-xs font-bold text-slate-400">
                      {roster.filter(r => r.role === 'student').length} students
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="gap-2 rounded-xl text-[10px] font-black uppercase">
                      <UserPlus size={13} /> Add students
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleArchive(selected)} className="gap-2 rounded-xl text-[10px] font-black uppercase">
                      <Archive size={13} /> Archive
                    </Button>
                  </div>
                </div>

                {rosterLoading ? (
                  <div className="p-12 flex justify-center"><Loader2 size={20} className="animate-spin text-emerald-500" /></div>
                ) : roster.length === 0 ? (
                  <p className="p-12 text-center text-slate-500 font-medium">
                    Nobody on this roster yet. Add students to get started.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {roster.map(m => (
                      <li key={m.id} className="flex items-center gap-3 px-6 py-3">
                        {m.avatar_url
                          ? <img src={m.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-none" />
                          : <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 flex-none">
                              {(m.full_name || '?').charAt(0).toUpperCase()}
                            </div>}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{m.full_name}</p>
                          <p className="text-xs text-slate-400 font-semibold truncate">{m.email}</p>
                        </div>
                        {m.role !== 'student' && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 text-[9px] font-black uppercase">{m.role}</span>
                        )}
                        <button
                          onClick={() => handleRemove(m.user_id)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1.5 cursor-pointer"
                          aria-label={`Remove ${m.full_name}`}
                        >
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Create class */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-8 rounded-[2rem] border-none space-y-5">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">New class</h3>
            <div className="space-y-3">
              {([
                { key: 'name', label: 'Class name', placeholder: 'Year 10 Biology, Set B' },
                { key: 'subject', label: 'Subject', placeholder: 'Biology' },
                { key: 'academic_year', label: 'Academic year', placeholder: '2026/27' },
                { key: 'room', label: 'Room', placeholder: 'Lab 3' }
              ] as const).map(field => (
                <label key={field.key} className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.label}</span>
                  <input
                    value={form[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="mt-1 w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.name.trim() || creating} className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold">
                {creating ? 'Creating…' : 'Create class'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Add students */}
      {showAdd && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-8 rounded-[2rem] border-none space-y-5 max-h-[85vh] flex flex-col">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Add students to {selected.name}</h3>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                  placeholder="Search by name or email"
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <Button onClick={runSearch} variant="outline" className="rounded-xl h-12 px-5 font-bold">Search</Button>
            </div>

            <div className="flex-1 overflow-y-auto -mx-2 px-2">
              {searching ? (
                <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-emerald-500" /></div>
              ) : candidates.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 font-medium">No matching people in this institution.</p>
              ) : (
                <ul className="space-y-1">
                  {candidates.map(p => {
                    const isPicked = picked.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => setPicked(prev => {
                            const next = new Set(prev);
                            next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                            return next;
                          })}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer',
                            isPicked
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          )}
                        >
                          <div className={cn(
                            'w-5 h-5 rounded-md border-2 flex-none flex items-center justify-center',
                            isPicked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'
                          )}>
                            {isPicked && <span className="text-white text-xs font-black">✓</span>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{p.full_name || p.email}</p>
                            <p className="text-xs text-slate-400 font-semibold truncate">{p.email}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowAdd(false); setPicked(new Set()); }} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
              <Button onClick={handleAddMembers} disabled={picked.size === 0} className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold">
                Add {picked.size > 0 ? picked.size : ''}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Classes;
