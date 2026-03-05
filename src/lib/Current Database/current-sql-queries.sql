-- SCHEMA



-- ============================================
-- LMS + AMS Complete Database Schema
-- ============================================
-- This schema builds upon your existing structure
-- Run this AFTER your existing schema or use it to replace

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

-- Create Roles Enum
CREATE TYPE app_role AS ENUM ('admin', 'instructor', 'student');

-- Create additional enums for the system
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused', 'leave');
CREATE TYPE lecture_status AS ENUM ('scheduled', 'completed', 'cancelled', 'rescheduled');
CREATE TYPE exam_type AS ENUM ('mids', 'finals', 'quiz');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE assignment_status AS ENUM ('pending', 'submitted', 'graded', 'late');

-- ============================================
-- CORE TABLES (Your existing + enhancements)
-- ============================================

-- Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  hod TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users Table (Enhanced)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role app_role NOT NULL,
  clerk_id TEXT UNIQUE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  phone TEXT,
  address TEXT,
  -- Additional fields for LMS
  profile_picture TEXT,
  designation TEXT, -- e.g., "Professor", "Associate Professor"
  education TEXT, -- e.g., "PhD in Computer Science"
  office_location TEXT, -- e.g., "SST-804V"
  daily_time_start TIME, -- e.g., 08:00
  daily_time_end TIME, -- e.g., 17:00
  availability TEXT, -- e.g., "Monday - Friday"
  cgpa DECIMAL(3,2), -- For students
  gpa DECIMAL(3,2), -- For students (current semester)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disciplines Table
CREATE TABLE IF NOT EXISTS public.disciplines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courses Table (Enhanced)
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  discipline_id UUID REFERENCES public.disciplines(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  semester INTEGER NOT NULL,
  section TEXT, -- e.g., "A", "B", "C"
  credit_hours INTEGER DEFAULT 3,
  room TEXT, -- e.g., "Room 301"
  time_start TIME, -- Class start time
  time_end TIME, -- Class end time
  active_days TEXT, -- e.g., "Mon-Wed-Fri" or "Mon,Wed,Fri"
  syllabus_path TEXT, -- Path to syllabus file in storage
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enrollments Table
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL,
  section TEXT,
  status TEXT CHECK (status IN ('enrolled', 'dropped', 'completed')) DEFAULT 'enrolled',
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, course_id, semester, section)
);

-- ============================================
-- LECTURES & ATTENDANCE
-- ============================================

-- Lectures Table
CREATE TABLE public.lectures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  room TEXT,
  semester INTEGER NOT NULL,
  section TEXT,
  status lecture_status DEFAULT 'scheduled',
  cancelled_reason TEXT,
  rescheduled_from UUID REFERENCES public.lectures(id) ON DELETE SET NULL,
  rescheduled_to_date DATE,
  rescheduled_to_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lecture Attendance Table
CREATE TABLE public.lecture_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecture_id UUID REFERENCES public.lectures(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'absent',
  marked_by UUID REFERENCES public.users(id),
  marked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lecture_id, student_id)
);

-- Faculty Attendance Table (Track instructor presence)
CREATE TABLE public.faculty_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  on_campus TIME,
  left_campus TIME,
  status TEXT CHECK (status IN ('present', 'absent', 'late', 'short_leave')) DEFAULT 'present',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(instructor_id, date)
);

-- ============================================
-- EXAMS & GRADING
-- ============================================

-- Exams Table
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  type exam_type NOT NULL,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  total_marks INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  section TEXT,
  discipline_id UUID REFERENCES public.disciplines(id),
  room TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exam Results Table (Attendance + Grades)
CREATE TABLE public.exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('present', 'absent')) DEFAULT 'absent',
  total_marks INTEGER,
  obtained_marks INTEGER,
  percentage DECIMAL(5,2),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

-- ============================================
-- LEAVES MANAGEMENT
-- ============================================

-- Leaves Table
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  user_type app_role NOT NULL,
  lecture_id UUID REFERENCES public.lectures(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time_start TIME,
  time_end TIME,
  reason TEXT NOT NULL,
  status leave_status DEFAULT 'pending',
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  semester INTEGER,
  section TEXT,
  discipline_id UUID REFERENCES public.disciplines(id),
  course_id UUID REFERENCES public.courses(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ASSIGNMENTS & SUBMISSIONS
-- ============================================

-- Assignments Table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  total_marks INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  section TEXT,
  file_path TEXT, -- Assignment instructions file
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignment Submissions Table
CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  file_path TEXT,
  submission_text TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  obtained_marks INTEGER,
  feedback TEXT,
  graded_by UUID REFERENCES public.users(id),
  graded_at TIMESTAMP WITH TIME ZONE,
  status assignment_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- ============================================
-- COURSE MATERIALS & RESOURCES
-- ============================================

-- Course Materials Table (Separate from general resources)
CREATE TABLE public.course_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  category TEXT, -- e.g., "lecture_notes", "lab_manual", "slides"
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- General Resources Table (Your existing structure)
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ANNOUNCEMENTS & NOTIFICATIONS
-- ============================================

-- Announcements Table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('system', 'course', 'department')) DEFAULT 'system',
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  target_role app_role, -- null = all roles
  created_by UUID REFERENCES public.users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications Table (Your existing structure enhanced)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('system', 'academic', 'alert', 'leave', 'assignment', 'exam')) NOT NULL DEFAULT 'system',
  status TEXT CHECK (status IN ('unread', 'read')) NOT NULL DEFAULT 'unread',
  target_role app_role,
  target_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Specific user
  related_entity_type TEXT, -- e.g., "leave", "assignment", "exam"
  related_entity_id UUID, -- ID of the related entity
  link TEXT, -- Link to navigate to
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ATTENDANCE CORRECTIONS
-- ============================================

-- Attendance Correction Requests Table
CREATE TABLE public.attendance_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  lecture_id UUID REFERENCES public.lectures(id) ON DELETE CASCADE,
  current_status attendance_status NOT NULL,
  requested_status attendance_status NOT NULL,
  reason TEXT NOT NULL,
  status leave_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CALENDAR & SCHEDULING
-- ============================================

-- Holidays Table
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT CHECK (type IN ('public', 'academic', 'semester_break')) DEFAULT 'academic',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Office Hours Table
CREATE TABLE public.office_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments Table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SYSTEM TABLES
-- ============================================

-- System Settings Table (Your existing)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., "general", "attendance", "academic"
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs Table (Your existing enhanced)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details TEXT,
  ip_address TEXT,
  mac_address TEXT,
  device_info TEXT,
  type TEXT CHECK (type IN ('security', 'system', 'user', 'login', 'upload')) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Login Attempts Table (For security tracking)
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  ip_address TEXT,
  mac_address TEXT,
  device_info TEXT,
  success BOOLEAN DEFAULT false,
  attempt_count INTEGER DEFAULT 1,
  blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blocked Users Table
CREATE TABLE public.blocked_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  reason TEXT,
  blocked_by UUID REFERENCES public.users(id),
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unblocked_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- ============================================
-- STUDENT GRADES & GPA TRACKING
-- ============================================

-- Student Course Grades Table
CREATE TABLE public.student_course_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL,
  section TEXT,
  midterm_marks INTEGER,
  final_marks INTEGER,
  assignment_marks INTEGER,
  quiz_marks INTEGER,
  total_marks INTEGER,
  grade_letter TEXT, -- A+, A, B+, etc.
  grade_points DECIMAL(3,2), -- 4.0, 3.7, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, course_id, semester, section)
);

-- Semester GPA Table
CREATE TABLE public.semester_gpa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL,
  gpa DECIMAL(3,2) NOT NULL,
  cgpa DECIMAL(3,2),
  total_credit_hours INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, semester)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Lectures
CREATE INDEX idx_lectures_course ON public.lectures(course_id);
CREATE INDEX idx_lectures_instructor ON public.lectures(instructor_id);
CREATE INDEX idx_lectures_date ON public.lectures(date);
CREATE INDEX idx_lectures_status ON public.lectures(status);

-- Lecture Attendance
CREATE INDEX idx_lecture_attendance_lecture ON public.lecture_attendance(lecture_id);
CREATE INDEX idx_lecture_attendance_student ON public.lecture_attendance(student_id);

-- Exams
CREATE INDEX idx_exams_course ON public.exams(course_id);
CREATE INDEX idx_exams_type ON public.exams(type);
CREATE INDEX idx_exams_date ON public.exams(date);

-- Leaves
CREATE INDEX idx_leaves_user ON public.leaves(user_id);
CREATE INDEX idx_leaves_status ON public.leaves(status);
CREATE INDEX idx_leaves_date ON public.leaves(date);

-- Assignments
CREATE INDEX idx_assignments_course ON public.assignments(course_id);
CREATE INDEX idx_assignment_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX idx_assignment_submissions_student ON public.assignment_submissions(student_id);

-- Notifications
CREATE INDEX idx_notifications_target_user ON public.notifications(target_user_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_course_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_gpa ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SIMPLE POLICIES (For initial setup - Refine later based on auth)
-- ============================================

-- Allow all authenticated operations for now
-- TODO: Implement proper role-based policies

CREATE POLICY "Enable read for all" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.departments FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.users FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.users FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.disciplines FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.disciplines FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.courses FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.enrollments FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.enrollments FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.lectures FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.lectures FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.lecture_attendance FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.lecture_attendance FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.faculty_attendance FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.faculty_attendance FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.exams FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.exams FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.exam_results FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.exam_results FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.leaves FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.leaves FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.assignments FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.assignment_submissions FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.assignment_submissions FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.course_materials FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.course_materials FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.resources FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.resources FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.announcements FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.notifications FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.attendance_corrections FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.attendance_corrections FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.holidays FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.holidays FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.office_hours FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.office_hours FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.appointments FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.system_settings FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert for all" ON public.audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.student_course_grades FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.student_course_grades FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read for all" ON public.semester_gpa FOR SELECT USING (true);
CREATE POLICY "Enable write for all" ON public.semester_gpa FOR ALL WITH CHECK (true);





-- SEED


-- =========================
-- ADMIN USER (REQUIRED)
-- =========================
INSERT INTO public.users (email, full_name, role, status)
VALUES ('usingantigravity@gmail.com', 'System Admin', 'admin', 'active')
ON CONFLICT (email) DO NOTHING;


-- =========================
-- DEPARTMENTS
-- =========================
INSERT INTO public.departments (id, name, hod, description)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Computer Science Department', 'Dr. Alice Johnson', 'Department of Computer Science and IT'),
  ('22222222-2222-2222-2222-222222222222', 'Electrical Engineering Department', 'Dr. Bob Williams', 'Department of Electrical Engineering'),
  ('33333333-3333-3333-3333-333333333333', 'Business Administration Department', 'Dr. Catherine Davis', 'Department of Business Administration'),
  ('44444444-4444-4444-4444-444444444444', 'Mathematics Department', 'Dr. David Miller', 'Department of Mathematics')
ON CONFLICT (id) DO NOTHING;


-- =========================
-- DISCIPLINES
-- =========================
INSERT INTO public.disciplines (name, department_id)
VALUES
  ('BSCS', '11111111-1111-1111-1111-111111111111'),
  ('BSSE', '11111111-1111-1111-1111-111111111111'),
  ('BSEE', '22222222-2222-2222-2222-222222222222'),
  ('BBA',  '33333333-3333-3333-3333-333333333333'),
  ('BSMATH','44444444-4444-4444-4444-444444444444')
ON CONFLICT (name) DO NOTHING;


-- =========================
-- SYSTEM SETTINGS
-- =========================
INSERT INTO public.system_settings (key, value, description, category)
VALUES
  ('maintenance_mode','false','Maintenance Mode','general'),
  ('support_email','support@university.edu','Support Email','general'),
  ('current_semester','Fall 2024','Current Semester','academic'),
  ('academic_year','2024-2025','Academic Year','academic'),
  ('warning_threshold','75','Attendance Warning','attendance'),
  ('debarment_threshold','60','Attendance Debarment','attendance')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- =========================
-- INSTRUCTORS
-- =========================
INSERT INTO public.users
(email, full_name, role, department_id, status)
VALUES
('dr.smith@university.edu','Dr. Alice Smith','instructor','11111111-1111-1111-1111-111111111111','active'),
('prof.johnson@university.edu','Prof. Bob Johnson','instructor','11111111-1111-1111-1111-111111111111','active'),
('dr.williams@university.edu','Dr. Charlie Williams','instructor','22222222-2222-2222-2222-222222222222','active'),
('prof.davis@university.edu','Prof. Diana Davis','instructor','33333333-3333-3333-3333-333333333333','active')
ON CONFLICT (email) DO NOTHING;


-- =========================
-- STUDENTS
-- =========================
INSERT INTO public.users
(email, full_name, role, department_id, status, cgpa, gpa)
VALUES
('student1@university.edu','John Doe','student','11111111-1111-1111-1111-111111111111','active',3.75,3.80),
('student2@university.edu','Jane Smith','student','11111111-1111-1111-1111-111111111111','active',3.90,3.95),
('student3@university.edu','Michael Brown','student','22222222-2222-2222-2222-222222222222','active',3.20,3.10)
ON CONFLICT (email) DO NOTHING;


-- =========================
-- COURSES (FIXED)
-- =========================
INSERT INTO public.courses
(code, name, discipline_id, instructor_id, semester, section, credit_hours)
SELECT 'CS101','Intro to Computing',d.id,u.id,1,'A',3
FROM disciplines d, users u
WHERE d.name='BSCS' AND u.email='dr.smith@university.edu'
ON CONFLICT DO NOTHING;

INSERT INTO public.courses
(code, name, discipline_id, instructor_id, semester, section, credit_hours)
SELECT 'CS202','Data Structures',d.id,u.id,3,'A',4
FROM disciplines d, users u
WHERE d.name='BSCS' AND u.email='prof.johnson@university.edu'
ON CONFLICT DO NOTHING;

INSERT INTO public.courses
(code, name, discipline_id, semester, section, credit_hours)
SELECT 'MATH101','Calculus I',d.id,1,'A',3 FROM disciplines d WHERE d.name='BSMATH'
ON CONFLICT DO NOTHING;

INSERT INTO public.courses
(code, name, discipline_id, semester, section, credit_hours)
SELECT 'BBA101','Introduction to Business',d.id,1,'A',3 FROM disciplines d WHERE d.name='BBA'
ON CONFLICT DO NOTHING;

INSERT INTO public.courses
(code, name, discipline_id, semester, section, credit_hours)
SELECT 'EE201','Circuit Analysis',d.id,3,'A',4 FROM disciplines d WHERE d.name='BSEE'
ON CONFLICT DO NOTHING;


-- =========================
-- ENROLLMENTS (SAFE)
-- =========================
INSERT INTO public.enrollments (student_id, course_id, semester, section, status)
SELECT s.id, c.id, c.semester, c.section, 'enrolled'
FROM users s, courses c
WHERE s.email='student1@university.edu' AND c.code='CS101'
ON CONFLICT DO NOTHING;


-- =========================
-- HOLIDAYS
-- =========================
INSERT INTO public.holidays (name, date, type)
VALUES
('New Year','2025-01-01','public'),
('Independence Day','2025-08-14','public'),
('Eid ul-Fitr','2025-04-10','public')
ON CONFLICT DO NOTHING;


-- =========================
-- NOTIFICATIONS
-- =========================
INSERT INTO public.notifications
(title, message, type, created_by)
SELECT
'System Initialized',
'System seeded successfully',
'system',
u.id
FROM users u WHERE u.email='usingantigravity@gmail.com'
ON CONFLICT DO NOTHING;


-- =========================
-- AUDIT LOGS
-- =========================
INSERT INTO public.audit_logs
(user_id, user_email, action, entity_type, details, type)
SELECT
u.id, u.email,
'Initial Seed',
'system',
'Database seeded',
'system'
FROM users u WHERE u.email='usingantigravity@gmail.com'
ON CONFLICT DO NOTHING;







-- Droping everything




-- Drop everything in public schema
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Drop all custom ENUM / composite types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT typname
        FROM pg_type
        WHERE typnamespace = 'public'::regnamespace
          AND typtype IN ('e', 'c')
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END$$;






-- Untitled query



-- Run this in your Supabase SQL Editor to fix permission denied errors
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Ensure RLS allows access (these are already in your schema, but let's be sure)
-- If you want to allow everyone to read for now during development:
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY;';
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;




-- Untitled query


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





-- LMS Core Schema and Access Controls


-- ============================================
-- AMS + LMS Database Add-on Script
-- Compatible with your existing schema
-- Run this AFTER your main schema
-- ============================================
-- This script only adds missing elements to your existing schema
-- All your existing tables and data will remain intact
-- ============================================
-- 1. ADD MISSING COLUMNS (if not exists)
-- ============================================
-- Ensure courses table has all needed fields
DO $$ 
BEGIN
  -- Add status column to courses if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN status TEXT CHECK (status IN ('active', 'archived')) DEFAULT 'active';
  END IF;
END $$;
-- ============================================
-- 2. VERIFY SYSTEM SETTINGS
-- ============================================
-- Add any missing system settings
INSERT INTO public.system_settings (key, value, description, category)
VALUES
  ('min_student_courses', '8', 'Minimum courses required for student enrollment', 'academic'),
  ('attendance_threshold_student', '75', 'Minimum attendance percentage for students', 'attendance'),
  ('attendance_threshold_faculty', '85', 'Minimum attendance percentage for faculty', 'attendance'),
  ('max_login_attempts', '3', 'Maximum failed login attempts before blocking', 'security'),
  ('upload_max_size', '10485760', 'Maximum file upload size in bytes (10MB)', 'system'),
  ('notification_retention_days', '90', 'Days to retain read notifications', 'system')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category;
-- ============================================
-- 3. ADD USEFUL INDEXES (if not exists)
-- ============================================
-- Enrollments indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);
-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at);
-- Exams indexes
CREATE INDEX IF NOT EXISTS idx_exams_course ON public.exams(course_id);
CREATE INDEX IF NOT EXISTS idx_exams_type ON public.exams(type);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON public.exam_results(student_id);
-- Leaves indexes
CREATE INDEX IF NOT EXISTS idx_leaves_user ON public.leaves(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON public.leaves(status);
-- Assignments indexes
CREATE INDEX IF NOT EXISTS idx_assignments_course ON public.assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.assignment_submissions(student_id);
-- Materials indexes
CREATE INDEX IF NOT EXISTS idx_materials_course ON public.course_materials(course_id);
-- Announcements indexes
CREATE INDEX IF NOT EXISTS idx_announcements_course ON public.announcements(course_id);
CREATE INDEX IF NOT EXISTS idx_announcements_department ON public.announcements(department_id);
-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON public.audit_logs(type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);
-- Login attempts indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_blocked ON public.login_attempts(blocked);
-- ============================================
-- 4. CREATE HELPER VIEWS FOR COMMON QUERIES
-- ============================================
-- View for student course enrollments with course details
CREATE OR REPLACE VIEW student_courses_view AS
SELECT 
  e.id as enrollment_id,
  e.student_id,
  u.full_name as student_name,
  u.email as student_email,
  c.id as course_id,
  c.code as course_code,
  c.name as course_name,
  c.semester,
  c.section,
  c.credit_hours,
  d.name as discipline_name,
  i.full_name as instructor_name,
  e.status as enrollment_status,
  e.enrolled_at
FROM enrollments e
JOIN users u ON e.student_id = u.id
JOIN courses c ON e.course_id = c.id
LEFT JOIN disciplines d ON c.discipline_id = d.id
LEFT JOIN users i ON c.instructor_id = i.id
WHERE u.role = 'student';
-- View for instructor courses
CREATE OR REPLACE VIEW instructor_courses_view AS
SELECT 
  c.id as course_id,
  c.code,
  c.name as course_name,
  c.semester,
  c.section,
  c.credit_hours,
  c.instructor_id,
  u.full_name as instructor_name,
  u.email as instructor_email,
  d.name as discipline_name,
  dept.name as department_name,
  COUNT(DISTINCT e.student_id) as enrolled_students
FROM courses c
JOIN users u ON c.instructor_id = u.id
LEFT JOIN disciplines d ON c.discipline_id = d.id
LEFT JOIN departments dept ON u.department_id = dept.id
LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'enrolled'
WHERE u.role = 'instructor'
GROUP BY c.id, c.code, c.name, c.semester, c.section, c.credit_hours, 
         c.instructor_id, u.full_name, u.email, d.name, dept.name;
-- ============================================
-- 5. CREATE FUNCTIONS FOR COMMON OPERATIONS
-- ============================================
-- Function to calculate student attendance percentage for a course
CREATE OR REPLACE FUNCTION calculate_student_attendance(
  p_student_id UUID,
  p_course_id UUID
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_lectures INTEGER;
  attended_lectures INTEGER;
  attendance_percentage DECIMAL(5,2);
BEGIN
  -- Get total lectures for the course
  SELECT COUNT(DISTINCT l.id) INTO total_lectures
  FROM lectures l
  WHERE l.course_id = p_course_id 
    AND l.status = 'completed';
  
  -- If no lectures, return 100%
  IF total_lectures = 0 THEN
    RETURN 100.00;
  END IF;
  
  -- Get attended lectures (present or late)
  SELECT COUNT(*) INTO attended_lectures
  FROM lecture_attendance la
  JOIN lectures l ON la.lecture_id = l.id
  WHERE la.student_id = p_student_id 
    AND l.course_id = p_course_id
    AND la.status IN ('present', 'late', 'excused');
  
  -- Calculate percentage
  attendance_percentage := (attended_lectures::DECIMAL / total_lectures::DECIMAL) * 100;
  
  RETURN ROUND(attendance_percentage, 2);
END;
$$ LANGUAGE plpgsql;
-- Function to get student's enrolled course count
CREATE OR REPLACE FUNCTION get_student_course_count(p_student_id UUID) 
RETURNS INTEGER AS $$
DECLARE
  course_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO course_count
  FROM enrollments
  WHERE student_id = p_student_id 
    AND status = 'enrolled';
  
  RETURN course_count;
END;
$$ LANGUAGE plpgsql;
-- Function to check if student meets minimum course requirement
CREATE OR REPLACE FUNCTION validate_minimum_courses(p_student_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
  course_count INTEGER;
  min_required INTEGER;
BEGIN
  -- Get minimum required from settings
  SELECT value::INTEGER INTO min_required
  FROM system_settings
  WHERE key = 'min_student_courses';
  
  IF min_required IS NULL THEN
    min_required := 8; -- Default
  END IF;
  
  -- Get student's course count
  course_count := get_student_course_count(p_student_id);
  
  RETURN course_count >= min_required;
END;
$$ LANGUAGE plpgsql;
-- Function to calculate instructor attendance percentage
CREATE OR REPLACE FUNCTION calculate_instructor_attendance(
  p_instructor_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_days INTEGER;
  present_days INTEGER;
  attendance_percentage DECIMAL(5,2);
  start_d DATE;
  end_d DATE;
BEGIN
  -- Default to current month if dates not provided
  start_d := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  end_d := COALESCE(p_end_date, CURRENT_DATE);
  
  -- Get total working days (excluding weekends)
  SELECT COUNT(*) INTO total_days
  FROM generate_series(start_d, end_d, '1 day'::interval) d
  WHERE EXTRACT(DOW FROM d) NOT IN (0, 6); -- Exclude Sunday and Saturday
  
  IF total_days = 0 THEN
    RETURN 100.00;
  END IF;
  
  -- Get present days
  SELECT COUNT(*) INTO present_days
  FROM faculty_attendance
  WHERE instructor_id = p_instructor_id
    AND date BETWEEN start_d AND end_d
    AND status IN ('present', 'late');
  
  attendance_percentage := (present_days::DECIMAL / total_days::DECIMAL) * 100;
  
  RETURN ROUND(attendance_percentage, 2);
END;
$$ LANGUAGE plpgsql;
-- ============================================
-- 6. CREATE TRIGGERS
-- ============================================
-- Trigger to update updated_at on users
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON public.users;
CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();
-- Trigger to update updated_at on courses
DROP TRIGGER IF EXISTS trigger_update_courses_updated_at ON public.courses;
CREATE TRIGGER trigger_update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();
-- ============================================
-- 7. VERIFICATION QUERIES
-- ============================================
-- Run these to verify everything is set up correctly:
/*
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
-- Check system settings
SELECT * FROM system_settings ORDER BY category, key;
-- Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
-- Check views
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;
-- Test attendance calculation (replace UUIDs with actual IDs)
-- SELECT calculate_student_attendance('student-uuid', 'course-uuid');
-- SELECT calculate_instructor_attendance('instructor-uuid');
-- SELECT get_student_course_count('student-uuid');
-- SELECT validate_minimum_courses('student-uuid');
*/
-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database add-on script completed successfully!';
  RAISE NOTICE '✅ System settings verified';
  RAISE NOTICE '✅ Indexes created';
  RAISE NOTICE '✅ Helper views created';
  RAISE NOTICE '✅ Utility functions created';
  RAISE NOTICE '✅ Triggers set up';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Your database is ready for the AMS + LMS application!';
END $$;






-- Add discipline_id to users

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS discipline_id UUID REFERENCES disciplines(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_discipline ON users(discipline_id);
-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'discipline_id';



-- AMS + LMS Schema Enhancements

-- ============================================
-- AMS + LMS Database Add-on Script
-- Compatible with your existing schema
-- Run this AFTER your main schema
-- ============================================
-- This script only adds missing elements to your existing schema
-- All your existing tables and data will remain intact
-- ============================================
-- 1. ADD MISSING COLUMNS (if not exists)
-- ============================================
-- Ensure courses table has all needed fields
DO $$ 
BEGIN
  -- Add status column to courses if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN status TEXT CHECK (status IN ('active', 'archived')) DEFAULT 'active';
  END IF;
END $$;
-- ============================================
-- 2. VERIFY SYSTEM SETTINGS
-- ============================================
-- Add any missing system settings
INSERT INTO public.system_settings (key, value, description, category)
VALUES
  ('min_student_courses', '8', 'Minimum courses required for student enrollment', 'academic'),
  ('attendance_threshold_student', '75', 'Minimum attendance percentage for students', 'attendance'),
  ('attendance_threshold_faculty', '85', 'Minimum attendance percentage for faculty', 'attendance'),
  ('max_login_attempts', '3', 'Maximum failed login attempts before blocking', 'security'),
  ('upload_max_size', '10485760', 'Maximum file upload size in bytes (10MB)', 'system'),
  ('notification_retention_days', '90', 'Days to retain read notifications', 'system')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category;
-- ============================================
-- 3. ADD USEFUL INDEXES (if not exists)
-- ============================================
-- Enrollments indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);
-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at);
-- Exams indexes
CREATE INDEX IF NOT EXISTS idx_exams_course ON public.exams(course_id);
CREATE INDEX IF NOT EXISTS idx_exams_type ON public.exams(type);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON public.exam_results(student_id);
-- Leaves indexes
CREATE INDEX IF NOT EXISTS idx_leaves_user ON public.leaves(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON public.leaves(status);
-- Assignments indexes
CREATE INDEX IF NOT EXISTS idx_assignments_course ON public.assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.assignment_submissions(student_id);
-- Materials indexes
CREATE INDEX IF NOT EXISTS idx_materials_course ON public.course_materials(course_id);
-- Announcements indexes
CREATE INDEX IF NOT EXISTS idx_announcements_course ON public.announcements(course_id);
CREATE INDEX IF NOT EXISTS idx_announcements_department ON public.announcements(department_id);
-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON public.audit_logs(type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);
-- Login attempts indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_blocked ON public.login_attempts(blocked);
-- ============================================
-- 4. CREATE HELPER VIEWS FOR COMMON QUERIES
-- ============================================
-- View for student course enrollments with course details
CREATE OR REPLACE VIEW student_courses_view AS
SELECT 
  e.id as enrollment_id,
  e.student_id,
  u.full_name as student_name,
  u.email as student_email,
  c.id as course_id,
  c.code as course_code,
  c.name as course_name,
  c.semester,
  c.section,
  c.credit_hours,
  d.name as discipline_name,
  i.full_name as instructor_name,
  e.status as enrollment_status,
  e.enrolled_at
FROM enrollments e
JOIN users u ON e.student_id = u.id
JOIN courses c ON e.course_id = c.id
LEFT JOIN disciplines d ON c.discipline_id = d.id
LEFT JOIN users i ON c.instructor_id = i.id
WHERE u.role = 'student';
-- View for instructor courses
CREATE OR REPLACE VIEW instructor_courses_view AS
SELECT 
  c.id as course_id,
  c.code,
  c.name as course_name,
  c.semester,
  c.section,
  c.credit_hours,
  c.instructor_id,
  u.full_name as instructor_name,
  u.email as instructor_email,
  d.name as discipline_name,
  dept.name as department_name,
  COUNT(DISTINCT e.student_id) as enrolled_students
FROM courses c
JOIN users u ON c.instructor_id = u.id
LEFT JOIN disciplines d ON c.discipline_id = d.id
LEFT JOIN departments dept ON u.department_id = dept.id
LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'enrolled'
WHERE u.role = 'instructor'
GROUP BY c.id, c.code, c.name, c.semester, c.section, c.credit_hours, 
         c.instructor_id, u.full_name, u.email, d.name, dept.name;
-- ============================================
-- 5. CREATE FUNCTIONS FOR COMMON OPERATIONS
-- ============================================
-- Function to calculate student attendance percentage for a course
CREATE OR REPLACE FUNCTION calculate_student_attendance(
  p_student_id UUID,
  p_course_id UUID
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_lectures INTEGER;
  attended_lectures INTEGER;
  attendance_percentage DECIMAL(5,2);
BEGIN
  -- Get total lectures for the course
  SELECT COUNT(DISTINCT l.id) INTO total_lectures
  FROM lectures l
  WHERE l.course_id = p_course_id 
    AND l.status = 'completed';
  
  -- If no lectures, return 100%
  IF total_lectures = 0 THEN
    RETURN 100.00;
  END IF;
  
  -- Get attended lectures (present or late)
  SELECT COUNT(*) INTO attended_lectures
  FROM lecture_attendance la
  JOIN lectures l ON la.lecture_id = l.id
  WHERE la.student_id = p_student_id 
    AND l.course_id = p_course_id
    AND la.status IN ('present', 'late', 'excused');
  
  -- Calculate percentage
  attendance_percentage := (attended_lectures::DECIMAL / total_lectures::DECIMAL) * 100;
  
  RETURN ROUND(attendance_percentage, 2);
END;
$$ LANGUAGE plpgsql;
-- Function to get student's enrolled course count
CREATE OR REPLACE FUNCTION get_student_course_count(p_student_id UUID) 
RETURNS INTEGER AS $$
DECLARE
  course_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO course_count
  FROM enrollments
  WHERE student_id = p_student_id 
    AND status = 'enrolled';
  
  RETURN course_count;
END;
$$ LANGUAGE plpgsql;
-- Function to check if student meets minimum course requirement
CREATE OR REPLACE FUNCTION validate_minimum_courses(p_student_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
  course_count INTEGER;
  min_required INTEGER;
BEGIN
  -- Get minimum required from settings
  SELECT value::INTEGER INTO min_required
  FROM system_settings
  WHERE key = 'min_student_courses';
  
  IF min_required IS NULL THEN
    min_required := 8; -- Default
  END IF;
  
  -- Get student's course count
  course_count := get_student_course_count(p_student_id);
  
  RETURN course_count >= min_required;
END;
$$ LANGUAGE plpgsql;
-- Function to calculate instructor attendance percentage
CREATE OR REPLACE FUNCTION calculate_instructor_attendance(
  p_instructor_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_days INTEGER;
  present_days INTEGER;
  attendance_percentage DECIMAL(5,2);
  start_d DATE;
  end_d DATE;
BEGIN
  -- Default to current month if dates not provided
  start_d := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  end_d := COALESCE(p_end_date, CURRENT_DATE);
  
  -- Get total working days (excluding weekends)
  SELECT COUNT(*) INTO total_days
  FROM generate_series(start_d, end_d, '1 day'::interval) d
  WHERE EXTRACT(DOW FROM d) NOT IN (0, 6); -- Exclude Sunday and Saturday
  
  IF total_days = 0 THEN
    RETURN 100.00;
  END IF;
  
  -- Get present days
  SELECT COUNT(*) INTO present_days
  FROM faculty_attendance
  WHERE instructor_id = p_instructor_id
    AND date BETWEEN start_d AND end_d
    AND status IN ('present', 'late');
  
  attendance_percentage := (present_days::DECIMAL / total_days::DECIMAL) * 100;
  
  RETURN ROUND(attendance_percentage, 2);
END;
$$ LANGUAGE plpgsql;
-- ============================================
-- 6. CREATE TRIGGERS
-- ============================================
-- Trigger to update updated_at on users
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON public.users;
CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();
-- Trigger to update updated_at on courses
DROP TRIGGER IF EXISTS trigger_update_courses_updated_at ON public.courses;
CREATE TRIGGER trigger_update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();
-- ============================================
-- 7. VERIFICATION QUERIES
-- ============================================
-- Run these to verify everything is set up correctly:
/*
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
-- Check system settings
SELECT * FROM system_settings ORDER BY category, key;
-- Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
-- Check views
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;
-- Test attendance calculation (replace UUIDs with actual IDs)
-- SELECT calculate_student_attendance('student-uuid', 'course-uuid');
-- SELECT calculate_instructor_attendance('instructor-uuid');
-- SELECT get_student_course_count('student-uuid');
-- SELECT validate_minimum_courses('student-uuid');
*/
-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database add-on script completed successfully!';
  RAISE NOTICE '✅ System settings verified';
  RAISE NOTICE '✅ Indexes created';
  RAISE NOTICE '✅ Helper views created';
  RAISE NOTICE '✅ Utility functions created';
  RAISE NOTICE '✅ Triggers set up';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Your database is ready for the AMS + LMS application!';
END $$;






-- Real-time Dashboard & RLS Enhancements

-- ========================================================
-- REMEDY OVERHAUL SQL (REVISED)
-- This script adds missing views and helper functions to 
-- support the real-time dashboards and remove all mocks.
-- ========================================================

-- 1. DISCIPLINE ATTENDANCE STATS VIEW
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






-- Upsert Admin User

-- ============================================================
-- RLS FIX FOR REDIRECTION
-- Root Cause: App uses Clerk auth + Supabase data WITHOUT 
-- Supabase JWT integration. auth.uid() is always NULL, so ALL 
-- RLS policies block every query from the app.
--
-- Solution: SECURITY DEFINER functions bypass RLS completely.
-- They run as the database superuser regardless of who calls them.
-- ============================================================

-- Step 1: Ensure clerk_id column exists (Safe/Idempotent)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='clerk_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN clerk_id TEXT UNIQUE;
    END IF;
END $$;

-- Step 2: Function to look up a user's role by email (BYPASSES RLS)
-- Called from page.tsx server-side during sign-in redirection
CREATE OR REPLACE FUNCTION public.get_user_by_email(p_email TEXT)
RETURNS TABLE(id UUID, role TEXT, clerk_id TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.role::TEXT, u.clerk_id
    FROM public.users u
    WHERE u.email = p_email
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_by_email(TEXT) TO anon, authenticated;

-- Step 3: Function to sync Clerk ID to an existing user (BYPASSES RLS)
CREATE OR REPLACE FUNCTION public.sync_clerk_id(p_email TEXT, p_clerk_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users 
    SET clerk_id = p_clerk_id,
        status = 'active'
    WHERE email = p_email AND (clerk_id IS NULL OR clerk_id = '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.sync_clerk_id(TEXT, TEXT) TO anon, authenticated;

-- Step 4: Helper for get_auth_role used by other RLS policies
-- Looks up role by clerk_id for Supabase-native JWT users
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
    SELECT role::TEXT FROM public.users WHERE clerk_id = auth.uid()::TEXT LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;








-- Revert RLS to Permissive Mode

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







-- Fix View and Table Permissions


-- ============================================
-- FIX VIEW & TABLE PERMISSIONS
-- Run this in your Supabase SQL Editor
-- ============================================

-- Grant SELECT on the discipline_attendance_stats view
GRANT SELECT ON discipline_attendance_stats TO anon, authenticated;

-- Ensure all tables have proper permissions for authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- Grant read access to anon for public views
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- If there are any other views, grant them too
DO $$
DECLARE
    v RECORD;
BEGIN
    FOR v IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'GRANT SELECT ON public.' || quote_ident(v.viewname) || ' TO anon, authenticated;';
    END LOOP;
END $$;




-- Database Upgrades SQL 


-- =========================================================================
-- ADVANCED DATABASE UPGRADE SCRIPT FOR LMS + AMS
-- Compatible with current schema. Designed to run SAFELY over existing data.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Phase 1: Native Clerk Authentication Integration for RLS
-- -------------------------------------------------------------------------
-- Problem: Clerk JWT doesn't populate Supabase auth.uid() natively.
-- Solution: Define a function to read the custom header passed by Supabase client.

CREATE OR REPLACE FUNCTION public.clerk_user_id() RETURNS text AS $$
  -- Reads a custom setting "request.jwt.claim.sub" that your Next.js app 
  -- must set when creating the Supabase client.
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_role_secure() RETURNS text AS $$
    -- Reliably gets the role from users table based on the Clerk ID
    SELECT role::text FROM public.users WHERE clerk_id = public.clerk_user_id() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- -------------------------------------------------------------------------
-- Phase 2: Database-Level Conflict Prevention (Lectures)
-- -------------------------------------------------------------------------
-- Problem: Scheduling conflicts are checked via JS (Race Condition risk)
-- Solution: Postgres BEFORE INSERT trigger rejects overlapping times

CREATE OR REPLACE FUNCTION public.check_lecture_conflict()
RETURNS trigger AS $$
DECLARE
    conflict_found boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.lectures
        WHERE date = NEW.date
        AND status != 'cancelled'
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND (
            -- Check if same room is occupied
            (NEW.room IS NOT NULL AND room = NEW.room)
            OR 
            -- Check if same instructor is busy
            (NEW.instructor_id IS NOT NULL AND instructor_id = NEW.instructor_id)
        )
        -- Time overlap logic
        AND (NEW.time_start < time_end AND NEW.time_end > time_start)
    ) INTO conflict_found;

    IF conflict_found THEN
        RAISE EXCEPTION 'Scheduling Conflict: The selected room or instructor is already booked for this time period.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_lecture_conflict ON public.lectures;
CREATE TRIGGER trigger_prevent_lecture_conflict
BEFORE INSERT OR UPDATE ON public.lectures
FOR EACH ROW EXECUTE FUNCTION public.check_lecture_conflict();


-- -------------------------------------------------------------------------
-- Phase 3: Automated Audit Logging
-- -------------------------------------------------------------------------
-- Problem: Manual audit logs miss unexpected database edits.
-- Solution: Auto-trigger logs for sensitive tables like Grades and Corrections.

CREATE OR REPLACE FUNCTION public.log_sensitive_changes()
RETURNS trigger AS $$
DECLARE
    user_id_val uuid;
    user_email_val text;
BEGIN
    -- Attempt to identify who made the change based on Clerk ID
    SELECT id, email INTO user_id_val, user_email_val 
    FROM public.users WHERE clerk_id = public.clerk_user_id() LIMIT 1;

    INSERT INTO public.audit_logs (
        user_id, user_email, action, entity_type, entity_id, details, type
    ) VALUES (
        user_id_val,
        COALESCE(user_email_val, 'SYSTEM'),
        TG_OP, -- 'INSERT', 'UPDATE', or 'DELETE'
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        'Automated DB Trigger Log',
        'system'
    );
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to sensitive tables
DROP TRIGGER IF EXISTS trigger_audit_grades ON public.student_course_grades;
CREATE TRIGGER trigger_audit_grades
AFTER INSERT OR UPDATE OR DELETE ON public.student_course_grades
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_changes();

DROP TRIGGER IF EXISTS trigger_audit_corrections ON public.attendance_corrections;
CREATE TRIGGER trigger_audit_corrections
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_corrections
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_changes();


-- -------------------------------------------------------------------------
-- Phase 4: Soft Deletes implementation (Opt-in)
-- -------------------------------------------------------------------------
-- Problem: ON DELETE CASCADE wipes massive historical data if a course is deleted.
-- Solution: Add is_deleted flag for archival.

-- 1. Add columns (Safe execution)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='is_deleted') THEN
        ALTER TABLE public.courses ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_deleted') THEN
        ALTER TABLE public.users ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Create Active-Only Views for Frontend
CREATE OR REPLACE VIEW public.active_courses AS
    SELECT * FROM public.courses WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.active_users AS
    SELECT * FROM public.users WHERE is_deleted = false;


-- -------------------------------------------------------------------------
-- Final Cleanup & Verification Check
-- -------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✅ Clerk Auth Integration Functions Created';
  RAISE NOTICE '✅ Lecture Conflict Preventer Trigger Created';
  RAISE NOTICE '✅ Auto-Audit Logging Created';
  RAISE NOTICE '✅ Soft Delete Columns Added to Courses and Users';
END $$;



-- Lectures and Notifications and disciplines fixes


-- Drop the bad triggers on tables that don't have updated_at
DROP TRIGGER IF EXISTS trigger_update_notifications_updated_at ON public.notifications;
DROP TRIGGER IF EXISTS trigger_update_disciplines_updated_at ON public.disciplines;
DROP TRIGGER IF EXISTS trigger_update_holidays_updated_at ON public.holidays;
DROP TRIGGER IF EXISTS trigger_update_login_attempts_updated_at ON public.login_attempts;
DROP TRIGGER IF EXISTS trigger_update_blocked_users_updated_at ON public.blocked_users;
DROP TRIGGER IF EXISTS trigger_update_audit_logs_updated_at ON public.audit_logs;
DROP TRIGGER IF EXISTS trigger_update_lecture_attendance_updated_at ON public.lecture_attendance;
DROP TRIGGER IF EXISTS trigger_update_faculty_attendance_updated_at ON public.faculty_attendance;
DROP TRIGGER IF EXISTS trigger_update_semester_gpa_updated_at ON public.semester_gpa;
DROP TRIGGER IF EXISTS trigger_update_enrollments_updated_at ON public.enrollments;






-- User Table Enhancement

-- =========================================================================
-- USER TABLE SCHEMA ENHANCEMENT
-- Adds missing columns for Discipline and Current Semester tracking
-- =========================================================================

DO $$ 
BEGIN
    -- Add discipline_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='discipline_id') THEN
        ALTER TABLE public.users ADD COLUMN discipline_id UUID REFERENCES public.disciplines(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added discipline_id column to users table';
    END IF;

    -- Add current_semester if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='current_semester') THEN
        ALTER TABLE public.users ADD COLUMN current_semester INTEGER DEFAULT 1;
        RAISE NOTICE '✅ Added current_semester column to users table';
    END IF;
END $$;
