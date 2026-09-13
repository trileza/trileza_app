import { nexus } from '../nexus';
import type {
  Assignment,
  AssignmentSubmission,
  QuizQuestion,
  Rubric,
  SubmissionStatus
} from '../../types/school';

/**
 * Assignments, submissions and grading.
 *
 * Replaces the previous arrangement, where assignments were pushed into a JSON
 * array on the teacher's own profile row and no submission was ever recorded.
 */

const nameOf = (p: any) => p?.full_name || p?.email || 'Unknown';

/** Marks a quiz against its answer key. Returns null for non-quiz work. */
export const autoGrade = (
  questions: QuizQuestion[],
  answers: number[]
): { score: number; possible: number; perQuestion: boolean[] } | null => {
  if (!questions || questions.length === 0) return null;

  const perQuestion = questions.map((q, i) => answers?.[i] === q.correctOptionIndex);
  const score = questions.reduce(
    (sum, q, i) => sum + (perQuestion[i] ? Number(q.points || 1) : 0),
    0
  );
  const possible = questions.reduce((sum, q) => sum + Number(q.points || 1), 0);
  return { score, possible, perQuestion };
};

export const assignmentService = {
  // ─── Assignments ────────────────────────────────────────────────────────

  async listForTeacher(teacherId: string): Promise<Assignment[]> {
    const { data, error } = await nexus.database
      .from('assignments')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Could not load assignments: ${error.message}`);
    const assignments = (data || []) as Assignment[];
    if (assignments.length === 0) return [];

    // Submission and graded counts in one pass rather than per assignment.
    const { data: subs } = await nexus.database
      .from('assignment_submissions')
      .select('assignment_id, status')
      .in('assignment_id', assignments.map(a => a.id));

    const submitted = new Map<string, number>();
    const graded = new Map<string, number>();
    ((subs || []) as any[]).forEach(s => {
      if (s.status !== 'draft') submitted.set(s.assignment_id, (submitted.get(s.assignment_id) || 0) + 1);
      if (s.status === 'graded' || s.status === 'returned') {
        graded.set(s.assignment_id, (graded.get(s.assignment_id) || 0) + 1);
      }
    });

    return assignments.map(a => ({
      ...a,
      submission_count: submitted.get(a.id) || 0,
      graded_count: graded.get(a.id) || 0
    }));
  },

  /** Published assignments for a student, with their own submission attached. */
  async listForStudent(studentId: string): Promise<Array<Assignment & { submission?: AssignmentSubmission }>> {
    const { data: memberRows } = await nexus.database
      .from('class_members')
      .select('class_id')
      .eq('user_id', studentId)
      .is('left_at', null);

    const classIds = ((memberRows || []) as any[]).map(r => r.class_id);
    if (classIds.length === 0) return [];

    const { data, error } = await nexus.database
      .from('assignments')
      .select('*')
      .in('class_id', classIds)
      .eq('status', 'published')
      .order('due_at', { ascending: true });

    if (error) throw new Error(`Could not load your assignments: ${error.message}`);
    const assignments = (data || []) as Assignment[];
    if (assignments.length === 0) return [];

    const { data: subs } = await nexus.database
      .from('assignment_submissions')
      .select('*')
      .eq('student_id', studentId)
      .in('assignment_id', assignments.map(a => a.id));

    const byAssignment = new Map<string, AssignmentSubmission>();
    ((subs || []) as AssignmentSubmission[]).forEach(s => byAssignment.set(s.assignment_id, s));

    return assignments.map(a => ({ ...a, submission: byAssignment.get(a.id) }));
  },

  async getAssignment(id: string): Promise<Assignment | null> {
    const { data, error } = await nexus.database
      .from('assignments').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Could not load assignment: ${error.message}`);
    return (data as Assignment) || null;
  },

  async createAssignment(payload: Partial<Assignment> & { tenant_id: string; teacher_id: string; title: string }): Promise<Assignment> {
    const { data, error } = await nexus.database
      .from('assignments')
      .insert([{
        ...payload,
        questions: payload.questions || [],
        attachments: payload.attachments || [],
        status: payload.status || 'draft',
        points_possible: payload.points_possible ?? 100
      }])
      .select()
      .single();
    if (error) throw new Error(`Could not create assignment: ${error.message}`);
    return data as Assignment;
  },

  async updateAssignment(id: string, updates: Partial<Assignment>): Promise<Assignment> {
    const { data, error } = await nexus.database
      .from('assignments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Could not update assignment: ${error.message}`);
    return data as Assignment;
  },

  async deleteAssignment(id: string): Promise<void> {
    const { error } = await nexus.database.from('assignments').delete().eq('id', id);
    if (error) throw new Error(`Could not delete assignment: ${error.message}`);
  },

  // ─── Submissions ────────────────────────────────────────────────────────

  /** Every submission for one assignment, with student names for the marking list. */
  async listSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
    const { data, error } = await nexus.database
      .from('assignment_submissions')
      .select('*')
      .eq('assignment_id', assignmentId);

    if (error) throw new Error(`Could not load submissions: ${error.message}`);
    const subs = (data || []) as AssignmentSubmission[];
    if (subs.length === 0) return [];

    const { data: profiles } = await nexus.database
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', subs.map(s => s.student_id));

    const byId = new Map<string, any>();
    ((profiles || []) as any[]).forEach(p => byId.set(p.id, p));

    return subs.map(s => ({
      ...s,
      student_name: nameOf(byId.get(s.student_id)),
      student_avatar: byId.get(s.student_id)?.avatar_url ?? null
    }));
  },

  /**
   * Submit or resubmit. Quizzes are marked immediately; everything else waits
   * for the teacher. Lateness is decided here, against the assignment's due
   * date, so the client clock cannot be used to dodge it.
   */
  async submit(params: {
    assignmentId: string;
    studentId: string;
    tenantId: string;
    body?: string;
    attachments?: Array<{ name: string; url: string }>;
    answers?: number[];
  }): Promise<AssignmentSubmission> {
    const assignment = await this.getAssignment(params.assignmentId);
    if (!assignment) throw new Error('That assignment no longer exists.');
    if (assignment.status !== 'published') throw new Error('That assignment is not open for submissions.');

    const now = new Date();
    const isLate = Boolean(assignment.due_at && now > new Date(assignment.due_at));
    if (isLate && !assignment.allow_late) {
      throw new Error('The deadline has passed and late submissions are not accepted.');
    }

    const auto = assignment.type === 'quiz'
      ? autoGrade(assignment.questions || [], params.answers || [])
      : null;

    let status: SubmissionStatus = isLate ? 'late' : 'submitted';
    if (auto) status = 'graded';

    const row = {
      assignment_id: params.assignmentId,
      student_id: params.studentId,
      tenant_id: params.tenantId,
      status,
      body: params.body || null,
      attachments: params.attachments || [],
      answers: params.answers || [],
      auto_score: auto ? auto.score : null,
      score: auto ? auto.score : null,
      submitted_at: now.toISOString(),
      graded_at: auto ? now.toISOString() : null,
      updated_at: now.toISOString()
    };

    const { data: existing } = await nexus.database
      .from('assignment_submissions')
      .select('id')
      .eq('assignment_id', params.assignmentId)
      .eq('student_id', params.studentId)
      .maybeSingle();

    const { data, error } = existing
      ? await nexus.database.from('assignment_submissions').update(row).eq('id', (existing as any).id).select().single()
      : await nexus.database.from('assignment_submissions').insert([row]).select().single();

    if (error) throw new Error(`Could not submit: ${error.message}`);

    // A marked quiz lands in the gradebook straight away.
    if (auto && assignment.class_id) {
      await gradeToGradebook({
        tenantId: params.tenantId,
        classId: assignment.class_id,
        studentId: params.studentId,
        assignmentId: assignment.id,
        label: assignment.title,
        score: auto.score,
        pointsPossible: auto.possible,
        recordedBy: assignment.teacher_id
      });
    }

    return data as AssignmentSubmission;
  },

  /** Teacher marking: score, written feedback, optional rubric breakdown. */
  async gradeSubmission(params: {
    submissionId: string;
    score: number;
    feedback?: string;
    rubricScores?: Record<string, number>;
    gradedBy: string;
    returnToStudent?: boolean;
  }): Promise<AssignmentSubmission> {
    const { data, error } = await nexus.database
      .from('assignment_submissions')
      .update({
        score: params.score,
        feedback: params.feedback || null,
        rubric_scores: params.rubricScores || {},
        graded_by: params.gradedBy,
        graded_at: new Date().toISOString(),
        status: params.returnToStudent ? 'returned' : 'graded',
        updated_at: new Date().toISOString()
      })
      .eq('id', params.submissionId)
      .select()
      .single();

    if (error) throw new Error(`Could not save the mark: ${error.message}`);
    const submission = data as AssignmentSubmission;

    const assignment = await this.getAssignment(submission.assignment_id);
    if (assignment?.class_id) {
      await gradeToGradebook({
        tenantId: submission.tenant_id,
        classId: assignment.class_id,
        studentId: submission.student_id,
        assignmentId: assignment.id,
        label: assignment.title,
        score: params.score,
        pointsPossible: assignment.points_possible,
        recordedBy: params.gradedBy
      });
    }

    return submission;
  },

  async requestResubmission(submissionId: string, feedback: string): Promise<void> {
    const { error } = await nexus.database
      .from('assignment_submissions')
      .update({ status: 'resubmit_requested', feedback, updated_at: new Date().toISOString() })
      .eq('id', submissionId);
    if (error) throw new Error(`Could not request a resubmission: ${error.message}`);
  },

  // ─── Rubrics ────────────────────────────────────────────────────────────

  async listRubrics(tenantId: string, ownerId?: string): Promise<Rubric[]> {
    let query = nexus.database.from('rubrics').select('*').eq('tenant_id', tenantId);
    if (ownerId) query = query.eq('owner_id', ownerId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(`Could not load rubrics: ${error.message}`);
    return (data || []) as Rubric[];
  },

  async createRubric(payload: Partial<Rubric> & { tenant_id: string; owner_id: string; title: string }): Promise<Rubric> {
    const criteria = payload.criteria || [];
    // Total is the best achievable mark: the top level of every criterion.
    const total = criteria.reduce(
      (sum, c) => sum + Math.max(0, ...(c.levels || []).map(l => Number(l.points || 0))),
      0
    );

    const { data, error } = await nexus.database
      .from('rubrics')
      .insert([{ ...payload, criteria, total_points: total }])
      .select()
      .single();
    if (error) throw new Error(`Could not create rubric: ${error.message}`);
    return data as Rubric;
  },

  async deleteRubric(id: string): Promise<void> {
    const { error } = await nexus.database.from('rubrics').delete().eq('id', id);
    if (error) throw new Error(`Could not delete rubric: ${error.message}`);
  }
};

/**
 * Mirror a mark into the gradebook. Upserts on (class, student, assignment) so
 * regrading updates the existing column instead of adding a second one.
 */
async function gradeToGradebook(params: {
  tenantId: string;
  classId: string;
  studentId: string;
  assignmentId: string;
  label: string;
  score: number;
  pointsPossible: number;
  recordedBy: string;
}): Promise<void> {
  const { data: existing } = await nexus.database
    .from('grade_entries')
    .select('id')
    .eq('class_id', params.classId)
    .eq('student_id', params.studentId)
    .eq('assignment_id', params.assignmentId)
    .maybeSingle();

  const row = {
    tenant_id: params.tenantId,
    class_id: params.classId,
    student_id: params.studentId,
    assignment_id: params.assignmentId,
    item_label: params.label,
    category: 'assignment',
    score: params.score,
    points_possible: params.pointsPossible,
    recorded_by: params.recordedBy,
    recorded_at: new Date().toISOString()
  };

  // A gradebook write must never fail the marking itself — the mark is already
  // saved on the submission, which is the record of truth.
  try {
    if (existing) {
      await nexus.database.from('grade_entries').update(row).eq('id', (existing as any).id);
    } else {
      await nexus.database.from('grade_entries').insert([row]);
    }
  } catch (err) {
    console.error('[Assignments] Mark saved but gradebook sync failed:', err);
  }
}
