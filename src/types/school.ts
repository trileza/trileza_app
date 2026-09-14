/**
 * School-layer domain types.
 *
 * These mirror the tables added in 20260905_school_core.sql and
 * 20260905_school_operations.sql. Kept in their own file rather than appended
 * to types/index.ts so the school feature set stays legible as one unit.
 */

// ─── Classes ──────────────────────────────────────────────────────────────

export type ClassMemberRole = 'student' | 'teacher' | 'assistant' | 'observer';

export interface SchoolClass {
  id: string;
  tenant_id: string;
  name: string;
  code?: string | null;
  academic_year?: string | null;
  term?: string | null;
  subject?: string | null;
  course_id?: string | null;
  lead_teacher_id?: string | null;
  room?: string | null;
  capacity?: number | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at?: string;

  // Joined at read time, not columns.
  member_count?: number;
  lead_teacher_name?: string;
}

export interface ClassMember {
  id: string;
  class_id: string;
  user_id: string;
  role: ClassMemberRole;
  joined_at: string;
  left_at?: string | null;

  full_name?: string;
  email?: string;
  avatar_url?: string | null;
}

// ─── Assignments ──────────────────────────────────────────────────────────

export type AssignmentType = 'quiz' | 'file' | 'text' | 'media' | 'peer_reviewed';
export type AssignmentStatus = 'draft' | 'published' | 'closed' | 'archived';

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  points: number;
  feedback?: string;
}

export interface Assignment {
  id: string;
  tenant_id: string;
  class_id?: string | null;
  course_id?: string | null;
  teacher_id: string;
  title: string;
  instructions?: string | null;
  type: AssignmentType;
  points_possible: number;
  rubric_id?: string | null;
  questions: QuizQuestion[];
  attachments: Array<{ name: string; url: string }>;
  allow_late: boolean;
  peer_review_count: number;
  status: AssignmentStatus;
  available_from?: string | null;
  due_at?: string | null;
  created_at: string;
  updated_at?: string;

  class_name?: string;
  submission_count?: number;
  graded_count?: number;
}

export type SubmissionStatus =
  | 'draft' | 'submitted' | 'late' | 'graded' | 'returned' | 'resubmit_requested';

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  tenant_id: string;
  status: SubmissionStatus;
  body?: string | null;
  attachments: Array<{ name: string; url: string }>;
  answers: number[];
  score?: number | null;
  auto_score?: number | null;
  rubric_scores: Record<string, number>;
  feedback?: string | null;
  feedback_media_url?: string | null;
  graded_by?: string | null;
  submitted_at?: string | null;
  graded_at?: string | null;
  created_at: string;

  student_name?: string;
  student_avatar?: string | null;
  assignment_title?: string;
  points_possible?: number;
}

// ─── Rubrics ──────────────────────────────────────────────────────────────

export interface RubricLevel {
  label: string;
  points: number;
  description?: string;
}

export interface RubricCriterion {
  id: string;
  label: string;
  description?: string;
  levels: RubricLevel[];
}

export interface Rubric {
  id: string;
  tenant_id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  criteria: RubricCriterion[];
  total_points: number;
  is_shared: boolean;
  created_at: string;
}

// ─── Gradebook ────────────────────────────────────────────────────────────

export interface GradeEntry {
  id: string;
  tenant_id: string;
  class_id: string;
  student_id: string;
  assignment_id?: string | null;
  item_label: string;
  category: string;
  score?: number | null;
  points_possible: number;
  is_excused: boolean;
  comment?: string | null;
  recorded_by?: string | null;
  recorded_at: string;
}

export interface GradeCategory {
  id: string;
  class_id: string;
  name: string;
  weight_pct: number;
}

/** A gradebook row: one student, every column, plus their weighted average. */
export interface GradebookRow {
  student_id: string;
  student_name: string;
  avatar_url?: string | null;
  scores: Record<string, { score: number | null; points_possible: number; excused: boolean }>;
  average_pct: number | null;
  letter: string | null;
}

export interface GradebookColumn {
  key: string;
  label: string;
  category: string;
  points_possible: number;
  assignment_id?: string | null;
}

// ─── Attendance ───────────────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'left_early';

export interface AttendanceRecord {
  id: string;
  tenant_id: string;
  class_id: string;
  student_id: string;
  session_date: string;
  period?: string | null;
  status: AttendanceStatus;
  minutes_late?: number | null;
  note?: string | null;
  recorded_by?: string | null;
  recorded_at: string;
}

export interface AttendanceSummary {
  student_id: string;
  student_name: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  attendance_pct: number;
  /** Set when the rate crosses the persistent-absence threshold. */
  is_persistently_absent: boolean;
}

// ─── Guardians ────────────────────────────────────────────────────────────

export interface GuardianLink {
  id: string;
  tenant_id: string;
  guardian_id: string;
  student_id: string;
  relationship: 'parent' | 'guardian' | 'carer' | 'other';
  is_primary: boolean;
  can_view_grades: boolean;
  can_view_attendance: boolean;
  status: 'pending' | 'active' | 'revoked';
  created_at: string;

  student_name?: string;
  student_avatar?: string | null;
  guardian_name?: string;
  guardian_email?: string;
}

/** Everything the parent portal shows for one child. */
export interface ChildOverview {
  student_id: string;
  student_name: string;
  avatar_url?: string | null;
  classes: Array<{ id: string; name: string; teacher?: string }>;
  attendance_pct: number | null;
  average_grade_pct: number | null;
  upcoming: Array<{ id: string; title: string; due_at: string | null; class_name?: string }>;
  recent_grades: Array<{ label: string; score: number | null; points_possible: number; recorded_at: string }>;
}

// ─── Announcements & events ───────────────────────────────────────────────

export type AnnouncementAudience = 'tenant' | 'class' | 'teachers' | 'students' | 'guardians';

export interface Announcement {
  id: string;
  tenant_id: string;
  author_id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  class_id?: string | null;
  priority: 'normal' | 'important' | 'urgent';
  pinned: boolean;
  publish_at: string;
  expires_at?: string | null;
  created_at: string;

  author_name?: string;
  class_name?: string;
}

export interface SchoolEvent {
  id: string;
  tenant_id: string;
  organiser_id: string;
  title: string;
  description?: string | null;
  category: 'general' | 'parents_evening' | 'exam' | 'trip' | 'sports' | 'holiday' | 'inset';
  location?: string | null;
  class_id?: string | null;
  audience: AnnouncementAudience;
  starts_at: string;
  ends_at?: string | null;
  all_day: boolean;
  requires_rsvp: boolean;
  created_at: string;
}

// ─── Timetable & resources ────────────────────────────────────────────────

export interface TimetableSlot {
  id: string;
  tenant_id: string;
  class_id: string;
  teacher_id?: string | null;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
  room?: string | null;
  label?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;

  class_name?: string;
  teacher_name?: string;
}

export interface SchoolResource {
  id: string;
  tenant_id: string;
  name: string;
  kind: 'room' | 'equipment' | 'vehicle' | 'other';
  location?: string | null;
  capacity?: number | null;
  quantity: number;
  notes?: string | null;
  is_active: boolean;
}

export interface ResourceBooking {
  id: string;
  tenant_id: string;
  resource_id: string;
  booked_by: string;
  class_id?: string | null;
  purpose?: string | null;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'pending' | 'cancelled';

  resource_name?: string;
  booked_by_name?: string;
}

// ─── Planning, pastoral, tasks ────────────────────────────────────────────

export interface LessonPlan {
  id: string;
  tenant_id: string;
  author_id: string;
  class_id?: string | null;
  course_id?: string | null;
  title: string;
  subject?: string | null;
  year_group?: string | null;
  planned_for?: string | null;
  duration_mins?: number | null;
  objectives: string[];
  materials: string[];
  activities: Array<{ title: string; minutes?: number; detail?: string }>;
  differentiation?: string | null;
  assessment_notes?: string | null;
  standard_ids: string[];
  is_shared: boolean;
  created_at: string;
}

export interface CurriculumStandard {
  id: string;
  tenant_id: string;
  framework: string;
  code: string;
  description: string;
  subject?: string | null;
  year_group?: string | null;
  parent_id?: string | null;
}

export interface BehaviourLog {
  id: string;
  tenant_id: string;
  student_id: string;
  class_id?: string | null;
  logged_by: string;
  kind: 'note' | 'positive' | 'concern' | 'incident' | 'wellbeing' | 'intervention';
  severity: 'low' | 'medium' | 'high';
  title: string;
  detail?: string | null;
  action_taken?: string | null;
  is_confidential: boolean;
  follow_up_on?: string | null;
  resolved_at?: string | null;
  created_at: string;

  student_name?: string;
  logged_by_name?: string;
}

export interface TodoItem {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  detail?: string | null;
  source: 'manual' | 'system';
  link_to?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

// ─── Custom roles ─────────────────────────────────────────────────────────

export interface CustomRole {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  base_role: string;
  permissions: string[];
  created_at: string;

  assigned_count?: number;
}

/** Permissions a custom role may grant. Kept flat and explicit. */
export const AVAILABLE_PERMISSIONS = [
  'class.manage',
  'class.view_all',
  'assignment.create',
  'assignment.grade',
  'attendance.record',
  'attendance.view_all',
  'gradebook.view_all',
  'gradebook.edit',
  'announcement.publish',
  'event.manage',
  'resource.book',
  'resource.manage',
  'behaviour.log',
  'behaviour.view_confidential',
  'user.invite',
  'report.export'
] as const;

export type Permission = typeof AVAILABLE_PERMISSIONS[number];

// ─── Early warning ────────────────────────────────────────────────────────

export interface RiskSignal {
  student_id: string;
  student_name: string;
  avatar_url?: string | null;
  risk_score: number;      // 0–100, higher is more at risk
  band: 'low' | 'medium' | 'high';
  reasons: string[];
  attendance_pct: number | null;
  average_grade_pct: number | null;
  missing_assignments: number;
  days_since_active: number | null;
}
