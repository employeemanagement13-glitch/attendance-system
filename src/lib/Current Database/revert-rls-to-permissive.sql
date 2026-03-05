-- ============================================================
-- RLS REVERT TO PERMISSIVE MODE
--
-- WHY: This app uses Clerk for auth + Supabase anon key for
-- data access. Supabase auth.uid() is ALWAYS NULL because
-- Clerk JWTs are not forwarded to Supabase. This means ALL
-- restrictive RLS policies break every query in the app.
--
-- SOLUTION: Revert to permissive read/write policies for
-- authenticated and anon roles. The authorization is handled
-- at the application layer (layout.tsx role checks via RPC).
--
-- Run this in Supabase SQL Editor BEFORE rls-fix-for-redirection.sql
-- ============================================================

-- Drop all the restrictive policies added by remedy-overhaul.sql
DROP POLICY IF EXISTS "Admins full access" ON public.users;
DROP POLICY IF EXISTS "Users view own profile" ON public.users;
DROP POLICY IF EXISTS "Users update own profile" ON public.users;
DROP POLICY IF EXISTS "Students/Instructors view relevant profiles" ON public.users;

DROP POLICY IF EXISTS "Admins course full access" ON public.courses;
DROP POLICY IF EXISTS "Instructors view/edit own courses" ON public.courses;
DROP POLICY IF EXISTS "Instructors update own courses" ON public.courses;
DROP POLICY IF EXISTS "Students view enrolled courses" ON public.courses;

DROP POLICY IF EXISTS "Admins manage enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Students view own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Instructors view course enrollments" ON public.enrollments;

DROP POLICY IF EXISTS "Admins manage lectures" ON public.lectures;
DROP POLICY IF EXISTS "Instructors manage own lectures" ON public.lectures;
DROP POLICY IF EXISTS "Students view enrolled lectures" ON public.lectures;

DROP POLICY IF EXISTS "Admins manage attendance" ON public.lecture_attendance;
DROP POLICY IF EXISTS "Instructors manage course attendance" ON public.lecture_attendance;
DROP POLICY IF EXISTS "Students view own attendance" ON public.lecture_attendance;

DROP POLICY IF EXISTS "Instructors manage assignments" ON public.assignments;
DROP POLICY IF EXISTS "Students view assignments" ON public.assignments;
DROP POLICY IF EXISTS "Students manage own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Instructors view/grade submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Instructors update (grade) submissions" ON public.assignment_submissions;

DROP POLICY IF EXISTS "Only admins view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Re-enable permissive access for all tables
-- (App-layer authorization via role checks in layout.tsx)
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN (
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ) LOOP
        BEGIN
            -- Disable RLS on every table to restore full access
            EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Skip tables that can't be altered
        END;
    END LOOP;
END $$;

SELECT 'RLS reverted to permissive mode. All tables now accessible.' AS status;
