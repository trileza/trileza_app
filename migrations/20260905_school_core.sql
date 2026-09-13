-- =============================================================================
-- TRILEZA — SCHOOL CORE: CLASSES, ASSIGNMENTS, GRADEBOOK, ATTENDANCE, GUARDIANS
-- =============================================================================
--
-- Two structural gaps blocked most of the Institutional feature set:
--
--   1. Assignments had no table. They were appended to a JSON array at
--      profiles.metadata.created_assignments on the teacher's own profile row,
--      so nothing could be queried, graded, reported on, or linked to a student.
--
--   2. There was no class/section entity. Rosters were inferred from
--      enrollments, which left attendance, cohorts and timetabling with nothing
--      to attach to.
--
-- This migration adds both, plus the features that depend on them: a gradebook,
-- rubrics, a daily register, and the guardian link that makes a parent portal
-- possible.
--
-- Depends on 20260904_rls_hardening.sql for is_platform_admin() and
-- has_admin_role(). Run that first.
--
-- =============================================================================


-- --- 1. Classes (sections) --------------------------------------------------
-- A class is a teaching group: "Year 10 Biology, Set B". It owns a roster, a
-- register and a timetable. A course is content; a class is people.

CREATE TABLE IF NOT EXISTS classes (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  code          TEXT,
  academic_year TEXT,
  term          TEXT,
  subject       TEXT,
  course_id     TEXT REFERENCES courses(id) ON DELETE SET NULL,
  lead_teacher_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  room          TEXT,
  capacity      INTEGER,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_tenant   ON classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher  ON classes(lead_teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_status   ON classes(tenant_id, status);

-- Roster. `role` lets a co-teacher or TA sit in the same table as students.
CREATE TABLE IF NOT EXISTS class_members (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id    TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'assistant', 'observer')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  UNIQUE (class_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_class_members_class ON class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_user  ON class_members(user_id);


-- --- 2. Assignments ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS assignments (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  class_id       TEXT REFERENCES classes(id) ON DELETE CASCADE,
  course_id      TEXT REFERENCES courses(id) ON DELETE SET NULL,
  teacher_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  instructions   TEXT,
  -- 'quiz' is auto-gradeable from `questions`; the rest are teacher-marked.
  type           TEXT NOT NULL DEFAULT 'file' CHECK (type IN ('quiz', 'file', 'text', 'media', 'peer_reviewed')),
  points_possible NUMERIC NOT NULL DEFAULT 100,
  rubric_id      TEXT,
  questions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments    JSONB NOT NULL DEFAULT '[]'::jsonb,
  allow_late     BOOLEAN NOT NULL DEFAULT TRUE,
  peer_review_count INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  available_from TIMESTAMPTZ,
  due_at         TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_tenant  ON assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class   ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due     ON assignments(due_at);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  assignment_id  TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id      TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'submitted', 'late', 'graded', 'returned', 'resubmit_requested')),
  body           TEXT,
  attachments    JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers        JSONB NOT NULL DEFAULT '[]'::jsonb,
  score          NUMERIC,
  auto_score     NUMERIC,
  rubric_scores  JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback       TEXT,
  feedback_media_url TEXT,
  graded_by      TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at   TIMESTAMPTZ,
  graded_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student    ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status     ON assignment_submissions(status);


-- --- 3. Rubrics -------------------------------------------------------------
-- Criteria live in JSONB rather than a child table: a rubric is always read and
-- edited whole, and keeping it in one row makes it trivial to snapshot onto a
-- submission so later edits to the rubric never rewrite historical marks.

CREATE TABLE IF NOT EXISTS rubrics (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  -- [{ id, label, description, levels: [{ label, points, description }] }]
  criteria    JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_points NUMERIC NOT NULL DEFAULT 0,
  is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rubrics_tenant ON rubrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rubrics_owner  ON rubrics(owner_id);


-- --- 4. Gradebook -----------------------------------------------------------
-- One row per student per gradeable item. Assignment marks flow in here so the
-- gradebook can also hold manual columns (participation, exams) that never had
-- a submission.

CREATE TABLE IF NOT EXISTS grade_entries (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  class_id      TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  item_label    TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',
  score         NUMERIC,
  points_possible NUMERIC NOT NULL DEFAULT 100,
  is_excused    BOOLEAN NOT NULL DEFAULT FALSE,
  comment       TEXT,
  recorded_by   TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, student_id, assignment_id, item_label)
);

CREATE INDEX IF NOT EXISTS idx_grades_class   ON grade_entries(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grade_entries(student_id);

-- Weighted categories per class, e.g. {"homework": 20, "exam": 50}.
CREATE TABLE IF NOT EXISTS grade_categories (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id   TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  weight_pct NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (class_id, name)
);


-- --- 5. Attendance ----------------------------------------------------------
-- Daily/period register, distinct from live_sessions participation (which only
-- records who joined a video call).

CREATE TABLE IF NOT EXISTS attendance_records (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  class_id     TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  period       TEXT,
  status       TEXT NOT NULL DEFAULT 'present'
               CHECK (status IN ('present', 'absent', 'late', 'excused', 'left_early')),
  minutes_late INTEGER,
  note         TEXT,
  recorded_by  TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, student_id, session_date, period)
);

CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance_records(class_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student    ON attendance_records(student_id);


-- --- 6. Guardians -----------------------------------------------------------
-- A guardian is a profile like anyone else; this table is the link, so one
-- parent can watch several children across classes.

CREATE TABLE IF NOT EXISTS guardian_links (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  guardian_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'parent'
               CHECK (relationship IN ('parent', 'guardian', 'carer', 'other')),
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_grades     BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_attendance BOOLEAN NOT NULL DEFAULT TRUE,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guardian_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian ON guardian_links(guardian_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_student  ON guardian_links(student_id);

-- Does the caller guard this student? SECURITY DEFINER so guardian policies on
-- other tables can call it without recursing through this table's own policy.
CREATE OR REPLACE FUNCTION is_guardian_of(target_student_id TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.guardian_links g
    WHERE g.guardian_id::text = auth.uid()::text
      AND g.student_id::text = target_student_id
      AND g.status = 'active'
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Does the caller teach this class? Used by nearly every policy below.
CREATE OR REPLACE FUNCTION teaches_class(target_class_id TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id::text = target_class_id
      AND c.lead_teacher_id::text = auth.uid()::text
  ) OR EXISTS (
    SELECT 1 FROM public.class_members m
    WHERE m.class_id::text = target_class_id
      AND m.user_id::text = auth.uid()::text
      AND m.role IN ('teacher', 'assistant')
      AND m.left_at IS NULL
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Is the caller on this class roster at all?
CREATE OR REPLACE FUNCTION is_in_class(target_class_id TEXT) RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members m
    WHERE m.class_id::text = target_class_id
      AND m.user_id::text = auth.uid()::text
      AND m.left_at IS NULL
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;


-- --- 7. Announcements -------------------------------------------------------

CREATE TABLE IF NOT EXISTS announcements (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  -- 'tenant' reaches the whole institution; 'class' only its roster.
  audience    TEXT NOT NULL DEFAULT 'tenant'
              CHECK (audience IN ('tenant', 'class', 'teachers', 'students', 'guardians')),
  class_id    TEXT REFERENCES classes(id) ON DELETE CASCADE,
  priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  publish_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_tenant ON announcements(tenant_id, publish_at DESC);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE classes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubrics                ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_links         ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements          ENABLE ROW LEVEL SECURITY;

-- Classes: visible to the roster and to institution staff; edited by teachers.
DROP POLICY IF EXISTS classes_select ON classes;
DROP POLICY IF EXISTS classes_write  ON classes;
CREATE POLICY classes_select ON classes
  FOR SELECT USING (
    is_in_class(id) OR lead_teacher_id::text = auth.uid()::text OR is_platform_admin()
  );
CREATE POLICY classes_write ON classes
  FOR ALL USING (
    lead_teacher_id::text = auth.uid()::text OR is_platform_admin()
  );

-- Roster rows: readable by the class, writable by its teachers.
DROP POLICY IF EXISTS class_members_select ON class_members;
DROP POLICY IF EXISTS class_members_write  ON class_members;
CREATE POLICY class_members_select ON class_members
  FOR SELECT USING (
    user_id::text = auth.uid()::text
    OR teaches_class(class_id)
    OR is_guardian_of(user_id)
    OR is_platform_admin()
  );
CREATE POLICY class_members_write ON class_members
  FOR ALL USING (teaches_class(class_id) OR is_platform_admin());

-- Assignments: students see published ones for their class; teachers see theirs.
DROP POLICY IF EXISTS assignments_select ON assignments;
DROP POLICY IF EXISTS assignments_write  ON assignments;
CREATE POLICY assignments_select ON assignments
  FOR SELECT USING (
    teacher_id::text = auth.uid()::text
    OR is_platform_admin()
    OR (status = 'published' AND class_id IS NOT NULL AND is_in_class(class_id))
  );
CREATE POLICY assignments_write ON assignments
  FOR ALL USING (
    teacher_id::text = auth.uid()::text
    OR (class_id IS NOT NULL AND teaches_class(class_id))
    OR is_platform_admin()
  );

-- Submissions: a student sees only their own; teachers see their assignment's.
DROP POLICY IF EXISTS submissions_select ON assignment_submissions;
DROP POLICY IF EXISTS submissions_insert ON assignment_submissions;
DROP POLICY IF EXISTS submissions_update ON assignment_submissions;
CREATE POLICY submissions_select ON assignment_submissions
  FOR SELECT USING (
    student_id::text = auth.uid()::text
    OR is_guardian_of(student_id)
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (a.teacher_id::text = auth.uid()::text OR (a.class_id IS NOT NULL AND teaches_class(a.class_id)))
    )
  );
CREATE POLICY submissions_insert ON assignment_submissions
  FOR INSERT WITH CHECK (student_id::text = auth.uid()::text);
-- A student may edit their own draft; only the teacher may write a mark.
CREATE POLICY submissions_update ON assignment_submissions
  FOR UPDATE USING (
    (student_id::text = auth.uid()::text AND status IN ('draft', 'submitted', 'late', 'resubmit_requested'))
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (a.teacher_id::text = auth.uid()::text OR (a.class_id IS NOT NULL AND teaches_class(a.class_id)))
    )
  );

-- Rubrics: own, or shared within the tenant.
DROP POLICY IF EXISTS rubrics_select ON rubrics;
DROP POLICY IF EXISTS rubrics_write  ON rubrics;
CREATE POLICY rubrics_select ON rubrics
  FOR SELECT USING (owner_id::text = auth.uid()::text OR is_shared = TRUE OR is_platform_admin());
CREATE POLICY rubrics_write ON rubrics
  FOR ALL USING (owner_id::text = auth.uid()::text OR is_platform_admin());

-- Grades: the student, their guardian, and the class's teachers.
DROP POLICY IF EXISTS grades_select ON grade_entries;
DROP POLICY IF EXISTS grades_write  ON grade_entries;
CREATE POLICY grades_select ON grade_entries
  FOR SELECT USING (
    student_id::text = auth.uid()::text
    OR is_guardian_of(student_id)
    OR teaches_class(class_id)
    OR is_platform_admin()
  );
CREATE POLICY grades_write ON grade_entries
  FOR ALL USING (teaches_class(class_id) OR is_platform_admin());

DROP POLICY IF EXISTS grade_categories_select ON grade_categories;
DROP POLICY IF EXISTS grade_categories_write  ON grade_categories;
CREATE POLICY grade_categories_select ON grade_categories
  FOR SELECT USING (is_in_class(class_id) OR teaches_class(class_id) OR is_platform_admin());
CREATE POLICY grade_categories_write ON grade_categories
  FOR ALL USING (teaches_class(class_id) OR is_platform_admin());

-- Attendance: same audience as grades.
DROP POLICY IF EXISTS attendance_select ON attendance_records;
DROP POLICY IF EXISTS attendance_write  ON attendance_records;
CREATE POLICY attendance_select ON attendance_records
  FOR SELECT USING (
    student_id::text = auth.uid()::text
    OR is_guardian_of(student_id)
    OR teaches_class(class_id)
    OR is_platform_admin()
  );
CREATE POLICY attendance_write ON attendance_records
  FOR ALL USING (teaches_class(class_id) OR is_platform_admin());

-- Guardian links: the guardian, the student, and admins. Only admins create
-- them, so a parent cannot attach themselves to an arbitrary child.
DROP POLICY IF EXISTS guardian_links_select ON guardian_links;
DROP POLICY IF EXISTS guardian_links_write  ON guardian_links;
CREATE POLICY guardian_links_select ON guardian_links
  FOR SELECT USING (
    guardian_id::text = auth.uid()::text
    OR student_id::text = auth.uid()::text
    OR is_platform_admin()
  );
CREATE POLICY guardian_links_write ON guardian_links
  FOR ALL USING (is_platform_admin() OR has_admin_role('user_manager'));

-- Announcements: readable within the tenant (class ones only by the roster).
DROP POLICY IF EXISTS announcements_select ON announcements;
DROP POLICY IF EXISTS announcements_write  ON announcements;
CREATE POLICY announcements_select ON announcements
  FOR SELECT USING (
    publish_at <= NOW()
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (
      audience <> 'class'
      OR (class_id IS NOT NULL AND (is_in_class(class_id) OR teaches_class(class_id)))
    )
  );
CREATE POLICY announcements_write ON announcements
  FOR ALL USING (
    author_id::text = auth.uid()::text
    OR is_platform_admin()
    OR (class_id IS NOT NULL AND teaches_class(class_id))
  );
