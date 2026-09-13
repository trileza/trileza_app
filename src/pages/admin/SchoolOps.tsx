import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Megaphone, CalendarDays, Clock, Package, ShieldCheck,
  Plus, Trash2, AlertTriangle, X, Loader2
} from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { schoolOpsService } from '../../lib/services/schoolOps';
import { classService } from '../../lib/services/classes';
import { AVAILABLE_PERMISSIONS } from '../../types/school';
import type {
  Announcement, SchoolEvent, TimetableSlot, SchoolResource, CustomRole, SchoolClass
} from '../../types/school';
import { cn } from '../../utils';

type Tab = 'announcements' | 'events' | 'timetable' | 'resources' | 'roles';

const TABS: Array<{ key: Tab; label: string; icon: any }> = [
  { key: 'announcements', label: 'Announcements', icon: Megaphone },
  { key: 'events',        label: 'Events',        icon: CalendarDays },
  { key: 'timetable',     label: 'Timetable',     icon: Clock },
  { key: 'resources',     label: 'Resources',     icon: Package },
  { key: 'roles',         label: 'Custom roles',  icon: ShieldCheck }
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const inputClass =
  'w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500';

/**
 * School operations console: the administrative surfaces an institution needs
 * day to day, grouped into one page rather than five sparse ones.
 */
const SchoolOps: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [tab, setTab] = useState<Tab>('announcements');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [resources, setResources] = useState<SchoolResource[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case 'announcements': setAnnouncements(await schoolOpsService.listAnnouncements(tenant.id)); break;
        case 'events':        setEvents(await schoolOpsService.listEvents(tenant.id)); break;
        case 'timetable':     setSlots(await schoolOpsService.getTimetable(tenant.id)); break;
        case 'resources':     setResources(await schoolOpsService.listResources(tenant.id)); break;
        case 'roles':         setRoles(await schoolOpsService.listCustomRoles(tenant.id)); break;
      }
    } catch (err: any) {
      setError(err.message || 'Could not load this section.');
    } finally {
      setLoading(false);
    }
  }, [tab, tenant?.id]);

  useEffect(() => { load(); }, [load]);

  // Classes are needed by the timetable and class-scoped announcements.
  useEffect(() => {
    if (!tenant?.id) return;
    classService.listClasses(tenant.id).then(setClasses).catch(() => setClasses([]));
  }, [tenant?.id]);

  const openForm = () => { setForm({}); setShowForm(true); setError(null); };

  const handleSubmit = async () => {
    if (!tenant?.id || !user?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      switch (tab) {
        case 'announcements':
          await schoolOpsService.createAnnouncement({
            tenant_id: tenant.id, author_id: user.id,
            title: form.title, body: form.body,
            audience: form.audience || 'tenant',
            class_id: form.audience === 'class' ? form.class_id : null,
            priority: form.priority || 'normal'
          });
          setNotice('Announcement published.');
          break;
        case 'events':
          await schoolOpsService.createEvent({
            tenant_id: tenant.id, organiser_id: user.id,
            title: form.title, description: form.description,
            category: form.category || 'general',
            location: form.location,
            starts_at: new Date(form.starts_at).toISOString(),
            ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null
          });
          setNotice('Event added to the calendar.');
          break;
        case 'timetable':
          await schoolOpsService.addTimetableSlot({
            tenant_id: tenant.id,
            class_id: form.class_id,
            teacher_id: user.id,
            day_of_week: Number(form.day_of_week ?? 1),
            starts_at: form.starts_at,
            ends_at: form.ends_at,
            room: form.room || null,
            label: form.label || null
          });
          setNotice('Timetable slot added.');
          break;
        case 'resources':
          await schoolOpsService.createResource({
            tenant_id: tenant.id, name: form.name,
            kind: form.kind || 'equipment',
            location: form.location, capacity: form.capacity ? Number(form.capacity) : null,
            quantity: form.quantity ? Number(form.quantity) : 1
          });
          setNotice('Resource added.');
          break;
        case 'roles':
          await schoolOpsService.createCustomRole({
            tenant_id: tenant.id, name: form.name,
            description: form.description,
            base_role: form.base_role || 'mentee',
            permissions: form.permissions || []
          });
          setNotice('Role created.');
          break;
      }
      setShowForm(false);
      setForm({});
      load();
    } catch (err: any) {
      setError(err.message || 'Could not save.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (fn: () => Promise<void>) => {
    try { await fn(); load(); } catch (err: any) { setError(err.message); }
  };

  const togglePermission = (perm: string) => {
    setForm(f => {
      const current: string[] = f.permissions || [];
      return { ...f, permissions: current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm] };
    });
  };

  const canSubmit = () => {
    switch (tab) {
      case 'announcements': return Boolean(form.title?.trim() && form.body?.trim());
      case 'events':        return Boolean(form.title?.trim() && form.starts_at);
      case 'timetable':     return Boolean(form.class_id && form.starts_at && form.ends_at);
      case 'resources':     return Boolean(form.name?.trim());
      case 'roles':         return Boolean(form.name?.trim());
      default:              return false;
    }
  };

  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>School <span className="text-emerald-400">Operations</span></span>}
        description="Announcements, the calendar, the timetable, bookable resources and custom staff roles."
        tag="Institution"
        icon={Building2}
        variant="default"
        rightContent={
          <Button
            onClick={openForm}
            className="gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white border-none shadow-xl shadow-emerald-500/20 rounded-2xl h-11 sm:h-14 px-4 sm:px-6 font-black uppercase text-[10px] tracking-widest mt-3 sm:mt-0"
          >
            <Plus size={14} /> New
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setNotice(null); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all border cursor-pointer',
                tab === t.key
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              )}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

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

      {loading ? (
        <Card className="p-12 rounded-[2.5rem] border-none flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="font-bold text-slate-500">Loading…</span>
        </Card>
      ) : (
        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
          {/* Announcements */}
          {tab === 'announcements' && (
            announcements.length === 0
              ? <Empty label="No announcements published yet." />
              : <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {announcements.map(a => (
                    <li key={a.id} className="px-6 py-4 flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{a.title}</p>
                          {a.priority !== 'normal' && <Pill tone={a.priority === 'urgent' ? 'red' : 'amber'}>{a.priority}</Pill>}
                          <Pill tone="slate">{a.audience}</Pill>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{a.body}</p>
                        <p className="text-xs text-slate-400 font-semibold mt-2">{a.author_name} · {formatDateTime(a.publish_at)}</p>
                      </div>
                      <DeleteButton onClick={() => remove(() => schoolOpsService.deleteAnnouncement(a.id))} />
                    </li>
                  ))}
                </ul>
          )}

          {/* Events */}
          {tab === 'events' && (
            events.length === 0
              ? <Empty label="Nothing on the calendar yet." />
              : <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {events.map(e => (
                    <li key={e.id} className="px-6 py-4 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{e.title}</p>
                          <Pill tone="slate">{e.category.replace(/_/g, ' ')}</Pill>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                          {formatDateTime(e.starts_at)}{e.location ? ` · ${e.location}` : ''}
                        </p>
                      </div>
                      <DeleteButton onClick={() => remove(() => schoolOpsService.deleteEvent(e.id))} />
                    </li>
                  ))}
                </ul>
          )}

          {/* Timetable */}
          {tab === 'timetable' && (
            slots.length === 0
              ? <Empty label="No timetable slots set." />
              : <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {DAYS.map((day, idx) => {
                    const daySlots = slots.filter(s => s.day_of_week === idx);
                    if (daySlots.length === 0) return null;
                    return (
                      <div key={day} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{day}</p>
                        <ul className="space-y-2">
                          {daySlots.map(s => (
                            <li key={s.id} className="flex items-start justify-between gap-2 text-sm">
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white truncate">{s.class_name || 'Class'}</p>
                                <p className="text-xs text-slate-400 font-semibold tabular-nums">
                                  {s.starts_at?.slice(0, 5)}–{s.ends_at?.slice(0, 5)}{s.room ? ` · ${s.room}` : ''}
                                </p>
                              </div>
                              <DeleteButton onClick={() => remove(() => schoolOpsService.deleteTimetableSlot(s.id))} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
          )}

          {/* Resources */}
          {tab === 'resources' && (
            resources.length === 0
              ? <Empty label="No bookable resources yet." />
              : <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {resources.map(r => (
                    <li key={r.id} className="px-6 py-4 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{r.name}</p>
                          <Pill tone="slate">{r.kind}</Pill>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                          {[r.location, r.capacity ? `Capacity ${r.capacity}` : null, `Qty ${r.quantity}`]
                            .filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
          )}

          {/* Custom roles */}
          {tab === 'roles' && (
            roles.length === 0
              ? <Empty label="No custom roles defined. The built-in roles still apply." />
              : <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {roles.map(r => (
                    <li key={r.id} className="px-6 py-4 flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{r.name}</p>
                          <Pill tone="slate">{r.assigned_count ?? 0} assigned</Pill>
                        </div>
                        {r.description && <p className="text-sm text-slate-500 mt-1">{r.description}</p>}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(r.permissions || []).map(p => (
                            <span key={p} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 font-mono">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                      <DeleteButton onClick={() => remove(() => schoolOpsService.deleteCustomRole(r.id))} />
                    </li>
                  ))}
                </ul>
          )}
        </Card>
      )}

      {/* Create form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-8 rounded-[2rem] border-none space-y-5 max-h-[88vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              New {TABS.find(t => t.key === tab)?.label.replace(/s$/, '').toLowerCase()}
            </h3>

            <div className="space-y-3">
              {tab === 'announcements' && (
                <>
                  <Field label="Title"><input className={inputClass} value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></Field>
                  <Field label="Message">
                    <textarea rows={4} className={inputClass + ' h-auto py-3 resize-y'} value={form.body || ''} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
                  </Field>
                  <Field label="Audience">
                    <select className={inputClass} value={form.audience || 'tenant'} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}>
                      <option value="tenant">Whole institution</option>
                      <option value="students">Students</option>
                      <option value="teachers">Teachers</option>
                      <option value="guardians">Parents & guardians</option>
                      <option value="class">A single class</option>
                    </select>
                  </Field>
                  {form.audience === 'class' && (
                    <Field label="Class">
                      <select className={inputClass} value={form.class_id || ''} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
                        <option value="">Select a class</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </Field>
                  )}
                  <Field label="Priority">
                    <select className={inputClass} value={form.priority || 'normal'} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="normal">Normal</option>
                      <option value="important">Important</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </Field>
                </>
              )}

              {tab === 'events' && (
                <>
                  <Field label="Title"><input className={inputClass} value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></Field>
                  <Field label="Category">
                    <select className={inputClass} value={form.category || 'general'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {['general', 'parents_evening', 'exam', 'trip', 'sports', 'holiday', 'inset'].map(c => (
                        <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Starts"><input type="datetime-local" className={inputClass} value={form.starts_at || ''} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} /></Field>
                  <Field label="Ends (optional)"><input type="datetime-local" className={inputClass} value={form.ends_at || ''} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} /></Field>
                  <Field label="Location"><input className={inputClass} value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></Field>
                </>
              )}

              {tab === 'timetable' && (
                <>
                  <Field label="Class">
                    <select className={inputClass} value={form.class_id || ''} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
                      <option value="">Select a class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Day">
                    <select className={inputClass} value={form.day_of_week ?? 1} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))}>
                      {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Starts"><input type="time" className={inputClass} value={form.starts_at || ''} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} /></Field>
                    <Field label="Ends"><input type="time" className={inputClass} value={form.ends_at || ''} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} /></Field>
                  </div>
                  <Field label="Room"><input className={inputClass} value={form.room || ''} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="Lab 3" /></Field>
                  <p className="text-xs text-slate-400 font-semibold">
                    Booking a room that is already taken at that time will be rejected.
                  </p>
                </>
              )}

              {tab === 'resources' && (
                <>
                  <Field label="Name"><input className={inputClass} value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Projector A" /></Field>
                  <Field label="Kind">
                    <select className={inputClass} value={form.kind || 'equipment'} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}>
                      {['room', 'equipment', 'vehicle', 'other'].map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </Field>
                  <Field label="Location"><input className={inputClass} value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Capacity"><input type="number" className={inputClass} value={form.capacity || ''} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} /></Field>
                    <Field label="Quantity"><input type="number" className={inputClass} value={form.quantity || '1'} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></Field>
                  </div>
                </>
              )}

              {tab === 'roles' && (
                <>
                  <Field label="Role name"><input className={inputClass} value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Department Head" /></Field>
                  <Field label="Description"><input className={inputClass} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
                  <Field label="Permissions">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                      {AVAILABLE_PERMISSIONS.map(perm => {
                        const on = (form.permissions || []).includes(perm);
                        return (
                          <button
                            key={perm}
                            type="button"
                            onClick={() => togglePermission(perm)}
                            className={cn(
                              'flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                              on ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                                 : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            )}
                          >
                            <div className={cn(
                              'w-4 h-4 rounded flex-none border-2 flex items-center justify-center',
                              on ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'
                            )}>
                              {on && <span className="text-white text-[9px] font-black">✓</span>}
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono truncate">{perm}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1 rounded-xl h-12 font-bold">Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit() || submitting} className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold">
                {submitting ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const Pill: React.FC<{ tone: 'red' | 'amber' | 'slate'; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={cn(
    'px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide',
    tone === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
      : tone === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  )}>
    {children}
  </span>
);

const Empty: React.FC<{ label: string }> = ({ label }) => (
  <p className="p-12 text-center text-slate-500 font-medium">{label}</p>
);

const DeleteButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="text-slate-300 hover:text-red-500 transition-colors p-1.5 flex-none cursor-pointer" aria-label="Delete">
    <Trash2 size={15} />
  </button>
);

export default SchoolOps;
