import { nexus } from '../nexus';
import type {
  SchoolClass,
  ClassMember,
  ClassMemberRole,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary
} from '../../types/school';

/**
 * Classes, rosters and the daily register.
 *
 * A class is the teaching group that attendance, the gradebook and the
 * timetable all hang off. It is deliberately separate from a course: a course
 * is content that many classes can teach from.
 */

/** Below this attendance rate a student is flagged as persistently absent. */
export const PERSISTENT_ABSENCE_THRESHOLD = 90;

const nameOf = (p: any) => p?.full_name || p?.email || 'Unknown';

export const classService = {
  // ─── Classes ────────────────────────────────────────────────────────────

  async listClasses(tenantId: string, opts?: { teacherId?: string; includeArchived?: boolean }): Promise<SchoolClass[]> {
    let query = nexus.database.from('classes').select('*').eq('tenant_id', tenantId);
    if (opts?.teacherId) query = query.eq('lead_teacher_id', opts.teacherId);
    if (!opts?.includeArchived) query = query.eq('status', 'active');

    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw new Error(`Could not load classes: ${error.message}`);

    const classes = (data || []) as SchoolClass[];
    if (classes.length === 0) return [];

    // Roster sizes and teacher names in two queries rather than N+1.
    const [membersRes, teachersRes] = await Promise.all([
      nexus.database.from('class_members').select('class_id, user_id, left_at'),
      nexus.database
        .from('profiles')
        .select('id, full_name, email')
        .in('id', classes.map(c => c.lead_teacher_id).filter(Boolean) as string[])
    ]);

    const counts = new Map<string, number>();
    ((membersRes.data || []) as any[]).forEach(m => {
      if (m.left_at) return;
      counts.set(m.class_id, (counts.get(m.class_id) || 0) + 1);
    });

    const teacherNames = new Map<string, string>();
    ((teachersRes.data || []) as any[]).forEach(p => teacherNames.set(p.id, nameOf(p)));

    return classes.map(c => ({
      ...c,
      member_count: counts.get(c.id) || 0,
      lead_teacher_name: c.lead_teacher_id ? teacherNames.get(c.lead_teacher_id) : undefined
    }));
  },

  /** Classes the given user is enrolled in or teaches. */
  async listClassesForUser(userId: string): Promise<SchoolClass[]> {
    const { data: memberRows, error: memberErr } = await nexus.database
      .from('class_members')
      .select('class_id')
      .eq('user_id', userId)
      .is('left_at', null);

    if (memberErr) throw new Error(`Could not load your classes: ${memberErr.message}`);

    const ids = ((memberRows || []) as any[]).map(r => r.class_id);
    if (ids.length === 0) return [];

    const { data, error } = await nexus.database
      .from('classes')
      .select('*')
      .in('id', ids)
      .eq('status', 'active');

    if (error) throw new Error(`Could not load your classes: ${error.message}`);
    return (data || []) as SchoolClass[];
  },

  async getClass(classId: string): Promise<SchoolClass | null> {
    const { data, error } = await nexus.database
      .from('classes').select('*').eq('id', classId).maybeSingle();
    if (error) throw new Error(`Could not load class: ${error.message}`);
    return (data as SchoolClass) || null;
  },

  async createClass(payload: Partial<SchoolClass> & { tenant_id: string; name: string }): Promise<SchoolClass> {
    const { data, error } = await nexus.database
      .from('classes')
      .insert([{ ...payload, status: payload.status || 'active' }])
      .select()
      .single();
    if (error) throw new Error(`Could not create class: ${error.message}`);
    return data as SchoolClass;
  },

  async updateClass(classId: string, updates: Partial<SchoolClass>): Promise<SchoolClass> {
    const { data, error } = await nexus.database
      .from('classes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', classId)
      .select()
      .single();
    if (error) throw new Error(`Could not update class: ${error.message}`);
    return data as SchoolClass;
  },

  /** Archiving keeps history intact; classes are never hard-deleted by default. */
  async archiveClass(classId: string): Promise<void> {
    await this.updateClass(classId, { status: 'archived' });
  },

  // ─── Roster ─────────────────────────────────────────────────────────────

  async getRoster(classId: string): Promise<ClassMember[]> {
    const { data, error } = await nexus.database
      .from('class_members')
      .select('*')
      .eq('class_id', classId)
      .is('left_at', null);

    if (error) throw new Error(`Could not load roster: ${error.message}`);

    const members = (data || []) as ClassMember[];
    if (members.length === 0) return [];

    const { data: profiles } = await nexus.database
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', members.map(m => m.user_id));

    const byId = new Map<string, any>();
    ((profiles || []) as any[]).forEach(p => byId.set(p.id, p));

    return members
      .map(m => ({
        ...m,
        full_name: nameOf(byId.get(m.user_id)),
        email: byId.get(m.user_id)?.email,
        avatar_url: byId.get(m.user_id)?.avatar_url ?? null
      }))
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  },

  async addMembers(
    classId: string,
    userIds: string[],
    role: ClassMemberRole = 'student'
  ): Promise<{ added: number; skipped: number }> {
    if (userIds.length === 0) return { added: 0, skipped: 0 };

    const { data: existing } = await nexus.database
      .from('class_members')
      .select('user_id')
      .eq('class_id', classId)
      .in('user_id', userIds);

    const already = new Set(((existing || []) as any[]).map(r => r.user_id));
    const toAdd = userIds.filter(id => !already.has(id));
    if (toAdd.length === 0) return { added: 0, skipped: userIds.length };

    const { error } = await nexus.database
      .from('class_members')
      .insert(toAdd.map(user_id => ({ class_id: classId, user_id, role })));

    if (error) throw new Error(`Could not add students: ${error.message}`);
    return { added: toAdd.length, skipped: userIds.length - toAdd.length };
  },

  /** Removing a student stamps left_at so their marks and register stay valid. */
  async removeMember(classId: string, userId: string): Promise<void> {
    const { error } = await nexus.database
      .from('class_members')
      .update({ left_at: new Date().toISOString() })
      .eq('class_id', classId)
      .eq('user_id', userId);
    if (error) throw new Error(`Could not remove student: ${error.message}`);
  },

  // ─── Attendance ─────────────────────────────────────────────────────────

  async getRegister(classId: string, sessionDate: string, period?: string): Promise<AttendanceRecord[]> {
    let query = nexus.database
      .from('attendance_records')
      .select('*')
      .eq('class_id', classId)
      .eq('session_date', sessionDate);

    if (period) query = query.eq('period', period);

    const { data, error } = await query;
    if (error) throw new Error(`Could not load the register: ${error.message}`);
    return (data || []) as AttendanceRecord[];
  },

  /**
   * Save a whole register at once. Existing marks for that date are replaced,
   * so a teacher correcting the register does not create duplicate rows.
   */
  async saveRegister(params: {
    tenantId: string;
    classId: string;
    sessionDate: string;
    period?: string;
    recordedBy: string;
    marks: Array<{ student_id: string; status: AttendanceStatus; minutes_late?: number; note?: string }>;
  }): Promise<number> {
    const { tenantId, classId, sessionDate, period, recordedBy, marks } = params;
    if (marks.length === 0) return 0;

    let del = nexus.database
      .from('attendance_records')
      .delete()
      .eq('class_id', classId)
      .eq('session_date', sessionDate);
    if (period) del = del.eq('period', period);
    await del;

    const { error } = await nexus.database.from('attendance_records').insert(
      marks.map(m => ({
        tenant_id: tenantId,
        class_id: classId,
        student_id: m.student_id,
        session_date: sessionDate,
        period: period || null,
        status: m.status,
        minutes_late: m.minutes_late ?? null,
        note: m.note || null,
        recorded_by: recordedBy,
        recorded_at: new Date().toISOString()
      }))
    );

    if (error) throw new Error(`Could not save the register: ${error.message}`);
    return marks.length;
  },

  /**
   * Attendance rates per student over a date range. `late` counts as present
   * for the percentage — the student was there — but is reported separately.
   */
  async getAttendanceSummary(
    classId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<AttendanceSummary[]> {
    let query = nexus.database.from('attendance_records').select('*').eq('class_id', classId);
    if (fromDate) query = query.gte('session_date', fromDate);
    if (toDate) query = query.lte('session_date', toDate);

    const { data, error } = await query;
    if (error) throw new Error(`Could not load attendance: ${error.message}`);

    const records = (data || []) as AttendanceRecord[];
    const roster = await this.getRoster(classId);
    const students = roster.filter(m => m.role === 'student');

    return students.map(s => {
      const mine = records.filter(r => r.student_id === s.user_id);
      const present = mine.filter(r => r.status === 'present').length;
      const late = mine.filter(r => r.status === 'late').length;
      const absent = mine.filter(r => r.status === 'absent').length;
      const excused = mine.filter(r => r.status === 'excused').length;
      const leftEarly = mine.filter(r => r.status === 'left_early').length;
      const total = mine.length;
      const attended = present + late + leftEarly;
      const pct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 0;

      return {
        student_id: s.user_id,
        student_name: s.full_name || 'Unknown',
        present,
        absent,
        late,
        excused,
        total,
        attendance_pct: pct,
        is_persistently_absent: total >= 5 && pct < PERSISTENT_ABSENCE_THRESHOLD
      };
    });
  },

  /** A single student's attendance rate across every class they are in. */
  async getStudentAttendanceRate(studentId: string): Promise<number | null> {
    const { data, error } = await nexus.database
      .from('attendance_records')
      .select('status')
      .eq('student_id', studentId);

    if (error || !data || data.length === 0) return null;

    const rows = data as Array<{ status: AttendanceStatus }>;
    const attended = rows.filter(
      r => r.status === 'present' || r.status === 'late' || r.status === 'left_early'
    ).length;
    return Number(((attended / rows.length) * 100).toFixed(1));
  }
};
