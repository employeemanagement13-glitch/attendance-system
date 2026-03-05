-- ============================================
-- DROP ALL TABLES AND TYPES - CLEAN SLATE
-- ============================================
-- Run this BEFORE complete-schema.sql if you want a fresh start
-- WARNING: This will delete ALL data!

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.semester_gpa CASCADE;
DROP TABLE IF EXISTS public.student_course_grades CASCADE;
DROP TABLE IF EXISTS public.blocked_users CASCADE;
DROP TABLE IF EXISTS public.login_attempts CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.office_hours CASCADE;
DROP TABLE IF EXISTS public.holidays CASCADE;
DROP TABLE IF EXISTS public.attendance_corrections CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.resources CASCADE;
DROP TABLE IF EXISTS public.course_materials CASCADE;
DROP TABLE IF EXISTS public.assignment_submissions CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.leaves CASCADE;
DROP TABLE IF EXISTS public.exam_results CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.faculty_attendance CASCADE;
DROP TABLE IF EXISTS public.lecture_attendance CASCADE;
DROP TABLE IF EXISTS public.lectures CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.disciplines CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS assignment_status CASCADE;
DROP TYPE IF EXISTS leave_status CASCADE;
DROP TYPE IF EXISTS exam_type CASCADE;
DROP TYPE IF EXISTS lecture_status CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS app_role CASCADE;

-- Note: UUID extension is kept as it's harmless and may be used elsewhere
-- If you want to drop it too, uncomment:
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- Now you can run complete-schema.sql and complete-seed.sql
