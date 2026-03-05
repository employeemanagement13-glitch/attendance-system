-- Insert the Main Admin
INSERT INTO public.users (email, full_name, role, status)
VALUES 
  ('usingantigravity@gmail.com', 'System Admin', 'admin', 'active')
ON CONFLICT (email) DO NOTHING;

-- Sample Departments
INSERT INTO public.departments (name, hod, description)
VALUES 
  ('Computer Science Department', 'Dr. Alice Johnson', 'Department of Computer Science and Information Technology'),
  ('Electrical Engineering Department', 'Dr. Bob Williams', 'Department of Electrical and Electronics Engineering'),
  ('Business Administration Department', 'Dr. Catherine Davis', 'Department of Business and Management Sciences'),
  ('Mathematics Department', 'Dr. David Miller', 'Department of Mathematics and Statistics')
ON CONFLICT (name) DO NOTHING;

-- Sample Disciplines
INSERT INTO public.disciplines (name, department)
VALUES 
  ('BSCS', 'Computer Science'),
  ('BSSE', 'Software Engineering'),
  ('BBA', 'Management Sciences'),
  ('BSEE', 'Electrical Engineering'),
  ('BSMATH', 'Mathematics')
ON CONFLICT (name) DO NOTHING;

-- Sample System Settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('maintenance_mode', 'false', 'Enable or disable maintenance mode'),
  ('support_email', 'support@university.edu', 'System support email address'),
  ('current_semester', 'Fall 2024', 'Current active semester'),
  ('semester_end_date', '2024-12-20', 'End date of current semester'),
  ('warning_threshold', '75', 'Attendance warning threshold percentage'),
  ('debarment_threshold', '60', 'Attendance debarment threshold percentage')
ON CONFLICT (key) DO NOTHING;

-- Sample Instructors
DO $$
DECLARE
  dept_cs_id UUID;
  dept_ee_id UUID;
  dept_ba_id UUID;
BEGIN
  SELECT id INTO dept_cs_id FROM public.departments WHERE name = 'Computer Science Department' LIMIT 1;
  SELECT id INTO dept_ee_id FROM public.departments WHERE name = 'Electrical Engineering Department' LIMIT 1;
  SELECT id INTO dept_ba_id FROM public.departments WHERE name = 'Business Administration Department' LIMIT 1;

  INSERT INTO public.users (email, full_name, role, department_id, status, phone)
  VALUES 
    ('dr.smith@university.edu', 'Dr. Alice Smith', 'instructor', dept_cs_id, 'active', '+1-555-0101'),
    ('prof.johnson@university.edu', 'Prof. Bob Johnson', 'instructor', dept_cs_id, 'active', '+1-555-0102'),
    ('dr.williams@university.edu', 'Dr. Charlie Williams', 'instructor', dept_ee_id, 'active', '+1-555-0103'),
    ('prof.davis@university.edu', 'Prof. Diana Davis', 'instructor', dept_ba_id, 'active', '+1-555-0104'),
    ('dr.jones@university.edu', 'Dr. Edward Jones', 'instructor', dept_cs_id, 'inactive', '+1-555-0105')
  ON CONFLICT (email) DO NOTHING;
END $$;

-- Sample Students
DO $$
DECLARE
  dept_cs_id UUID;
  dept_ee_id UUID;
  dept_ba_id UUID;
BEGIN
  SELECT id INTO dept_cs_id FROM public.departments WHERE name = 'Computer Science Department' LIMIT 1;
  SELECT id INTO dept_ee_id FROM public.departments WHERE name = 'Electrical Engineering Department' LIMIT 1;
  SELECT id INTO dept_ba_id FROM public.departments WHERE name = 'Business Administration Department' LIMIT 1;

  INSERT INTO public.users (email, full_name, role, department_id, status, phone)
  VALUES 
    ('student1@university.edu', 'John Doe', 'student', dept_cs_id, 'active', '+1-555-1001'),
    ('student2@university.edu', 'Jane Smith', 'student', dept_cs_id, 'active', '+1-555-1002'),
    ('student3@university.edu', 'Michael Brown', 'student', dept_ee_id, 'active', '+1-555-1003'),
    ('student4@university.edu', 'Emily Wilson', 'student', dept_ba_id, 'active', '+1-555-1004'),
    ('student5@university.edu', 'Sarah Johnson', 'student', dept_cs_id, 'active', '+1-555-1005')
  ON CONFLICT (email) DO NOTHING;
END $$;

-- Sample Courses
DO $$
DECLARE
  disc_bscs_id UUID;
  disc_bsse_id UUID;
  disc_bba_id UUID;
  instr1_id UUID;
  instr2_id UUID;
  instr3_id UUID;
BEGIN
  SELECT id INTO disc_bscs_id FROM public.disciplines WHERE name = 'BSCS' LIMIT 1;
  SELECT id INTO disc_bsse_id FROM public.disciplines WHERE name = 'BSSE' LIMIT 1;
  SELECT id INTO disc_bba_id FROM public.disciplines WHERE name = 'BBA' LIMIT 1;
  SELECT id INTO instr1_id FROM public.users WHERE email = 'dr.smith@university.edu' LIMIT 1;
  SELECT id INTO instr2_id FROM public.users WHERE email = 'prof.johnson@university.edu' LIMIT 1;
  SELECT id INTO instr3_id FROM public.users WHERE email = 'prof.davis@university.edu' LIMIT 1;

  INSERT INTO public.courses (code, name, discipline_id, instructor_id, semester, credit_hours)
  VALUES 
    ('CS101', 'Introduction to Computing', disc_bscs_id, instr1_id, 1, 3),
    ('CS202', 'Data Structures', disc_bscs_id, instr1_id, 3, 4),
    ('SE301', 'Software Engineering', disc_bsse_id, instr2_id, 5, 3),
    ('MATH101', 'Calculus I', disc_bscs_id, instr2_id, 1, 3),
    ('BBA101', 'Introduction to Business', disc_bba_id, instr3_id, 1, 3)
  ON CONFLICT (code) DO NOTHING;
END $$;

-- Sample Enrollments
DO $$
DECLARE
  student1_id UUID;
  student2_id UUID;
  course_cs101_id UUID;
  course_cs202_id UUID;
  course_math101_id UUID;
BEGIN
  SELECT id INTO student1_id FROM public.users WHERE email = 'student1@university.edu' LIMIT 1;
  SELECT id INTO student2_id FROM public.users WHERE email = 'student2@university.edu' LIMIT 1;
  SELECT id INTO course_cs101_id FROM public.courses WHERE code = 'CS101' LIMIT 1;
  SELECT id INTO course_cs202_id FROM public.courses WHERE code = 'CS202' LIMIT 1;
  SELECT id INTO course_math101_id FROM public.courses WHERE code = 'MATH101' LIMIT 1;

  INSERT INTO public.enrollments (student_id, course_id)
  VALUES 
    (student1_id, course_cs101_id),
    (student1_id, course_cs202_id),
    (student2_id, course_cs101_id),
    (student2_id, course_math101_id)
  ON CONFLICT (student_id, course_id) DO NOTHING;
END $$;

-- Sample Notifications
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM public.users WHERE email = 'usingantigravity@gmail.com' LIMIT 1;

  INSERT INTO public.notifications (title, message, type, status, created_by)
  VALUES 
    ('System Maintenance Scheduled', 'The system will undergo maintenance this Sunday from 2 AM to 6 AM.', 'system', 'unread', admin_id),
    ('Grade Submission Deadline', 'All instructors must submit final grades by December 20, 2024.', 'academic', 'read', admin_id),
    ('Low Attendance Alert', 'Multiple students have attendance below 75%. Review required.', 'alert', 'unread', admin_id)
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
    (admin_id, admin_email, 'System Initialized', 'system', 'Initial system setup completed', 'system', '192.168.1.1'),
    (admin_id, admin_email, 'Created Department', 'department', 'Created Computer Science Department', 'user', '192.168.1.1'),
    (admin_id, admin_email, 'Created Course', 'course', 'Created CS101 - Introduction to Computing', 'user', '192.168.1.1'),
    (NULL, 'unknown@user.com', 'Failed Login Attempt', 'security', 'Multiple failed login attempts detected', 'security', '10.0.0.5')
  ON CONFLICT DO NOTHING;
END $$;

-- Sample Resources (Note: Actual files need to be uploaded to Supabase Storage)
DO $$
DECLARE
  course_cs101_id UUID;
  instr1_id UUID;
BEGIN
  SELECT id INTO course_cs101_id FROM public.courses WHERE code = 'CS101' LIMIT 1;
  SELECT id INTO instr1_id FROM public.users WHERE email = 'dr.smith@university.edu' LIMIT 1;

  INSERT INTO public.resources (name, file_path, file_type, file_size, course_id, uploaded_by, description)
  VALUES 
    ('Lecture 1 Slides.pdf', 'courses/cs101/lecture1_slides.pdf', 'PDF', 2048000, course_cs101_id, instr1_id, 'Introduction to Computing - Lecture 1'),
    ('Lab Manual.docx', 'courses/cs101/lab_manual.docx', 'DOCX', 3584000, course_cs101_id, instr1_id, 'Lab exercises and guidelines')
  ON CONFLICT DO NOTHING;
END $$;

