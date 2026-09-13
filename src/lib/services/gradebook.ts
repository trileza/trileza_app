import { nexus } from '../nexus';
import { classService } from './classes';
import type {
  GradeEntry,
  GradeCategory,
  GradebookRow,
  GradebookColumn,
  RiskSignal
} from '../../types/school';

/**
 * Gradebook and the early-warning signal built on top of it.
 *
 * Grade entries are the single source for both: an assignment mark is mirrored
 * into grade_entries when it is awarded, and manual columns (participation,
 * an exam) can be added alongside without a submission behind them.
 */

/** Nigerian-style letter bands; adjust per institution when that ships. */
const LETTER_BANDS: Array<{ min: number; letter: string }> = [
  { min: 70, letter: 'A' },
  { min: 60, letter: 'B' },
  { min: 50, letter: 'C' },
  { min: 45, letter: 'D' },
  { min: 40, letter: 'E' },
  { min: 0,  letter: 'F' }
];

export const letterFor = (pct: number | null): string | null => {
  if (pct === null || Number.isNaN(pct)) return null;
  return LETTER_BANDS.find(b => pct >= b.min)?.letter ?? 'F';
};

export const gradebookService = {
  async getCategories(classId: string): Promise<GradeCategory[]> {
    const { data, error } = await nexus.database
      .from('grade_categories').select('*').eq('class_id', classId);
    if (error) throw new Error(`Could not load grade categories: ${error.message}`);
    return (data || []) as GradeCategory[];
  },

  async saveCategories(classId: string, categories: Array<{ name: string; weight_pct: number }>): Promise<void> {
    await nexus.database.from('grade_categories').delete().eq('class_id', classId);
    if (categories.length === 0) return;
    const { error } = await nexus.database
      .from('grade_categories')
      .insert(categories.map(c => ({ class_id: classId, name: c.name, weight_pct: c.weight_pct })));
    if (error) throw new Error(`Could not save grade categories: ${error.message}`);
  },

  /**
   * The full gradebook grid for a class: one row per student, one column per
   * gradeable item, plus a weighted average when categories are configured.
   */
  async getGradebook(classId: string): Promise<{ columns: GradebookColumn[]; rows: GradebookRow[] }> {
    const [entriesRes, roster, categories] = await Promise.all([
      nexus.database.from('grade_entries').select('*').eq('class_id', classId),
      classService.getRoster(classId),
      this.getCategories(classId)
    ]);

    if (entriesRes.error) throw new Error(`Could not load the gradebook: ${entriesRes.error.message}`);

    const entries = (entriesRes.data || []) as GradeEntry[];
    const students = roster.filter(m => m.role === 'student');

    // Columns are keyed by assignment where there is one, so two manual items
    // that happen to share a label stay distinct.
    const columnMap = new Map<string, GradebookColumn>();
    entries.forEach(e => {
      const key = e.assignment_id || `manual:${e.item_label}`;
      if (!columnMap.has(key)) {
        columnMap.set(key, {
          key,
          label: e.item_label,
          category: e.category || 'general',
          points_possible: Number(e.points_possible || 100),
          assignment_id: e.assignment_id || null
        });
      }
    });
    const columns = Array.from(columnMap.values()).sort((a, b) => a.label.localeCompare(b.label));

    const weightByCategory = new Map<string, number>();
    categories.forEach(c => weightByCategory.set(c.name, Number(c.weight_pct || 0)));
    const useWeights = categories.length > 0
      && Array.from(weightByCategory.values()).reduce((a, b) => a + b, 0) > 0;

    const rows: GradebookRow[] = students.map(s => {
      const mine = entries.filter(e => e.student_id === s.user_id);
      const scores: GradebookRow['scores'] = {};

      columns.forEach(col => {
        const entry = mine.find(e => (e.assignment_id || `manual:${e.item_label}`) === col.key);
        scores[col.key] = entry
          ? {
              score: entry.is_excused ? null : (entry.score === null || entry.score === undefined ? null : Number(entry.score)),
              points_possible: Number(entry.points_possible || col.points_possible),
              excused: Boolean(entry.is_excused)
            }
          : { score: null, points_possible: col.points_possible, excused: false };
      });

      const average = useWeights
        ? weightedAverage(mine, weightByCategory)
        : flatAverage(mine);

      return {
        student_id: s.user_id,
        student_name: s.full_name || 'Unknown',
        avatar_url: s.avatar_url ?? null,
        scores,
        average_pct: average,
        letter: letterFor(average)
      };
    });

    return { columns, rows };
  },

  /** Add or overwrite a single cell. */
  async setGrade(params: {
    tenantId: string;
    classId: string;
    studentId: string;
    itemLabel: string;
    category?: string;
    score: number | null;
    pointsPossible?: number;
    isExcused?: boolean;
    comment?: string;
    recordedBy: string;
    assignmentId?: string | null;
  }): Promise<void> {
    let lookup = nexus.database
      .from('grade_entries')
      .select('id')
      .eq('class_id', params.classId)
      .eq('student_id', params.studentId)
      .eq('item_label', params.itemLabel);

    lookup = params.assignmentId
      ? lookup.eq('assignment_id', params.assignmentId)
      : lookup.is('assignment_id', null);

    const { data: existing } = await lookup.maybeSingle();

    const row = {
      tenant_id: params.tenantId,
      class_id: params.classId,
      student_id: params.studentId,
      assignment_id: params.assignmentId || null,
      item_label: params.itemLabel,
      category: params.category || 'general',
      score: params.score,
      points_possible: params.pointsPossible ?? 100,
      is_excused: params.isExcused ?? false,
      comment: params.comment || null,
      recorded_by: params.recordedBy,
      recorded_at: new Date().toISOString()
    };

    const { error } = existing
      ? await nexus.database.from('grade_entries').update(row).eq('id', (existing as any).id)
      : await nexus.database.from('grade_entries').insert([row]);

    if (error) throw new Error(`Could not save the grade: ${error.message}`);
  },

  /** A student's overall average across every class. */
  async getStudentAverage(studentId: string): Promise<number | null> {
    const { data, error } = await nexus.database
      .from('grade_entries')
      .select('score, points_possible, is_excused')
      .eq('student_id', studentId);

    if (error || !data) return null;
    return flatAverage(data as GradeEntry[]);
  },

  /**
   * Early warning. Combines attendance, grade average, missing work and
   * inactivity into a 0–100 risk score, and says which of those drove it —
   * a score with no reason attached is not actionable for a form tutor.
   */
  async getRiskSignals(classId: string): Promise<RiskSignal[]> {
    const [roster, attendance, gradeRes, assignmentRes] = await Promise.all([
      classService.getRoster(classId),
      classService.getAttendanceSummary(classId),
      nexus.database.from('grade_entries').select('*').eq('class_id', classId),
      nexus.database.from('assignments').select('id').eq('class_id', classId).eq('status', 'published')
    ]);

    const students = roster.filter(m => m.role === 'student');
    if (students.length === 0) return [];

    const entries = (gradeRes.data || []) as GradeEntry[];
    const assignmentIds = ((assignmentRes.data || []) as any[]).map(a => a.id);

    const { data: subs } = assignmentIds.length
      ? await nexus.database
          .from('assignment_submissions')
          .select('assignment_id, student_id, status')
          .in('assignment_id', assignmentIds)
      : { data: [] as any[] };

    const submittedBy = new Map<string, Set<string>>();
    ((subs || []) as any[]).forEach(s => {
      if (s.status === 'draft') return;
      if (!submittedBy.has(s.student_id)) submittedBy.set(s.student_id, new Set());
      submittedBy.get(s.student_id)!.add(s.assignment_id);
    });

    const { data: profiles } = await nexus.database
      .from('profiles')
      .select('id, last_active_at')
      .in('id', students.map(s => s.user_id));

    const lastActive = new Map<string, string | null>();
    ((profiles || []) as any[]).forEach(p => lastActive.set(p.id, p.last_active_at || null));

    return students
      .map(s => {
        const att = attendance.find(a => a.student_id === s.user_id);
        const attendancePct = att && att.total > 0 ? att.attendance_pct : null;
        const avg = flatAverage(entries.filter(e => e.student_id === s.user_id));

        const done = submittedBy.get(s.user_id)?.size || 0;
        const missing = Math.max(0, assignmentIds.length - done);

        const activeIso = lastActive.get(s.user_id);
        const daysSinceActive = activeIso
          ? Math.floor((Date.now() - new Date(activeIso).getTime()) / 86_400_000)
          : null;

        // Each factor contributes independently, capped at 100.
        let score = 0;
        const reasons: string[] = [];

        if (attendancePct !== null && attendancePct < 90) {
          const weight = Math.min(35, Math.round((90 - attendancePct) * 1.5));
          score += weight;
          reasons.push(`Attendance at ${attendancePct}%`);
        }
        if (avg !== null && avg < 50) {
          const weight = Math.min(35, Math.round((50 - avg) * 0.9));
          score += weight;
          reasons.push(`Grade average ${avg}%`);
        }
        if (missing > 0 && assignmentIds.length > 0) {
          const weight = Math.min(20, missing * 5);
          score += weight;
          reasons.push(`${missing} assignment${missing === 1 ? '' : 's'} not submitted`);
        }
        if (daysSinceActive !== null && daysSinceActive >= 14) {
          score += 10;
          reasons.push(`No activity for ${daysSinceActive} days`);
        }

        score = Math.min(100, score);
        const band: RiskSignal['band'] = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';

        return {
          student_id: s.user_id,
          student_name: s.full_name || 'Unknown',
          avatar_url: s.avatar_url ?? null,
          risk_score: score,
          band,
          reasons,
          attendance_pct: attendancePct,
          average_grade_pct: avg,
          missing_assignments: missing,
          days_since_active: daysSinceActive
        };
      })
      .sort((a, b) => b.risk_score - a.risk_score);
  }
};

/** Unweighted: total points earned over total points available. */
function flatAverage(entries: GradeEntry[]): number | null {
  const counted = entries.filter(
    e => !e.is_excused && e.score !== null && e.score !== undefined
  );
  if (counted.length === 0) return null;

  const earned = counted.reduce((s, e) => s + Number(e.score), 0);
  const possible = counted.reduce((s, e) => s + Number(e.points_possible || 0), 0);
  if (possible <= 0) return null;
  return Number(((earned / possible) * 100).toFixed(1));
}

/**
 * Weighted by category. Categories with no marks yet are dropped and the
 * remaining weights renormalised, so an early-term average is not dragged down
 * by an exam that has not happened.
 */
function weightedAverage(entries: GradeEntry[], weights: Map<string, number>): number | null {
  let totalWeight = 0;
  let accumulated = 0;

  weights.forEach((weight, category) => {
    const inCategory = entries.filter(
      e => (e.category || 'general') === category && !e.is_excused && e.score !== null && e.score !== undefined
    );
    if (inCategory.length === 0) return;

    const earned = inCategory.reduce((s, e) => s + Number(e.score), 0);
    const possible = inCategory.reduce((s, e) => s + Number(e.points_possible || 0), 0);
    if (possible <= 0) return;

    accumulated += (earned / possible) * weight;
    totalWeight += weight;
  });

  if (totalWeight <= 0) return flatAverage(entries);
  return Number(((accumulated / totalWeight) * 100).toFixed(1));
}
