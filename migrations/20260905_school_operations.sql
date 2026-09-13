-- =============================================================================
-- TRILEZA — SCHOOL OPERATIONS: TIMETABLE, EVENTS, RESOURCES, PLANNING, ROLES
-- =============================================================================
--
-- The day-to-day administration layer. Everything here depends on `classes`
-- from 20260905_school_core.sql, which must run first (it also defines
-- teaches_class(), is_in_class() and is_guardian_of()).
--
-- =============================================================================


-- --- 1. Timetable -----------------------------------------------------------
-- A slot is a recurring weekly period for one class in one room. Conflict
-- detection is an EXCLUDE constraint rather than application logic, so two
-- bookings for the same room at the same time cannot both commit.

CREATE TABLE IF NOT EXISTS timetable_slots (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  class_id     TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id   TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  -- 0 = Sunday .. 6 = Saturday, matching JavaScript's Date.getDay().
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at    TIME NOT NULL,
  ends_at      TIME NOT NULL,
  room         TEXT,
  label        TEXT,
  effective_from DATE,
  effective_to   DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT timetable_slot_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_timetable_tenant  ON timetable_slots(tenant_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_class   ON timetable_slots(class_id);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable_slots(teacher_id, day_of_week);

-- Same room, same day, overlapping times is rejected at the database.
-- btree_gist is required to mix equality columns with a range in EXCLUDE.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE timetable_slots DROP CONSTRAINT IF EXISTS timetable_no_room_clash;
ALTER TABLE timetable_slots ADD CONSTRAINT timetable_no_room_clash
  EXCLUDE USING gist (
    tenant_id WITH =,
    room WITH =,
    day_of_week WITH =,
    tsrange(('2000-01-01'::date + starts_at), ('2000-01-01'::date + ends_at)) WITH &&
  ) WHERE (room IS NOT NULL);


-- --- 2. School events -------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_events (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  organiser_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN ('general', 'parents_evening', 'exam', 'trip', 'sports', 'holiday', 'inset')),
  location      TEXT,
  class_id      TEXT REFERENCES classes(id) ON DELETE CASCADE,
  audience      TEXT NOT NULL DEFAULT 'tenant'
                CHECK (audience IN ('tenant', 'class', 'teachers', 'students', 'guardians')),
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  all_day       BOOLEAN NOT NULL DEFAULT FALSE,
  requires_rsvp BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_start ON school_events(tenant_id, starts_at);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id   TEXT NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response   TEXT NOT NULL DEFAULT 'yes' CHECK (response IN ('yes', 'no', 'maybe')),
  slot_time  TIMESTAMPTZ,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);


-- --- 3. Bookable resources --------------------------------------------------

CREATE TABLE IF NOT EXISTS school_resources (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'equipment'
              CHECK (kind IN ('room', 'equipment', 'vehicle', 'other')),
  location    TEXT,
  capacity    INTEGER,
  quantity    INTEGER NOT NULL DEFAULT 1,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_bookings (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  resource_id  TEXT NOT NULL REFERENCES school_resources(id) ON DELETE CASCADE,
  booked_by    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id     TEXT REFERENCES classes(id) ON DELETE SET NULL,
  purpose      TEXT,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_bookings_resource ON resource_bookings(resource_id, starts_at);

-- Double-booking a resource is rejected at the database, not in a handler.
ALTER TABLE resource_bookings DROP CONSTRAINT IF EXISTS resource_no_double_booking;
ALTER TABLE resource_bookings ADD CONSTRAINT resource_no_double_booking
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status <> 'cancelled');


-- --- 4. Lesson plans --------------------------------------------------------

CREATE TABLE IF NOT EXISTS lesson_plans (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  author_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id      TEXT REFERENCES classes(id) ON DELETE SET NULL,
  course_id     TEXT REFERENCES courses(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  subject       TEXT,
  year_group    TEXT,
  planned_for   DATE,
  duration_mins INTEGER,
  objectives    JSONB NOT NULL DEFAULT '[]'::jsonb,
  materials     JSONB NOT NULL DEFAULT '[]'::jsonb,
  activities    JSONB NOT NULL DEFAULT '[]'::jsonb,
  differentiation TEXT,
  assessment_notes TEXT,
  standard_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_shared     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_author ON lesson_plans(author_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_date   ON lesson_plans(tenant_id, planned_for);


-- --- 5. Curriculum standards ------------------------------------------------
-- Standards are hierarchical (framework > strand > statement), so a
-- self-referencing parent_id covers Common Core, NGSS and national frameworks
-- without a schema per framework.

CREATE TABLE IF NOT EXISTS curriculum_standards (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  framework   TEXT NOT NULL,
  code        TEXT NOT NULL,
  description TEXT NOT NULL,
  subject     TEXT,
  year_group  TEXT,
  parent_id   TEXT REFERENCES curriculum_standards(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, framework, code)
);

CREATE INDEX IF NOT EXISTS idx_standards_framework ON curriculum_standards(tenant_id, framework);

-- Polymorphic alignment: a standard can be attached to a course, lesson,
-- assignment or lesson plan without four separate join tables.
CREATE TABLE IF NOT EXISTS standard_alignments (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  standard_id  TEXT NOT NULL REFERENCES curriculum_standards(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN ('course', 'lesson', 'assignment', 'lesson_plan')),
  target_id    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (standard_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_alignments_target ON standard_alignments(target_type, target_id);


-- --- 6. Behaviour & wellbeing -----------------------------------------------
-- Pastoral records are sensitive: the RLS below deliberately excludes the
-- student and their guardian by default, since a logged concern is often not
-- yet something to share.

CREATE TABLE IF NOT EXISTS behaviour_logs (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id     TEXT REFERENCES classes(id) ON DELETE SET NULL,
  logged_by    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'note'
               CHECK (kind IN ('note', 'positive', 'concern', 'incident', 'wellbeing', 'intervention')),
  severity     TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  title        TEXT NOT NULL,
  detail       TEXT,
  action_taken TEXT,
  is_confidential BOOLEAN NOT NULL DEFAULT FALSE,
  follow_up_on DATE,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behaviour_student ON behaviour_logs(student_id, created_at DESC);


-- --- 7. To-do items ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS todo_items (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  detail      TEXT,
  -- 'system' rows are generated from due assignments and ungraded submissions.
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'system')),
  link_to     TEXT,
  due_at      TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_user ON todo_items(user_id, completed_at);


-- --- 8. Custom roles --------------------------------------------------------
-- Lets an institution define "Department Head" or "Teaching Assistant" without
-- a code change. Permissions are a flat string array checked by the app.

CREATE TABLE IF NOT EXISTS custom_roles (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT NOT NULL DEFAULT 'default-tenant' REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  base_role    TEXT NOT NULL DEFAULT 'mentee',
  permissions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS custom_role_assignments (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  custom_role_id TEXT NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (custom_role_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_role_assignments_user ON custom_role_assignments(user_id);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE timetable_slots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps            ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_resources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_standards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE standard_alignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE behaviour_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_role_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timetable_select ON timetable_slots;
DROP POLICY IF EXISTS timetable_write  ON timetable_slots;
CREATE POLICY timetable_select ON timetable_slots
  FOR SELECT USING (is_in_class(class_id) OR teaches_class(class_id) OR is_platform_admin());
CREATE POLICY timetable_write ON timetable_slots
  FOR ALL USING (teaches_class(class_id) OR is_platform_admin());

DROP POLICY IF EXISTS events_select ON school_events;
DROP POLICY IF EXISTS events_write  ON school_events;
CREATE POLICY events_select ON school_events
  FOR SELECT USING (
    audience <> 'class'
    OR (class_id IS NOT NULL AND (is_in_class(class_id) OR teaches_class(class_id)))
    OR is_platform_admin()
  );
CREATE POLICY events_write ON school_events
  FOR ALL USING (organiser_id::text = auth.uid()::text OR is_platform_admin());

DROP POLICY IF EXISTS rsvps_all ON event_rsvps;
CREATE POLICY rsvps_all ON event_rsvps
  FOR ALL USING (
    user_id::text = auth.uid()::text
    OR is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM school_events e
      WHERE e.id = event_rsvps.event_id AND e.organiser_id::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS resources_select ON school_resources;
DROP POLICY IF EXISTS resources_write  ON school_resources;
CREATE POLICY resources_select ON school_resources
  FOR SELECT USING (is_active = TRUE OR is_platform_admin());
CREATE POLICY resources_write ON school_resources
  FOR ALL USING (is_platform_admin());

DROP POLICY IF EXISTS bookings_select ON resource_bookings;
DROP POLICY IF EXISTS bookings_write  ON resource_bookings;
-- Everyone can see when a resource is taken, otherwise booking is guesswork.
CREATE POLICY bookings_select ON resource_bookings FOR SELECT USING (true);
CREATE POLICY bookings_write ON resource_bookings
  FOR ALL USING (booked_by::text = auth.uid()::text OR is_platform_admin());

DROP POLICY IF EXISTS lesson_plans_select ON lesson_plans;
DROP POLICY IF EXISTS lesson_plans_write  ON lesson_plans;
CREATE POLICY lesson_plans_select ON lesson_plans
  FOR SELECT USING (author_id::text = auth.uid()::text OR is_shared = TRUE OR is_platform_admin());
CREATE POLICY lesson_plans_write ON lesson_plans
  FOR ALL USING (author_id::text = auth.uid()::text OR is_platform_admin());

DROP POLICY IF EXISTS standards_select ON curriculum_standards;
DROP POLICY IF EXISTS standards_write  ON curriculum_standards;
CREATE POLICY standards_select ON curriculum_standards FOR SELECT USING (true);
CREATE POLICY standards_write ON curriculum_standards
  FOR ALL USING (is_platform_admin() OR has_admin_role('content_manager'));

DROP POLICY IF EXISTS alignments_select ON standard_alignments;
DROP POLICY IF EXISTS alignments_write  ON standard_alignments;
CREATE POLICY alignments_select ON standard_alignments FOR SELECT USING (true);
CREATE POLICY alignments_write ON standard_alignments
  FOR ALL USING (is_platform_admin() OR has_admin_role('content_manager'));

-- Pastoral records: staff only. Confidential entries narrow to their author
-- and admins.
DROP POLICY IF EXISTS behaviour_select ON behaviour_logs;
DROP POLICY IF EXISTS behaviour_write  ON behaviour_logs;
CREATE POLICY behaviour_select ON behaviour_logs
  FOR SELECT USING (
    is_platform_admin()
    OR logged_by::text = auth.uid()::text
    OR (is_confidential = FALSE AND class_id IS NOT NULL AND teaches_class(class_id))
  );
CREATE POLICY behaviour_write ON behaviour_logs
  FOR ALL USING (logged_by::text = auth.uid()::text OR is_platform_admin());

DROP POLICY IF EXISTS todos_all ON todo_items;
CREATE POLICY todos_all ON todo_items
  FOR ALL USING (user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS custom_roles_select ON custom_roles;
DROP POLICY IF EXISTS custom_roles_write  ON custom_roles;
CREATE POLICY custom_roles_select ON custom_roles FOR SELECT USING (true);
CREATE POLICY custom_roles_write ON custom_roles
  FOR ALL USING (is_platform_admin() OR has_admin_role('user_manager'));

DROP POLICY IF EXISTS role_assignments_select ON custom_role_assignments;
DROP POLICY IF EXISTS role_assignments_write  ON custom_role_assignments;
CREATE POLICY role_assignments_select ON custom_role_assignments
  FOR SELECT USING (user_id::text = auth.uid()::text OR is_platform_admin());
CREATE POLICY role_assignments_write ON custom_role_assignments
  FOR ALL USING (is_platform_admin() OR has_admin_role('user_manager'));
