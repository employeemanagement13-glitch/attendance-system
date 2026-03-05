-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Roles Enum or Table
-- Using an ENUM is simpler for fixed roles, but a table allows dynamic roles. Steps requested fixed roles (Admin, Instructor, Student).
CREATE TYPE app_role AS ENUM ('admin', 'instructor', 'student');

-- 2. Create Users Table
-- This table matches the auth.users id but stores app-specific profile info.
-- We check 'email' from Clerk/Auth against this to allow access.
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role app_role NOT NULL,
  clerk_id TEXT UNIQUE, -- Optional: Link to Clerk ID if needed later
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Disciplines Table (e.g., BSCS, BBA)
CREATE TABLE public.disciplines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL, -- e.g., 'BSCS'
  department TEXT NOT NULL, -- e.g., 'Computer Science'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Courses Table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- e.g., 'CS101'
  name TEXT NOT NULL,
  discipline_id UUID REFERENCES public.disciplines(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Link to Instructor
  semester INTEGER NOT NULL,
  credit_hours INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enrollments Table (Students in Courses)
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- 6. Attendance Table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
  recorded_by UUID REFERENCES public.users(id), -- Instructor who marked it
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for Initial Setup)
-- In a real app, you'd check auth.uid() against users.clerk_id. 
-- For now, we will allow read/write for authenticated users to get started, 
-- or you can implement strict policies if we sync Clerk IDs to Supabase.

CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.users FOR INSERT WITH CHECK (true); -- Ideally restrict to Admins
CREATE POLICY "Enable update for users based on email" ON public.users FOR UPDATE USING (true); -- Placeholder

CREATE POLICY "Enable read access for all disciplines" ON public.disciplines FOR SELECT USING (true);
CREATE POLICY "Enable write access for admins" ON public.disciplines FOR INSERT WITH CHECK (true); -- Placeholder

-- 7. Departments Table (Organizational units - separate from disciplines)
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL, -- e.g., 'Computer Science Department'
  hod TEXT, -- Head of Department name
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. System Settings Table (Key-Value store for configuration)
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL, -- e.g., 'maintenance_mode', 'support_email'
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Notifications Table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('system', 'academic', 'alert')) NOT NULL DEFAULT 'system',
  status TEXT CHECK (status IN ('unread', 'read')) NOT NULL DEFAULT 'unread',
  target_role app_role, -- Optional: Target specific role (null = all roles)
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Audit Logs Table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT, -- Store email in case user is deleted
  action TEXT NOT NULL, -- e.g., 'Created', 'Updated', 'Deleted'
  entity_type TEXT NOT NULL, -- e.g., 'course', 'department', 'user'
  entity_id UUID, -- Reference to the affected entity
  details TEXT, -- JSON or descriptive text
  ip_address TEXT,
  type TEXT CHECK (type IN ('security', 'system', 'user')) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Resources Table (File metadata)
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path in Supabase Storage
  file_type TEXT, -- e.g., 'PDF', 'DOCX', 'MP4'
  file_size BIGINT, -- Size in bytes
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add department_id to users table
ALTER TABLE public.users ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN phone TEXT;
ALTER TABLE public.users ADD COLUMN address TEXT;

-- Enable Row Level Security for new tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Policies for new tables (Simplified for initial setup)
CREATE POLICY "Enable read access for all departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Enable write access for departments" ON public.departments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for departments" ON public.departments FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for departments" ON public.departments FOR DELETE USING (true);

CREATE POLICY "Enable read access for system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Enable write access for system settings" ON public.system_settings FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read access for notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Enable write access for notifications" ON public.notifications FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read access for audit logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for resources" ON public.resources FOR SELECT USING (true);
CREATE POLICY "Enable write access for resources" ON public.resources FOR ALL WITH CHECK (true);

-- Additional policies for courses and enrollments
CREATE POLICY "Enable read access for all courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Enable write access for courses" ON public.courses FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read access for all enrollments" ON public.enrollments FOR SELECT USING (true);
CREATE POLICY "Enable write access for enrollments" ON public.enrollments FOR ALL WITH CHECK (true);

CREATE POLICY "Enable read access for all attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Enable write access for attendance" ON public.attendance FOR ALL WITH CHECK (true);

-- SEED DATA script will be separate
