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
