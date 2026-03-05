-- 1. Ensure clerk_id column exists (Safe/Idempotent)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='clerk_id') THEN
        ALTER TABLE public.users ADD COLUMN clerk_id TEXT UNIQUE;
    END IF;
END $$;

-- 2. DISCIPLINE ATTENDANCE STATS VIEW
-- Calculates aggregate attendance per discipline for the Admin Dashboard
CREATE OR REPLACE VIEW discipline_attendance_stats AS
WITH discipline_metrics AS (
    SELECT 
        d.id as discipline_id,
        d.name as discipline_name,
        COUNT(DISTINCT c.id) as courses_count,
        COUNT(DISTINCT e.student_id) as students_count,
        SUM(c.credit_hours) as total_credit_hours
    FROM disciplines d
    LEFT JOIN courses c ON d.id = c.discipline_id
    LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'enrolled'
    GROUP BY d.id, d.name
),
attendance_agg AS (
    SELECT 
        c.discipline_id,
        AVG(calculate_student_attendance(la.student_id, c.id)) as avg_attendance
    FROM lecture_attendance la
    JOIN lectures l ON la.lecture_id = l.id
    JOIN courses c ON l.course_id = c.id
    WHERE l.status = 'completed'
    GROUP BY c.discipline_id
)
SELECT 
    m.*,
    COALESCE(ROUND(a.avg_attendance), 0) as attendance_percentage
FROM discipline_metrics m
LEFT JOIN attendance_agg a ON m.discipline_id = a.discipline_id;

-- 2. INSTRUCTOR DASHBOARD STATS VIEW
-- Provides quick metrics for the Instructor Dashboard
CREATE OR REPLACE VIEW instructor_dashboard_stats AS
SELECT 
    u.id as instructor_id,
    u.full_name as instructor_name,
    (SELECT COUNT(*) FROM lectures WHERE instructor_id = u.id AND status = 'completed') as total_classes,
    (SELECT COUNT(DISTINCT date) FROM faculty_attendance WHERE instructor_id = u.id AND status IN ('present', 'late')) as active_days,
    (SELECT COUNT(*) FROM exams WHERE created_by = u.id AND date >= CURRENT_DATE) as upcoming_exams,
    calculate_instructor_attendance(u.id) as persona_attendance_rate
FROM users u
WHERE u.role = 'instructor';

-- 3. LOW ATTENDANCE CALCULATION FUNCTION (Optimized)
-- This replaces the slow JS-side iteration
CREATE OR REPLACE FUNCTION get_low_attendance_students_func(threshold INT)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    presents BIGINT,
    absents BIGINT,
    leaves BIGINT,
    percentage FLOAT,
    total_lectures BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH student_stats AS (
        SELECT 
            u.id, 
            u.full_name, 
            u.email,
            COUNT(la.id) FILTER (WHERE la.status IN ('present', 'late', 'excused')) as presents,
            COUNT(la.id) FILTER (WHERE la.status = 'absent') as absents,
            COUNT(la.id) FILTER (WHERE la.status = 'leave') as leaves,
            COUNT(la.id) as total_lectures
        FROM users u
        JOIN enrollments e ON u.id = e.student_id
        JOIN lectures l ON e.course_id = l.course_id AND e.semester = l.semester
        LEFT JOIN lecture_attendance la ON u.id = la.student_id AND l.id = la.lecture_id
        WHERE u.role = 'student' AND u.status = 'active' AND l.status = 'completed'
        GROUP BY u.id, u.full_name, u.email
    )
    SELECT 
        s.id, 
        s.full_name, 
        s.email, 
        s.presents, 
        s.absents, 
        s.leaves,
        CASE WHEN s.total_lectures > 0 THEN (s.presents::FLOAT / s.total_lectures::FLOAT) * 100 ELSE 100 END as percentage,
        s.total_lectures
    FROM student_stats s
    WHERE (CASE WHEN s.total_lectures > 0 THEN (s.presents::FLOAT / s.total_lectures::FLOAT) * 100 ELSE 100 END) < threshold;
END;
$$ LANGUAGE plpgsql;

-- 4. ENSURE ALL TABLES HAVE UPDATED_AT TRIGGER
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') LOOP
        BEGIN
            EXECUTE format('CREATE TRIGGER trigger_update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_users_updated_at()', t, t);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END LOOP;
END $$;

-- 4. FIX COLUMN MISMATCH IN ATTENDANCE CORRECTIONS (If users-service or others need it)
-- Note: We will keep the database 'review_notes' as the truth and update the code to match.
-- But we can add an alias in a view if needed.
CREATE OR REPLACE VIEW attendance_corrections_standardized AS
SELECT 
    *,
    review_notes as review_comments
FROM attendance_corrections;

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS) HARDENING
-- ============================================

-- Helper to check user role from the users table using auth.uid()
-- Assuming auth.uid() matches clerk_id in our users table
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE clerk_id = auth.uid()::text LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. USERS Table Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for all" ON public.users;
DROP POLICY IF EXISTS "Enable write for all" ON public.users;

CREATE POLICY "Admins full access" ON public.users FOR ALL TO authenticated USING (public.get_auth_role() = 'admin');
CREATE POLICY "Users view own profile" ON public.users FOR SELECT TO authenticated USING (clerk_id = auth.uid()::text);
CREATE POLICY "Users update own profile" ON public.users FOR UPDATE TO authenticated USING (clerk_id = auth.uid()::text) WITH CHECK (clerk_id = auth.uid()::text);
CREATE POLICY "Students/Instructors view relevant profiles" ON public.users FOR SELECT TO authenticated 
USING (
    role = 'instructor' OR 
    (role = 'student' AND EXISTS (
        SELECT 1 FROM public.enrollments e 
        JOIN public.courses c ON e.course_id = c.id 
        WHERE e.student_id = public.users.id AND c.instructor_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text)
    ))
);

-- 2. COURSES Table Policies
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for all" ON public.courses;
DROP POLICY IF EXISTS "Enable write for all" ON public.courses;

CREATE POLICY "Admins course full access" ON public.courses FOR ALL TO authenticated USING (public.get_auth_role() = 'admin');
CREATE POLICY "Instructors view/edit own courses" ON public.courses FOR SELECT TO authenticated USING (instructor_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Instructors update own courses" ON public.courses FOR UPDATE TO authenticated USING (instructor_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Students view enrolled courses" ON public.courses FOR SELECT TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.enrollments e 
    WHERE e.course_id = public.courses.id AND e.student_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text)
));

-- 3. ATTENDANCE (Lecture Attendance) Policies
ALTER TABLE public.lecture_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for all" ON public.lecture_attendance;
DROP POLICY IF EXISTS "Enable write for all" ON public.lecture_attendance;

CREATE POLICY "Admins attendance access" ON public.lecture_attendance FOR ALL TO authenticated USING (public.get_auth_role() = 'admin');
CREATE POLICY "Instructors manage own lecture attendance" ON public.lecture_attendance FOR ALL TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.lectures l 
    JOIN public.courses c ON l.course_id = c.id 
    WHERE l.id = public.lecture_attendance.lecture_id AND c.instructor_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text)
));
CREATE POLICY "Students view own attendance" ON public.lecture_attendance FOR SELECT TO authenticated 
USING (student_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text));

-- 4. ATTENDANCE CORRECTIONS Policies
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for all" ON public.attendance_corrections;
DROP POLICY IF EXISTS "Enable write for all" ON public.attendance_corrections;

CREATE POLICY "Students submit own corrections" ON public.attendance_corrections FOR INSERT TO authenticated 
WITH CHECK (student_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Students view own corrections" ON public.attendance_corrections FOR SELECT TO authenticated 
USING (student_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Instructors manage course corrections" ON public.attendance_corrections FOR ALL TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.lectures l 
    JOIN public.courses c ON l.course_id = c.id 
    WHERE l.id = public.attendance_corrections.lecture_id AND c.instructor_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text)
));

-- 5. ASSIGNMENTS & SUBMISSIONS Policies
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors manage assignments" ON public.assignments FOR ALL TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.courses c 
    WHERE c.id = public.assignments.course_id AND c.instructor_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text)
));
CREATE POLICY "Students view assignments" ON public.assignments FOR SELECT TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.enrollments e 
    WHERE e.course_id = public.assignments.course_id AND e.student_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text)
));

CREATE POLICY "Students manage own submissions" ON public.assignment_submissions FOR ALL TO authenticated 
USING (student_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Instructors view/grade submissions" ON public.assignment_submissions FOR SELECT TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.assignments a 
    JOIN public.courses c ON a.course_id = c.id 
    WHERE a.id = public.assignment_submissions.assignment_id AND c.instructor_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text)
));
CREATE POLICY "Instructors update (grade) submissions" ON public.assignment_submissions FOR UPDATE TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.assignments a 
    JOIN public.courses c ON a.course_id = c.id 
    WHERE a.id = public.assignment_submissions.assignment_id AND c.instructor_id = (SELECT id FROM public.users WHERE clerk_id = auth.uid()::text)
));

-- 6. AUDIT LOGS (Strict)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.get_auth_role() = 'admin');
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$ 
BEGIN
  RAISE NOTICE '✅ RLS Policies Hardened Successfully';
  RAISE NOTICE '✅ Admins: UNRESTRICTED';
  RAISE NOTICE '✅ Instructors: Course/Student scope';
  RAISE NOTICE '✅ Students: Self scope';
END $$;
