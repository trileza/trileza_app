import { nexus } from '../nexus';
import { classService } from './classes';
import { gradebookService } from './gradebook';
import type { GuardianLink, ChildOverview, GradeEntry } from '../../types/school';

/**
 * Guardian links and the data behind the parent portal.
 *
 * A guardian is an ordinary profile with role 'guardian'; this service manages
 * the link rows that say which children they may see. Links are created by
 * school staff only — a parent cannot attach themselves to a child, which the
 * RLS policy on guardian_links enforces independently of this code.
 */

const nameOf = (p: any) => p?.full_name || p?.email || 'Unknown';

export const guardianService = {
  /** Children this guardian is approved to see. */
  async getChildren(guardianId: string): Promise<GuardianLink[]> {
    const { data, error } = await nexus.database
      .from('guardian_links')
      .select('*')
      .eq('guardian_id', guardianId)
      .eq('status', 'active');

    if (error) throw new Error(`Could not load your children: ${error.message}`);
    const links = (data || []) as GuardianLink[];
    if (links.length === 0) return [];

    const { data: profiles } = await nexus.database
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', links.map(l => l.student_id));

    const byId = new Map<string, any>();
    ((profiles || []) as any[]).forEach(p => byId.set(p.id, p));

    return links.map(l => ({
      ...l,
      student_name: nameOf(byId.get(l.student_id)),
      student_avatar: byId.get(l.student_id)?.avatar_url ?? null
    }));
  },

  /** Guardians attached to a student, for the school's own records. */
  async getGuardiansOf(studentId: string): Promise<GuardianLink[]> {
    const { data, error } = await nexus.database
      .from('guardian_links')
      .select('*')
      .eq('student_id', studentId);

    if (error) throw new Error(`Could not load guardians: ${error.message}`);
    const links = (data || []) as GuardianLink[];
    if (links.length === 0) return [];

    const { data: profiles } = await nexus.database
      .from('profiles')
      .select('id, full_name, email')
      .in('id', links.map(l => l.guardian_id));

    const byId = new Map<string, any>();
    ((profiles || []) as any[]).forEach(p => byId.set(p.id, p));

    return links.map(l => ({
      ...l,
      guardian_name: nameOf(byId.get(l.guardian_id)),
      guardian_email: byId.get(l.guardian_id)?.email
    }));
  },

  async linkGuardian(params: {
    tenantId: string;
    guardianId: string;
    studentId: string;
    relationship?: GuardianLink['relationship'];
    isPrimary?: boolean;
  }): Promise<GuardianLink> {
    const { data, error } = await nexus.database
      .from('guardian_links')
      .insert([{
        tenant_id: params.tenantId,
        guardian_id: params.guardianId,
        student_id: params.studentId,
        relationship: params.relationship || 'parent',
        is_primary: params.isPrimary ?? false,
        status: 'active'
      }])
      .select()
      .single();

    if (error) {
      throw new Error(
        /duplicate|unique/i.test(error.message)
          ? 'That guardian is already linked to this student.'
          : `Could not link guardian: ${error.message}`
      );
    }
    return data as GuardianLink;
  },

  async revokeLink(linkId: string): Promise<void> {
    const { error } = await nexus.database
      .from('guardian_links')
      .update({ status: 'revoked' })
      .eq('id', linkId);
    if (error) throw new Error(`Could not revoke access: ${error.message}`);
  },

  async updatePermissions(
    linkId: string,
    perms: { can_view_grades?: boolean; can_view_attendance?: boolean }
  ): Promise<void> {
    const { error } = await nexus.database
      .from('guardian_links')
      .update(perms)
      .eq('id', linkId);
    if (error) throw new Error(`Could not update permissions: ${error.message}`);
  },

  /**
   * Everything the portal shows for one child. Respects the per-link
   * permissions: a guardian without can_view_grades gets null there rather
   * than a number, so the UI can say why the panel is empty.
   */
  async getChildOverview(link: GuardianLink): Promise<ChildOverview> {
    const studentId = link.student_id;

    const classes = await classService.listClassesForUser(studentId);

    const [attendancePct, average, gradesRes] = await Promise.all([
      link.can_view_attendance ? classService.getStudentAttendanceRate(studentId) : Promise.resolve(null),
      link.can_view_grades ? gradebookService.getStudentAverage(studentId) : Promise.resolve(null),
      link.can_view_grades
        ? nexus.database
            .from('grade_entries')
            .select('*')
            .eq('student_id', studentId)
            .order('recorded_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as any[] })
    ]);

    // Upcoming work across all their classes.
    const classIds = classes.map(c => c.id);
    let upcoming: ChildOverview['upcoming'] = [];
    if (classIds.length > 0) {
      const { data: assignments } = await nexus.database
        .from('assignments')
        .select('id, title, due_at, class_id')
        .in('class_id', classIds)
        .eq('status', 'published')
        .gte('due_at', new Date().toISOString())
        .order('due_at', { ascending: true })
        .limit(5);

      const classNames = new Map(classes.map(c => [c.id, c.name]));
      upcoming = ((assignments || []) as any[]).map(a => ({
        id: a.id,
        title: a.title,
        due_at: a.due_at,
        class_name: classNames.get(a.class_id)
      }));
    }

    const recentGrades = ((gradesRes.data || []) as GradeEntry[]).map(g => ({
      label: g.item_label,
      score: g.score === null || g.score === undefined ? null : Number(g.score),
      points_possible: Number(g.points_possible || 100),
      recorded_at: g.recorded_at
    }));

    return {
      student_id: studentId,
      student_name: link.student_name || 'Student',
      avatar_url: link.student_avatar ?? null,
      classes: classes.map(c => ({ id: c.id, name: c.name, teacher: c.lead_teacher_name })),
      attendance_pct: attendancePct,
      average_grade_pct: average,
      upcoming,
      recent_grades: recentGrades
    };
  }
};
