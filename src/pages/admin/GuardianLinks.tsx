import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Plus, X, Loader2, AlertTriangle, Search, Link2Off, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card, Button } from '../../components/ui';
import { useTenant } from '../../lib/tenantContext';
import { guardianService } from '../../lib/services/guardians';
import { nexus } from '../../lib/nexus';
import type { GuardianLink } from '../../types/school';
import { cn } from '../../utils';

const inputClass =
  'w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500';

interface Person { id: string; full_name?: string; email?: string; role?: string }

/**
 * School-office view for linking parent accounts to students.
 *
 * Links are created here and nowhere else — a guardian cannot attach themselves
 * to a child, which the RLS policy on guardian_links enforces independently.
 */
const GuardianLinks: React.FC = () => {
  const { tenant } = useTenant();

  const [students, setStudents] = useState<Person[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Person | null>(null);
  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [linksLoading, setLinksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showLink, setShowLink] = useState(false);
  const [guardianSearch, setGuardianSearch] = useState('');
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Person | null>(null);
  const [relationship, setRelationship] = useState<GuardianLink['relationship']>('parent');
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      let query = nexus.database
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('tenant_id', tenant.id)
        .limit(50);

      const term = search.trim();
      if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

      const { data, error: qErr } = await query;
      if (qErr) throw new Error(qErr.message);

      // Guardians are not students, so keep them out of the left-hand list.
      setStudents(((data || []) as Person[]).filter(p => p.role !== 'guardian'));
    } catch (err: any) {
      setError(err.message || 'Could not load students.');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, search]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const openStudent = async (student: Person) => {
    setSelectedStudent(student);
    setLinksLoading(true);
    try {
      setLinks(await guardianService.getGuardiansOf(student.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLinksLoading(false);
    }
  };

  const searchGuardians = async () => {
    if (!tenant?.id) return;
    try {
      let query = nexus.database
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('tenant_id', tenant.id)
        .limit(20);

      const term = guardianSearch.trim();
      if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

      const { data } = await query;
      const alreadyLinked = new Set(links.map(l => l.guardian_id));
      setCandidates(
        ((data || []) as Person[]).filter(p => p.id !== selectedStudent?.id && !alreadyLinked.has(p.id))
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => { if (showLink) searchGuardians(); /* eslint-disable-next-line */ }, [showLink]);

  const createLink = async () => {
    if (!picked || !selectedStudent || !tenant?.id) return;
    setSaving(true);
    setError(null);
    try {
      await guardianService.linkGuardian({
        tenantId: tenant.id,
        guardianId: picked.id,
        studentId: selectedStudent.id,
        relationship,
        isPrimary
      });
      setNotice(`${picked.full_name || picked.email} linked to ${selectedStudent.full_name}.`);
      setShowLink(false);
      setPicked(null);
      setGuardianSearch('');
      setIsPrimary(false);
      openStudent(selectedStudent);
    } catch (err: any) {
      setError(err.message || 'Could not create the link.');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (link: GuardianLink) => {
    try {
      await guardianService.revokeLink(link.id);
      setNotice('Access revoked.');
      if (selectedStudent) openStudent(selectedStudent);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const togglePermission = async (link: GuardianLink, key: 'can_view_grades' | 'can_view_attendance') => {
    try {
      await guardianService.updatePermissions(link.id, { [key]: !link[key] });
      if (selectedStudent) openStudent(selectedStudent);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>Parents & <span className="text-emerald-400">Guardians</span></span>}
        description="Link a parent account to a student and control what they can see. Only school staff can create these links."
        tag="Safeguarding"
        icon={Heart}
        variant="default"
      />

      {error && (
        <Card className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-none" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={16} /></button>
        </Card>
      )}
      {notice && (
        <Card className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-3">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{notice}</p>
          <button onClick={() => setNotice(null)} className="ml-auto text-emerald-500"><X size={16} /></button>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadStudents()}
              placeholder="Search students"
              className={inputClass + ' pl-10'}
            />
          </div>

          {loading ? (
            <Card className="p-8 rounded-2xl border-none flex justify-center">
              <Loader2 size={18} className="animate-spin text-emerald-500" />
            </Card>
          ) : students.length === 0 ? (
            <Card className="p-8 rounded-2xl border-none text-center">
              <p className="text-sm text-slate-500 font-medium">No students found.</p>
            </Card>
          ) : (
            <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => openStudent(s)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border transition-all cursor-pointer',
                    selectedStudent?.id === s.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900'
                  )}
                >
                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{s.full_name || s.email}</p>
                  <p className="text-xs text-slate-400 font-semibold truncate">{s.email}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Links */}
        <div className="lg:col-span-2">
          {!selectedStudent ? (
            <Card className="p-12 rounded-[2.5rem] border-none text-center h-full flex flex-col items-center justify-center">
              <Heart size={36} className="text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Select a student to manage their guardians.</p>
            </Card>
          ) : (
            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                <div className="min-w-0">
                  <h3 className="font-black text-lg text-slate-900 dark:text-white truncate">{selectedStudent.full_name || selectedStudent.email}</h3>
                  <p className="text-xs font-bold text-slate-400">{links.length} linked guardian{links.length === 1 ? '' : 's'}</p>
                </div>
                <Button onClick={() => setShowLink(true)} size="sm" className="gap-2 rounded-xl bg-brand-primary text-white border-none text-[10px] font-black uppercase">
                  <Plus size={13} /> Link a guardian
                </Button>
              </div>

              {linksLoading ? (
                <div className="p-12 flex justify-center"><Loader2 size={18} className="animate-spin text-emerald-500" /></div>
              ) : links.length === 0 ? (
                <p className="p-12 text-center text-sm text-slate-500 font-medium">
                  No guardian linked to this student yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {links.map(l => (
                    <li key={l.id} className="px-6 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm text-slate-900 dark:text-white">{l.guardian_name}</p>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">
                              {l.relationship}
                            </span>
                            {l.is_primary && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[9px] font-black uppercase">
                                Primary
                              </span>
                            )}
                            {l.status !== 'active' && (
                              <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 text-[9px] font-black uppercase">
                                {l.status}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-semibold truncate">{l.guardian_email}</p>
                        </div>
                        {l.status === 'active' && (
                          <button
                            onClick={() => revoke(l)}
                            className="text-slate-300 hover:text-red-500 p-1.5 flex-none cursor-pointer"
                            aria-label="Revoke access"
                            title="Revoke access"
                          >
                            <Link2Off size={15} />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {([
                          { key: 'can_view_grades' as const, label: 'Grades' },
                          { key: 'can_view_attendance' as const, label: 'Attendance' }
                        ]).map(perm => (
                          <button
                            key={perm.key}
                            onClick={() => togglePermission(l, perm.key)}
                            disabled={l.status !== 'active'}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer disabled:opacity-40',
                              l[perm.key]
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            )}
                          >
                            <ShieldCheck size={12} /> {perm.label} {l[perm.key] ? 'shared' : 'hidden'}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Link modal */}
      {showLink && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-8 rounded-[2rem] border-none space-y-4 max-h-[85vh] flex flex-col">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Link a guardian to {selectedStudent.full_name}
            </h3>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={guardianSearch}
                  onChange={e => setGuardianSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchGuardians()}
                  placeholder="Search by name or email"
                  className={inputClass + ' pl-10'}
                />
              </div>
              <Button onClick={searchGuardians} variant="outline" className="rounded-xl h-12 px-5 font-bold flex-none">Search</Button>
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-[120px]">
              {candidates.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 font-medium">
                  No matching accounts. The guardian needs an account in this institution first.
                </p>
              ) : (
                <ul className="space-y-1">
                  {candidates.map(p => (
                    <li key={p.id}>
                      <button
                        onClick={() => setPicked(p)}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border transition-all cursor-pointer',
                          picked?.id === p.id
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        )}
                      >
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{p.full_name || p.email}</p>
                        <p className="text-xs text-slate-400 font-semibold truncate">{p.email}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {picked && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Relationship</span>
                  <select className={inputClass + ' mt-1'} value={relationship} onChange={e => setRelationship(e.target.value as GuardianLink['relationship'])}>
                    {['parent', 'guardian', 'carer', 'other'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-3 cursor-pointer">
                  <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Primary contact</span>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowLink(false); setPicked(null); }} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
              <Button onClick={createLink} disabled={!picked || saving} className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold">
                {saving ? 'Linking…' : 'Create link'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GuardianLinks;
