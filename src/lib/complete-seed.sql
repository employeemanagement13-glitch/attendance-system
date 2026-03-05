-- ============================================
-- LMS + AMS Seed Data
-- ============================================
-- Run this AFTER the complete-schema.sql

-- Insert the Main Admin
INSERT INTO public.users (email, full_name, role, status)
VALUES 
  ('usingantigravity@gmail.com', 'System Admin', 'admin', 'active')
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Sample Departments
INSERT INTO public.departments (id, name, hod, description)
VALUES 
  ('11111111-1111-1111-1111-111111111111'::UUID, 'Computer Science Department', 'Dr. Alice Johnson', 'Department of Computer Science and Information Technology'),
  ('22222222-2222-2222-2222-222222222222'::UUID, 'Electrical Engineering Department', 'Dr. Bob Williams', 'Department of Electrical and Electronics Engineering'),
  ('33333333-3333-3333-3333-333333333333'::UUID, 'Business Administration Department', 'Dr. Catherine Davis', 'Department of Business and Management Sciences'),
  ('44444444-4444-4444-4444-444444444444'::UUID, 'Mathematics Department', 'Dr. David Miller', 'Department of Mathematics and Statistics')
ON CONFLICT (id) DO UPDATE SET hod = EXCLUDED.hod;

-- Sample Disciplines
INSERT INTO public.disciplines (name, department_id)
VALUES 
  ('BSCS', '11111111-1111-1111-1111-111111111111'::UUID),
  ('BSSE', '11111111-1111-1111-1111-111111111111'::UUID),
  ('BBA', '33333333-3333-3333-3333-333333333333'::UUID),
  ('BSEE', '22222222-2222-2222-2222-222222222222'::UUID),
  ('BSMATH', '44444444-4444-4444-4444-444444444444'::UUID)
ON CONFLICT (name) DO UPDATE SET department_id = EXCLUDED.department_id;

-- Sample System Settings
INSERT INTO public.system_settings (key, value, description, category)
VALUES 
  ('maintenance_mode', 'false', 'Enable or disable maintenance mode', 'general'),
  ('support_email', 'support@university.edu', 'System support email address', 'general'),
  ('current_semester', 'Fall 2024', 'Current active semester', 'academic'),
  ('academic_year', '2024-2025', 'Current academic year', 'academic'),
  ('semester_start_date', '2024-09-01', 'Start date of current semester', 'academic'),
  ('semester_end_date', '2024-12-20', 'End date of current semester', 'academic'),
  ('warning_threshold', '75', 'Attendance warning threshold percentage', 'attendance'),
  ('debarment_threshold', '60', 'Attendance debarment threshold percentage', 'attendance'),
  ('max_login_attempts', '3', 'Maximum failed login attempts before blocking', 'security'),
  ('session_timeout', '30', 'Session timeout in minutes', 'security')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Sample Instructors
DO $$
BEGIN
  INSERT INTO public.users (email, full_name, role, department_id, status, phone, designation, education, office_location, daily_time_start, daily_time_end, availability)
  VALUES 
    ('dr.smith@university.edu', 'Dr. Alice Smith', 'instructor', '11111111-1111-1111-1111-111111111111'::UUID, 'active', '+1-555-0101', 'Professor', 'PhD in Computer Science', 'SST-804A', '08:00', '17:00', 'Monday - Friday'),
    ('prof.johnson@university.edu', 'Prof. Bob Johnson', 'instructor', '11111111-1111-1111-1111-111111111111'::UUID, 'active', '+1-555-0102', 'Associate Professor', 'PhD in Software Engineering', 'SST-805B', '09:00', '18:00', 'Monday - Friday'),
    ('dr.williams@university.edu', 'Dr. Charlie Williams', 'instructor', '22222222-2222-2222-2222-222222222222'::UUID, 'active', '+1-555-0103', 'Assistant Professor', 'PhD in Electrical Engineering', 'EE-301C', '08:00', '16:00', 'Monday - Saturday'),
    ('prof.davis@university.edu', 'Prof. Diana Davis', 'instructor', '33333333-3333-3333-3333-333333333333'::UUID, 'active', '+1-555-0104', 'Professor', 'PhD in Business Administration', 'BBA-201D', '10:00', '19:00', 'Monday - Friday'),
    ('dr.jones@university.edu', 'Dr. Edward Jones', 'instructor', '11111111-1111-1111-1111-111111111111'::UUID, 'active', '+1-555-0105', 'Lecturer', 'MsCs in Data Science', 'SST-702E', '08:00', '17:00', 'Monday - Thursday')
  ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name;
END $$;

-- Sample Students
DO $$
BEGIN
  INSERT INTO public.users (email, full_name, role, department_id, status, phone, cgpa, gpa)
  VALUES 
    ('student1@university.edu', 'John Doe', 'student', '11111111-1111-1111-1111-111111111111'::UUID, 'active', '+1-555-1001', 3.75, 3.80),
    ('student2@university.edu', 'Jane Smith', 'student', '11111111-1111-1111-1111-111111111111'::UUID, 'active', '+1-555-1002', 3.90, 3.95),
    ('student3@university.edu', 'Michael Brown', 'student', '22222222-2222-2222-2222-222222222222'::UUID, 'active', '+1-555-1003', 3.20, 3.10),
    ('student4@university.edu', 'Emily Wilson', 'student', '33333333-3333-3333-3333-333333333333'::UUID, 'active', '+1-555-1004', 3.85, 3.90),
    ('student5@university.edu', 'Sarah Johnson', 'student', '11111111-1111-1111-1111-111111111111'::UUID, 'active', '+1-555-1005', 2.95, 2.80),
    ('student6@university.edu', 'David Lee', 'student', '11111111-1111-1111-1111-111111111111'::UUID, 'active', '+1-555-1006', 3.50, 3.45),
    ('student7@university.edu', 'Maria Garcia', 'student', '22222222-2222-2222-2222-222222222222'::UUID, 'active', '+1-555-1007', 3.65, 3.70),
    ('student8@university.edu', 'James Martinez', 'student', '33333333-3333-3333-3333-333333333333'::UUID, 'active', '+1-555-1008', 3.40, 3.35)
  ON CONFLICT (email) DO UPDATE SET cgpa = EXCLUDED.cgpa, gpa = EXCLUDED.gpa;
END $$;

-- Sample Courses
DO $$
DECLARE
  disc_bscs_id UUID;
  disc_bsse_id UUID;
  disc_bba_id UUID;
  disc_bsee_id UUID;
  instr1_id UUID;
  instr2_id UUID;
  instr3_id UUID;
  instr4_id UUID;
  instr5_id UUID;
BEGIN
  SELECT id INTO disc_bscs_id FROM public.disciplines WHERE name = 'BSCS' LIMIT 1;
  SELECT id INTO disc_bsse_id FROM public.disciplines WHERE name = 'BSSE' LIMIT 1;
  SELECT id INTO disc_bba_id FROM public.disciplines WHERE name = 'BBA' LIMIT 1;
  SELECT id INTO disc_bsee_id FROM public.disciplines WHERE name = 'BSEE' LIMIT 1;
  SELECT id INTO instr1_id FROM public.users WHERE email = 'dr.smith@university.edu' LIMIT 1;
  SELECT id INTO instr2_id FROM public.users WHERE email = 'prof.johnson@university.edu' LIMIT 1;
  SELECT id INTO instr3_id FROM public.users WHERE email = 'prof.davis@university.edu' LIMIT 1;
  SELECT id INTO instr4_id FROM public.users WHERE email = 'dr.williams@university.edu' LIMIT 1;
  SELECT id INTO instr5_id FROM public.users WHERE email = 'dr.jones@university.edu' LIMIT 1;

  INSERT INTO public.courses (code, name, discipline_id, instructor_id, semester, section, credit_hours, room, time_start, time_end, active_days)
  VALUES 
    ('CS101', 'Introduction to Computing', disc_bscs_id, instr1_id, 1, 'A', 3, 'Room 301', '08:00', '09:30', 'Mon,Wed,Fri'),
    ('CS101', 'Introduction to Computing', disc_bscs_id, instr2_id, 1, 'B', 3, 'Room 302', '10:00', '11:30', 'Mon,Wed,Fri'),
    ('CS202', 'Data Structures', disc_bscs_id, instr1_id, 3, 'A', 4, 'Lab 101', '13:00', '15:00', 'Tue,Thu'),
    ('SE301', 'Software Engineering', disc_bsse_id, instr2_id, 5, 'A', 3, 'Room 305', '09:00', '10:30', 'Mon,Wed,Fri'),
    ('MATH101', 'Calculus I', disc_bscs_id, instr5_id, 1, 'A', 3, 'Room 201', '11:00', '12:30', 'Tue,Thu'),
    ('BBA101', 'Introduction to Business', disc_bba_id, instr3_id, 1, 'A', 3, 'Room 401', '14:00', '15:30', 'Mon,Wed'),
    ('EE201', 'Circuit Theory', disc_bsee_id, instr4_id, 3, 'A', 4, 'EE Lab', '08:00', '10:00', 'Mon,Thu')
  ON CONFLICT (code, semester, section) DO NOTHING;
END $$;

-- Sample Enrollments
DO $$
DECLARE
  student1_id UUID;
  student2_id UUID;
  student3_id UUID;
  student4_id UUID;
  student5_id UUID;
  course_cs101a_id UUID;
  course_cs101b_id UUID;
  course_cs202_id UUID;
  course_math101_id UUID;
  course_bba101_id UUID;
  course_ee201_id UUID;
BEGIN
  SELECT id INTO student1_id FROM public.users WHERE email = 'student1@university.edu' LIMIT 1;
  SELECT id INTO student2_id FROM public.users WHERE email = 'student2@university.edu' LIMIT 1;
  SELECT id INTO student3_id FROM public.users WHERE email = 'student3@university.edu' LIMIT 1;
  SELECT id INTO student4_id FROM public.users WHERE email = 'student4@university.edu' LIMIT 1;
  SELECT id INTO student5_id FROM public.users WHERE email = 'student5@university.edu' LIMIT 1;
  SELECT id INTO course_cs101a_id FROM public.courses WHERE code = 'CS101' AND section = 'A' LIMIT 1;
  SELECT id INTO course_cs101b_id FROM public.courses WHERE code = 'CS101' AND section = 'B' LIMIT 1;
  SELECT id INTO course_cs202_id FROM public.courses WHERE code = 'CS202' LIMIT 1;
  SELECT id INTO course_math101_id FROM public.courses WHERE code = 'MATH101' LIMIT 1;
  SELECT id INTO course_bba101_id FROM public.courses WHERE code = 'BBA101' LIMIT 1;
  SELECT id INTO course_ee201_id FROM public.courses WHERE code = 'EE201' LIMIT 1;

  INSERT INTO public.enrollments (student_id, course_id, semester, section, status)
  VALUES 
    (student1_id, course_cs101a_id, 1, 'A', 'enrolled'),
    (student1_id, course_math101_id, 1, 'A', 'enrolled'),
    (student2_id, course_cs101a_id, 1, 'A', 'enrolled'),
    (student2_id, course_math101_id, 1, 'A', 'enrolled'),
    (student3_id, course_ee201_id, 3, 'A', 'enrolled'),
    (student4_id, course_bba101_id, 1, 'A', 'enrolled'),
    (student5_id, course_cs101b_id, 1, 'B', 'enrolled')
  ON CONFLICT (student_id, course_id, semester, section) DO NOTHING;
END $$;

-- Sample Holidays
INSERT INTO public.holidays (name, date, type, description)
VALUES 
  ('New Year', '2025-01-01', 'public', 'New Year Holiday'),
  ('Independence Day', '2025-08-14', 'public', 'National Independence Day'),
  ('Winter Break Start', '2024-12-21', 'semester_break', 'Winter semester break begins'),
  ('Winter Break End', '2025-01-15', 'semester_break', 'Winter semester break ends'),
  ('Eid ul-Fitr', '2025-04-10', 'public', 'Eid Festival'),
  ('Mid-Semester Break', '2024-10-15', 'academic', 'Mid-semester break')
ON CONFLICT DO NOTHING;

-- Sample Notifications
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM public.users WHERE email = 'usingantigravity@gmail.com' LIMIT 1;

  INSERT INTO public.notifications (title, message, type, target_role, created_by)
  VALUES 
    ('System Maintenance Scheduled', 'The system will undergo maintenance this Sunday from 2 AM to 6 AM.', 'system', NULL, admin_id),
    ('Grade Submission Deadline', 'All instructors must submit final grades by December 20, 2024.', 'academic', 'instructor', admin_id),
    ('Low Attendance Alert', 'Multiple students have attendance below 75%. Review required.', 'alert', 'admin', admin_id),
    ('Exam Schedule Released', 'The mid-term examination schedule has been published. Please check your courses.', 'academic', 'student', admin_id)
  ON CONFLICT DO NOTHING;
END $$;

-- Sample Audit Logs
DO $$
DECLARE
  admin_id UUID;
  admin_email TEXT;
BEGIN
  SELECT id, email INTO admin_id, admin_email FROM public.users WHERE email = 'usingantigravity@gmail.com' LIMIT 1;

  INSERT INTO public.audit_logs (user_id, user_email, action, entity_type, details, type, ip_address)
  VALUES 
    (admin_id, admin_email, 'System Initialized', 'system', 'Complete LMS+AMS system setup', 'system', '192.168.1.1'),
    (admin_id, admin_email, 'Created Department', 'department', 'Created Computer Science Department', 'user', '192.168.1.1'),
    (admin_id, admin_email, 'Created Course', 'course', 'Created CS101 - Introduction to Computing', 'user', '192.168.1.1'),
    (NULL, 'unknown@user.com', 'Failed Login Attempt', 'security', 'Multiple failed login attempts detected', 'security', '10.0.0.5')
  ON CONFLICT DO NOTHING;
END $$;

-- Sample Office Hours
DO $$
DECLARE
  instr1_id UUID;
  instr2_id UUID;
BEGIN
  SELECT id INTO instr1_id FROM public.users WHERE email = 'dr.smith@university.edu' LIMIT 1;
  SELECT id INTO instr2_id FROM public.users WHERE email = 'prof.johnson@university.edu' LIMIT 1;

  INSERT INTO public.office_hours (instructor_id, day_of_week, time_start, time_end, location, is_active)
  VALUES 
    (instr1_id, 1, '14:00', '16:00', 'SST-804A', true), -- Monday
    (instr1_id, 3, '14:00', '16:00', 'SST-804A', true), -- Wednesday
    (instr2_id, 2, '15:00', '17:00', 'SST-805B', true), -- Tuesday
    (instr2_id, 4, '15:00', '17:00', 'SST-805B', true)  -- Thursday
  ON CONFLICT DO NOTHING;
END $$;

-- Sample Announcements
DO $$
DECLARE
  admin_id UUID;
  course_cs101_id UUID;
BEGIN
  SELECT id INTO admin_id FROM public.users WHERE email = 'usingantigravity@gmail.com' LIMIT 1;
  SELECT id INTO course_cs101_id FROM public.courses WHERE code = 'CS101' LIMIT 1;

  INSERT INTO public.announcements (title, content, type, course_id, created_by)
  VALUES 
    ('Welcome to Fall 2024', 'Welcome to the Fall 2024 semester. We wish you all the best!', 'system', NULL, admin_id),
    ('CS101 Assignment Due', 'Your first assignment for CS101 is due on October 15, 2024.', 'course', course_cs101_id, admin_id),
    ('Library Timings Updated', 'The library will now be open from 8 AM to 10 PM on weekdays.', 'system', NULL, admin_id)
  ON CONFLICT DO NOTHING;
END $$;
