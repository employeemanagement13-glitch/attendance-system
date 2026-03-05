-- ============================================
-- RLS POLICY FIX SCRIPT
-- ============================================
-- The previous policies used "WITH CHECK" but missing "USING".
-- "USING" is REQUIRED for UPDATE and DELETE visibility.
-- Run this script in your Supabase SQL Editor to fix persistence.

-- 1. Departments
DROP POLICY IF EXISTS "Enable write for all" ON public.departments;
CREATE POLICY "Enable write for all" ON public.departments FOR ALL USING (true) WITH CHECK (true);

-- 2. Users
DROP POLICY IF EXISTS "Enable write for all" ON public.users;
CREATE POLICY "Enable write for all" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- 3. Disciplines
DROP POLICY IF EXISTS "Enable write for all" ON public.disciplines;
CREATE POLICY "Enable write for all" ON public.disciplines FOR ALL USING (true) WITH CHECK (true);

-- 4. Courses
DROP POLICY IF EXISTS "Enable write for all" ON public.courses;
CREATE POLICY "Enable write for all" ON public.courses FOR ALL USING (true) WITH CHECK (true);

-- 5. Enrollments
DROP POLICY IF EXISTS "Enable write for all" ON public.enrollments;
CREATE POLICY "Enable write for all" ON public.enrollments FOR ALL USING (true) WITH CHECK (true);

-- 6. Lectures
DROP POLICY IF EXISTS "Enable write for all" ON public.lectures;
CREATE POLICY "Enable write for all" ON public.lectures FOR ALL USING (true) WITH CHECK (true);

-- 7. Lecture Attendance
DROP POLICY IF EXISTS "Enable write for all" ON public.lecture_attendance;
CREATE POLICY "Enable write for all" ON public.lecture_attendance FOR ALL USING (true) WITH CHECK (true);

-- 8. Faculty Attendance
DROP POLICY IF EXISTS "Enable write for all" ON public.faculty_attendance;
CREATE POLICY "Enable write for all" ON public.faculty_attendance FOR ALL USING (true) WITH CHECK (true);

-- 9. Exams
DROP POLICY IF EXISTS "Enable write for all" ON public.exams;
CREATE POLICY "Enable write for all" ON public.exams FOR ALL USING (true) WITH CHECK (true);

-- 10. Exam Results
DROP POLICY IF EXISTS "Enable write for all" ON public.exam_results;
CREATE POLICY "Enable write for all" ON public.exam_results FOR ALL USING (true) WITH CHECK (true);

-- 11. Leaves
DROP POLICY IF EXISTS "Enable write for all" ON public.leaves;
CREATE POLICY "Enable write for all" ON public.leaves FOR ALL USING (true) WITH CHECK (true);

-- 12. Assignments
DROP POLICY IF EXISTS "Enable write for all" ON public.assignments;
CREATE POLICY "Enable write for all" ON public.assignments FOR ALL USING (true) WITH CHECK (true);

-- 13. Assignment Submissions
DROP POLICY IF EXISTS "Enable write for all" ON public.assignment_submissions;
CREATE POLICY "Enable write for all" ON public.assignment_submissions FOR ALL USING (true) WITH CHECK (true);

-- 14. Course Materials
DROP POLICY IF EXISTS "Enable write for all" ON public.course_materials;
CREATE POLICY "Enable write for all" ON public.course_materials FOR ALL USING (true) WITH CHECK (true);

-- 15. Resources
DROP POLICY IF EXISTS "Enable write for all" ON public.resources;
CREATE POLICY "Enable write for all" ON public.resources FOR ALL USING (true) WITH CHECK (true);

-- 16. Announcements
DROP POLICY IF EXISTS "Enable write for all" ON public.announcements;
CREATE POLICY "Enable write for all" ON public.announcements FOR ALL USING (true) WITH CHECK (true);

-- 17. Notifications
DROP POLICY IF EXISTS "Enable write for all" ON public.notifications;
CREATE POLICY "Enable write for all" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- 18. Attendance Corrections
DROP POLICY IF EXISTS "Enable write for all" ON public.attendance_corrections;
CREATE POLICY "Enable write for all" ON public.attendance_corrections FOR ALL USING (true) WITH CHECK (true);

-- 19. Office Hours
DROP POLICY IF EXISTS "Enable write for all" ON public.office_hours;
CREATE POLICY "Enable write for all" ON public.office_hours FOR ALL USING (true) WITH CHECK (true);

-- 20. Appointments
DROP POLICY IF EXISTS "Enable write for all" ON public.appointments;
CREATE POLICY "Enable write for all" ON public.appointments FOR ALL USING (true) WITH CHECK (true);

-- 21. System Settings
DROP POLICY IF EXISTS "Enable write for all" ON public.system_settings;
CREATE POLICY "Enable write for all" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

-- 22. Semester GPA
DROP POLICY IF EXISTS "Enable write for all" ON public.semester_gpa;
CREATE POLICY "Enable write for all" ON public.semester_gpa FOR ALL USING (true) WITH CHECK (true);

-- 23. Student Course Grades
DROP POLICY IF EXISTS "Enable write for all" ON public.student_course_grades;
CREATE POLICY "Enable write for all" ON public.student_course_grades FOR ALL USING (true) WITH CHECK (true);
