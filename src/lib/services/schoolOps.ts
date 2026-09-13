import { nexus } from '../nexus';
import type {
  Announcement,
  SchoolEvent,
  TimetableSlot,
  SchoolResource,
  ResourceBooking,
  LessonPlan,
  CurriculumStandard,
  BehaviourLog,
  TodoItem,
  CustomRole
} from '../../types/school';

/**
 * Day-to-day school operations: announcements, calendar, timetable, bookable
 * resources, lesson planning, pastoral records, tasks and custom roles.
 *
 * Grouped in one service because each surface is small and they are almost
 * always loaded together by an admin dashboard.
 */

const nameOf = (p: any) => p?.full_name || p?.email || 'Unknown';

/** Attach author display names to any rows carrying an author-ish column. */
async function withAuthorNames<T extends Record<string, any>>(
  rows: T[],
  idKey: keyof T,
  nameKey: string
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const ids = Array.from(new Set(rows.map(r => r[idKey]).filter(Boolean)));
  if (ids.length === 0) return rows;

  const { data } = await nexus.database
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ids as string[]);

  const byId = new Map<string, any>();
  ((data || []) as any[]).forEach(p => byId.set(p.id, p));
  return rows.map(r => ({ ...r, [nameKey]: nameOf(byId.get(r[idKey])) }));
}

export const schoolOpsService = {
  // ─── Announcements ──────────────────────────────────────────────────────

  async listAnnouncements(tenantId: string, opts?: { classId?: string; limit?: number }): Promise<Announcement[]> {
    let query = nexus.database
      .from('announcements')
      .select('*')
      .eq('tenant_id', tenantId)
      .lte('publish_at', new Date().toISOString());

    if (opts?.classId) query = query.eq('class_id', opts.classId);

    const { data, error } = await query
      .order('pinned', { ascending: false })
      .order('publish_at', { ascending: false })
      .limit(opts?.limit ?? 50);

    if (error) throw new Error(`Could not load announcements: ${error.message}`);

    // Expired posts are filtered here rather than in SQL so a null expiry
    // (meaning "never expires") is handled the same way in every caller.
    const now = Date.now();
    const live = ((data || []) as Announcement[]).filter(
      a => !a.expires_at || new Date(a.expires_at).getTime() > now
    );
    return withAuthorNames(live, 'author_id', 'author_name');
  },

  async createAnnouncement(payload: Partial<Announcement> & {
    tenant_id: string; author_id: string; title: string; body: string;
  }): Promise<Announcement> {
    const { data, error } = await nexus.database
      .from('announcements')
      .insert([{
        ...payload,
        audience: payload.audience || 'tenant',
        priority: payload.priority || 'normal',
        publish_at: payload.publish_at || new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw new Error(`Could not publish announcement: ${error.message}`);
    return data as Announcement;
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const { error } = await nexus.database.from('announcements').delete().eq('id', id);
    if (error) throw new Error(`Could not delete announcement: ${error.message}`);
  },

  // ─── Events ─────────────────────────────────────────────────────────────

  async listEvents(tenantId: string, fromDate?: string): Promise<SchoolEvent[]> {
    const { data, error } = await nexus.database
      .from('school_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('starts_at', fromDate || new Date().toISOString())
      .order('starts_at', { ascending: true });

    if (error) throw new Error(`Could not load events: ${error.message}`);
    return (data || []) as SchoolEvent[];
  },

  async createEvent(payload: Partial<SchoolEvent> & {
    tenant_id: string; organiser_id: string; title: string; starts_at: string;
  }): Promise<SchoolEvent> {
    const { data, error } = await nexus.database
      .from('school_events')
      .insert([{ ...payload, category: payload.category || 'general', audience: payload.audience || 'tenant' }])
      .select()
      .single();
    if (error) throw new Error(`Could not create event: ${error.message}`);
    return data as SchoolEvent;
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await nexus.database.from('school_events').delete().eq('id', id);
    if (error) throw new Error(`Could not delete event: ${error.message}`);
  },

  async rsvp(eventId: string, userId: string, response: 'yes' | 'no' | 'maybe'): Promise<void> {
    const { data: existing } = await nexus.database
      .from('event_rsvps').select('id').eq('event_id', eventId).eq('user_id', userId).maybeSingle();

    const { error } = existing
      ? await nexus.database.from('event_rsvps').update({ response }).eq('id', (existing as any).id)
      : await nexus.database.from('event_rsvps').insert([{ event_id: eventId, user_id: userId, response }]);

    if (error) throw new Error(`Could not save your response: ${error.message}`);
  },

  // ─── Timetable ──────────────────────────────────────────────────────────

  async getTimetable(tenantId: string, opts?: { classId?: string; teacherId?: string }): Promise<TimetableSlot[]> {
    let query = nexus.database.from('timetable_slots').select('*').eq('tenant_id', tenantId);
    if (opts?.classId) query = query.eq('class_id', opts.classId);
    if (opts?.teacherId) query = query.eq('teacher_id', opts.teacherId);

    const { data, error } = await query
      .order('day_of_week', { ascending: true })
      .order('starts_at', { ascending: true });

    if (error) throw new Error(`Could not load the timetable: ${error.message}`);
    const slots = (data || []) as TimetableSlot[];
    if (slots.length === 0) return [];

    const { data: classes } = await nexus.database
      .from('classes')
      .select('id, name')
      .in('id', Array.from(new Set(slots.map(s => s.class_id))));

    const classNames = new Map<string, string>();
    ((classes || []) as any[]).forEach(c => classNames.set(c.id, c.name));

    const withClass = slots.map(s => ({ ...s, class_name: classNames.get(s.class_id) }));
    return withAuthorNames(withClass, 'teacher_id' as any, 'teacher_name');
  },

  /**
   * Add a timetable slot. The database rejects a room clash via an EXCLUDE
   * constraint; this turns that into a message a timetabler can act on.
   */
  async addTimetableSlot(payload: Partial<TimetableSlot> & {
    tenant_id: string; class_id: string; day_of_week: number; starts_at: string; ends_at: string;
  }): Promise<TimetableSlot> {
    const { data, error } = await nexus.database
      .from('timetable_slots')
      .insert([payload])
      .select()
      .single();

    if (error) {
      if (/timetable_no_room_clash|exclusion|conflict/i.test(error.message)) {
        throw new Error(`Room ${payload.room} is already booked for that time. Choose another room or slot.`);
      }
      throw new Error(`Could not add timetable slot: ${error.message}`);
    }
    return data as TimetableSlot;
  },

  async deleteTimetableSlot(id: string): Promise<void> {
    const { error } = await nexus.database.from('timetable_slots').delete().eq('id', id);
    if (error) throw new Error(`Could not remove that slot: ${error.message}`);
  },

  // ─── Resources ──────────────────────────────────────────────────────────

  async listResources(tenantId: string): Promise<SchoolResource[]> {
    const { data, error } = await nexus.database
      .from('school_resources')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw new Error(`Could not load resources: ${error.message}`);
    return (data || []) as SchoolResource[];
  },

  async createResource(payload: Partial<SchoolResource> & { tenant_id: string; name: string }): Promise<SchoolResource> {
    const { data, error } = await nexus.database
      .from('school_resources')
      .insert([{ ...payload, kind: payload.kind || 'equipment' }])
      .select()
      .single();
    if (error) throw new Error(`Could not add resource: ${error.message}`);
    return data as SchoolResource;
  },

  async listBookings(tenantId: string, fromDate?: string): Promise<ResourceBooking[]> {
    const { data, error } = await nexus.database
      .from('resource_bookings')
      .select('*')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .gte('starts_at', fromDate || new Date().toISOString())
      .order('starts_at', { ascending: true });

    if (error) throw new Error(`Could not load bookings: ${error.message}`);
    const bookings = (data || []) as ResourceBooking[];
    if (bookings.length === 0) return [];

    const { data: resources } = await nexus.database
      .from('school_resources')
      .select('id, name')
      .in('id', Array.from(new Set(bookings.map(b => b.resource_id))));

    const resourceNames = new Map<string, string>();
    ((resources || []) as any[]).forEach(r => resourceNames.set(r.id, r.name));

    const named = bookings.map(b => ({ ...b, resource_name: resourceNames.get(b.resource_id) }));
    return withAuthorNames(named, 'booked_by', 'booked_by_name');
  },

  async bookResource(payload: Partial<ResourceBooking> & {
    tenant_id: string; resource_id: string; booked_by: string; starts_at: string; ends_at: string;
  }): Promise<ResourceBooking> {
    const { data, error } = await nexus.database
      .from('resource_bookings')
      .insert([{ ...payload, status: payload.status || 'confirmed' }])
      .select()
      .single();

    if (error) {
      if (/resource_no_double_booking|exclusion|conflict/i.test(error.message)) {
        throw new Error('That resource is already booked for the time you selected.');
      }
      throw new Error(`Could not book that resource: ${error.message}`);
    }
    return data as ResourceBooking;
  },

  async cancelBooking(id: string): Promise<void> {
    const { error } = await nexus.database
      .from('resource_bookings').update({ status: 'cancelled' }).eq('id', id);
    if (error) throw new Error(`Could not cancel that booking: ${error.message}`);
  },

  // ─── Lesson plans ───────────────────────────────────────────────────────

  async listLessonPlans(tenantId: string, authorId?: string): Promise<LessonPlan[]> {
    let query = nexus.database.from('lesson_plans').select('*').eq('tenant_id', tenantId);
    if (authorId) query = query.eq('author_id', authorId);
    const { data, error } = await query.order('planned_for', { ascending: false });
    if (error) throw new Error(`Could not load lesson plans: ${error.message}`);
    return (data || []) as LessonPlan[];
  },

  async saveLessonPlan(payload: Partial<LessonPlan> & {
    tenant_id: string; author_id: string; title: string;
  }): Promise<LessonPlan> {
    const row = {
      ...payload,
      objectives: payload.objectives || [],
      materials: payload.materials || [],
      activities: payload.activities || [],
      standard_ids: payload.standard_ids || [],
      updated_at: new Date().toISOString()
    };

    const { data, error } = payload.id
      ? await nexus.database.from('lesson_plans').update(row).eq('id', payload.id).select().single()
      : await nexus.database.from('lesson_plans').insert([row]).select().single();

    if (error) throw new Error(`Could not save lesson plan: ${error.message}`);
    return data as LessonPlan;
  },

  async deleteLessonPlan(id: string): Promise<void> {
    const { error } = await nexus.database.from('lesson_plans').delete().eq('id', id);
    if (error) throw new Error(`Could not delete lesson plan: ${error.message}`);
  },

  // ─── Curriculum standards ───────────────────────────────────────────────

  async listStandards(tenantId: string, framework?: string): Promise<CurriculumStandard[]> {
    let query = nexus.database.from('curriculum_standards').select('*').eq('tenant_id', tenantId);
    if (framework) query = query.eq('framework', framework);
    const { data, error } = await query.order('code', { ascending: true });
    if (error) throw new Error(`Could not load standards: ${error.message}`);
    return (data || []) as CurriculumStandard[];
  },

  async alignStandard(standardId: string, targetType: string, targetId: string): Promise<void> {
    const { error } = await nexus.database
      .from('standard_alignments')
      .insert([{ standard_id: standardId, target_type: targetType, target_id: targetId }]);
    // A repeat alignment is a no-op, not an error worth surfacing.
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(`Could not align standard: ${error.message}`);
    }
  },

  async getAlignments(targetType: string, targetId: string): Promise<CurriculumStandard[]> {
    const { data } = await nexus.database
      .from('standard_alignments')
      .select('standard_id')
      .eq('target_type', targetType)
      .eq('target_id', targetId);

    const ids = ((data || []) as any[]).map(a => a.standard_id);
    if (ids.length === 0) return [];

    const { data: standards } = await nexus.database
      .from('curriculum_standards').select('*').in('id', ids);
    return (standards || []) as CurriculumStandard[];
  },

  // ─── Behaviour & wellbeing ──────────────────────────────────────────────

  async listBehaviourLogs(opts: { studentId?: string; classId?: string; limit?: number }): Promise<BehaviourLog[]> {
    let query = nexus.database.from('behaviour_logs').select('*');
    if (opts.studentId) query = query.eq('student_id', opts.studentId);
    if (opts.classId) query = query.eq('class_id', opts.classId);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 100);

    if (error) throw new Error(`Could not load records: ${error.message}`);
    const logs = (data || []) as BehaviourLog[];
    const withStudent = await withAuthorNames(logs, 'student_id', 'student_name');
    return withAuthorNames(withStudent, 'logged_by', 'logged_by_name');
  },

  async logBehaviour(payload: Partial<BehaviourLog> & {
    tenant_id: string; student_id: string; logged_by: string; title: string;
  }): Promise<BehaviourLog> {
    const { data, error } = await nexus.database
      .from('behaviour_logs')
      .insert([{ ...payload, kind: payload.kind || 'note', severity: payload.severity || 'low' }])
      .select()
      .single();
    if (error) throw new Error(`Could not save that record: ${error.message}`);
    return data as BehaviourLog;
  },

  async resolveBehaviourLog(id: string): Promise<void> {
    const { error } = await nexus.database
      .from('behaviour_logs').update({ resolved_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(`Could not close that record: ${error.message}`);
  },

  // ─── To-do ──────────────────────────────────────────────────────────────

  async listTodos(userId: string, includeCompleted = false): Promise<TodoItem[]> {
    let query = nexus.database.from('todo_items').select('*').eq('user_id', userId);
    if (!includeCompleted) query = query.is('completed_at', null);
    const { data, error } = await query.order('due_at', { ascending: true });
    if (error) throw new Error(`Could not load your tasks: ${error.message}`);
    return (data || []) as TodoItem[];
  },

  async addTodo(payload: { tenant_id: string; user_id: string; title: string; detail?: string; due_at?: string; link_to?: string }): Promise<TodoItem> {
    const { data, error } = await nexus.database
      .from('todo_items').insert([{ ...payload, source: 'manual' }]).select().single();
    if (error) throw new Error(`Could not add task: ${error.message}`);
    return data as TodoItem;
  },

  async toggleTodo(id: string, done: boolean): Promise<void> {
    const { error } = await nexus.database
      .from('todo_items')
      .update({ completed_at: done ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) throw new Error(`Could not update task: ${error.message}`);
  },

  async deleteTodo(id: string): Promise<void> {
    const { error } = await nexus.database.from('todo_items').delete().eq('id', id);
    if (error) throw new Error(`Could not delete task: ${error.message}`);
  },

  /**
   * Tasks derived from live data — due assignments for a student, unmarked
   * submissions for a teacher. Computed rather than stored so they cannot go
   * stale, and merged with the user's own manual list by the caller.
   */
  async getDerivedTodos(userId: string, role: 'student' | 'teacher'): Promise<TodoItem[]> {
    const now = new Date();
    const soon = new Date(Date.now() + 14 * 86_400_000);

    if (role === 'student') {
      const { data: memberRows } = await nexus.database
        .from('class_members').select('class_id').eq('user_id', userId).is('left_at', null);
      const classIds = ((memberRows || []) as any[]).map(r => r.class_id);
      if (classIds.length === 0) return [];

      const { data: assignments } = await nexus.database
        .from('assignments')
        .select('id, title, due_at')
        .in('class_id', classIds)
        .eq('status', 'published')
        .gte('due_at', now.toISOString())
        .lte('due_at', soon.toISOString());

      const list = (assignments || []) as any[];
      if (list.length === 0) return [];

      const { data: subs } = await nexus.database
        .from('assignment_submissions')
        .select('assignment_id, status')
        .eq('student_id', userId)
        .in('assignment_id', list.map(a => a.id));

      const done = new Set(
        ((subs || []) as any[]).filter(s => s.status !== 'draft').map(s => s.assignment_id)
      );

      return list
        .filter(a => !done.has(a.id))
        .map(a => ({
          id: `derived-assignment-${a.id}`,
          tenant_id: '',
          user_id: userId,
          title: `Submit: ${a.title}`,
          detail: null,
          source: 'system' as const,
          link_to: `/assignments?id=${a.id}`,
          due_at: a.due_at,
          completed_at: null,
          created_at: now.toISOString()
        }));
    }

    // Teacher: anything submitted and not yet marked.
    const { data: assignments } = await nexus.database
      .from('assignments').select('id, title').eq('teacher_id', userId);
    const ids = ((assignments || []) as any[]).map(a => a.id);
    if (ids.length === 0) return [];

    const titles = new Map<string, string>();
    ((assignments || []) as any[]).forEach(a => titles.set(a.id, a.title));

    const { data: subs } = await nexus.database
      .from('assignment_submissions')
      .select('assignment_id, status')
      .in('assignment_id', ids)
      .in('status', ['submitted', 'late']);

    const pending = new Map<string, number>();
    ((subs || []) as any[]).forEach(s => pending.set(s.assignment_id, (pending.get(s.assignment_id) || 0) + 1));

    return Array.from(pending.entries()).map(([assignmentId, count]) => ({
      id: `derived-grading-${assignmentId}`,
      tenant_id: '',
      user_id: userId,
      title: `Mark ${count} submission${count === 1 ? '' : 's'}: ${titles.get(assignmentId)}`,
      detail: null,
      source: 'system' as const,
      link_to: `/assignments?grade=${assignmentId}`,
      due_at: null,
      completed_at: null,
      created_at: now.toISOString()
    }));
  },

  // ─── Custom roles ───────────────────────────────────────────────────────

  async listCustomRoles(tenantId: string): Promise<CustomRole[]> {
    const { data, error } = await nexus.database
      .from('custom_roles').select('*').eq('tenant_id', tenantId).order('name');
    if (error) throw new Error(`Could not load roles: ${error.message}`);

    const roles = (data || []) as CustomRole[];
    if (roles.length === 0) return [];

    const { data: assignments } = await nexus.database
      .from('custom_role_assignments')
      .select('custom_role_id')
      .in('custom_role_id', roles.map(r => r.id));

    const counts = new Map<string, number>();
    ((assignments || []) as any[]).forEach(a =>
      counts.set(a.custom_role_id, (counts.get(a.custom_role_id) || 0) + 1)
    );

    return roles.map(r => ({ ...r, assigned_count: counts.get(r.id) || 0 }));
  },

  async createCustomRole(payload: {
    tenant_id: string; name: string; description?: string; base_role?: string; permissions: string[];
  }): Promise<CustomRole> {
    const { data, error } = await nexus.database
      .from('custom_roles')
      .insert([{ ...payload, base_role: payload.base_role || 'mentee' }])
      .select()
      .single();

    if (error) {
      throw new Error(
        /duplicate|unique/i.test(error.message)
          ? `A role called "${payload.name}" already exists.`
          : `Could not create role: ${error.message}`
      );
    }
    return data as CustomRole;
  },

  async updateCustomRole(id: string, updates: Partial<CustomRole>): Promise<void> {
    const { error } = await nexus.database.from('custom_roles').update(updates).eq('id', id);
    if (error) throw new Error(`Could not update role: ${error.message}`);
  },

  async deleteCustomRole(id: string): Promise<void> {
    const { error } = await nexus.database.from('custom_roles').delete().eq('id', id);
    if (error) throw new Error(`Could not delete role: ${error.message}`);
  },

  async assignCustomRole(roleId: string, userId: string): Promise<void> {
    const { error } = await nexus.database
      .from('custom_role_assignments')
      .insert([{ custom_role_id: roleId, user_id: userId }]);
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(`Could not assign role: ${error.message}`);
    }
  },

  /** Permissions granted to a user through every custom role they hold. */
  async getUserPermissions(userId: string): Promise<string[]> {
    const { data: assignments } = await nexus.database
      .from('custom_role_assignments').select('custom_role_id').eq('user_id', userId);

    const roleIds = ((assignments || []) as any[]).map(a => a.custom_role_id);
    if (roleIds.length === 0) return [];

    const { data: roles } = await nexus.database
      .from('custom_roles').select('permissions').in('id', roleIds);

    const perms = new Set<string>();
    ((roles || []) as any[]).forEach(r =>
      (Array.isArray(r.permissions) ? r.permissions : []).forEach((p: string) => perms.add(p))
    );
    return Array.from(perms);
  }
};
