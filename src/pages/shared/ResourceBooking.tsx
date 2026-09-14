import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, X, Loader2, AlertTriangle, MapPin, CalendarClock, Ban
} from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { Card, Button } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useTenant } from '../../lib/tenantContext';
import { schoolOpsService } from '../../lib/services/schoolOps';
import { classService } from '../../lib/services/classes';
import type { SchoolResource, ResourceBooking as Booking, SchoolClass } from '../../types/school';
import { cn } from '../../utils';

const inputClass =
  'w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-500';

const KIND_ICON: Record<SchoolResource['kind'], string> = {
  room: '🚪', equipment: '📦', vehicle: '🚌', other: '🔧'
};

const formatSlot = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${s.toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `${s.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} → ${e.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
};

/**
 * Booking rooms, equipment and vehicles.
 *
 * Double-booking is rejected by an EXCLUDE constraint in the database, so two
 * people submitting the same slot at the same moment cannot both succeed — the
 * loser gets a clear message rather than a silent overwrite.
 */
const ResourceBooking: React.FC = () => {
  const { user } = useAuthStore();
  const { tenant } = useTenant();

  const [resources, setResources] = useState<SchoolResource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [booking, setBooking] = useState<SchoolResource | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [res, bks, cls] = await Promise.all([
        schoolOpsService.listResources(tenant.id),
        schoolOpsService.listBookings(tenant.id),
        classService.listClasses(tenant.id).catch(() => [])
      ]);
      setResources(res);
      setBookings(bks);
      setClasses(cls);
    } catch (err: any) {
      setError(err.message || 'Could not load resources.');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => { load(); }, [load]);

  const submitBooking = async () => {
    if (!booking || !tenant?.id || !user?.id) return;
    if (!form.starts_at || !form.ends_at) return;

    const start = new Date(form.starts_at);
    const end = new Date(form.ends_at);
    if (end <= start) {
      setError('The end time must be after the start time.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await schoolOpsService.bookResource({
        tenant_id: tenant.id,
        resource_id: booking.id,
        booked_by: user.id,
        class_id: form.class_id || null,
        purpose: form.purpose || null,
        starts_at: start.toISOString(),
        ends_at: end.toISOString()
      });
      setNotice(`${booking.name} booked.`);
      setBooking(null);
      setForm({});
      load();
    } catch (err: any) {
      setError(err.message || 'Could not book that resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (b: Booking) => {
    try {
      await schoolOpsService.cancelBooking(b.id);
      setNotice('Booking cancelled.');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const bookingsFor = (resourceId: string) =>
    bookings.filter(b => b.resource_id === resourceId);

  return (
    <div className="w-full pb-20 space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={<span>Resource <span className="text-emerald-400">Booking</span></span>}
        description="Reserve rooms, equipment and vehicles. Clashes are rejected automatically."
        tag="School operations"
        icon={Package}
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

      {loading ? (
        <Card className="p-12 rounded-[2.5rem] border-none flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="font-bold text-slate-500">Loading resources…</span>
        </Card>
      ) : resources.length === 0 ? (
        <Card className="p-12 rounded-[2.5rem] border-none text-center">
          <Package size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-black text-slate-900 dark:text-white">No bookable resources</h3>
          <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
            An administrator adds rooms and equipment under School Operations → Resources.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {resources.map(r => {
            const upcoming = bookingsFor(r.id);
            return (
              <Card key={r.id} className="p-6 rounded-[2rem] border-none shadow-lg flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-none" aria-hidden="true">{KIND_ICON[r.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-slate-900 dark:text-white truncate">{r.name}</h4>
                    <p className="text-xs font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                      {r.location && <><MapPin size={11} /> {r.location}</>}
                      {r.capacity ? ` · Seats ${r.capacity}` : ''}
                    </p>
                  </div>
                </div>

                {upcoming.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Booked</p>
                    <ul className="space-y-1 max-h-28 overflow-y-auto">
                      {upcoming.slice(0, 4).map(b => (
                        <li key={b.id} className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-700 dark:text-slate-300 truncate tabular-nums">
                              {formatSlot(b.starts_at, b.ends_at)}
                            </p>
                            <p className="text-slate-400 font-semibold truncate">{b.booked_by_name}</p>
                          </div>
                          {b.booked_by === user?.id && (
                            <button
                              onClick={() => cancel(b)}
                              className="text-slate-300 hover:text-red-500 flex-none cursor-pointer"
                              aria-label="Cancel booking"
                              title="Cancel this booking"
                            >
                              <Ban size={13} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  onClick={() => { setBooking(r); setForm({}); setError(null); }}
                  className="mt-auto w-full rounded-2xl h-11 bg-brand-primary text-white border-none font-black uppercase text-[10px] tracking-widest gap-2"
                >
                  <Plus size={13} /> Book
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Booking form */}
      {booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-8 rounded-[2rem] border-none space-y-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Book {booking.name}</h3>
              {booking.location && (
                <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1">
                  <MapPin size={11} /> {booking.location}
                </p>
              )}
            </div>

            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From</span>
              <input
                type="datetime-local"
                className={inputClass + ' mt-1'}
                value={form.starts_at || ''}
                onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To</span>
              <input
                type="datetime-local"
                className={inputClass + ' mt-1'}
                value={form.ends_at || ''}
                onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))}
              />
            </label>

            {classes.length > 0 && (
              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">For a class (optional)</span>
                <select className={inputClass + ' mt-1'} value={form.class_id || ''} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
                  <option value="">Not class-specific</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose</span>
              <input
                className={inputClass + ' mt-1'}
                value={form.purpose || ''}
                onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                placeholder="Practical assessment"
              />
            </label>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => { setBooking(null); setForm({}); }} className="flex-1 rounded-xl h-12 font-bold">
                Cancel
              </Button>
              <Button
                onClick={submitBooking}
                disabled={!form.starts_at || !form.ends_at || submitting}
                className="flex-1 rounded-xl h-12 bg-brand-primary text-white border-none font-bold gap-2"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />}
                Confirm
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ResourceBooking;
