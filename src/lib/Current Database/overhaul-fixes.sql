-- ========================================================
-- COMPREHENSIVE OVERHAUL FIX SCRIPT (REVISED)
-- This script fixes all database-level inconsistencies and
-- prepares the schema for dynamic dashboards.
-- ========================================================

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'instructor', 'student');
    END IF;
END $$;

-- 2. UNIFY USER TABLES (The "Source of Truth" fix)
-- Ensure 'users' table is fully defined and exists
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'student',
    clerk_id VARCHAR(255) UNIQUE,
    department_id UUID,
    discipline_id UUID,
    status VARCHAR(20) DEFAULT 'active',
    phone TEXT,
    address TEXT,
    profile_picture TEXT,
    designation TEXT,
    education TEXT,
    office_location TEXT,
    daily_time_start TIME,
    daily_time_end TIME,
    availability TEXT,
    cgpa DECIMAL(3,2),
    gpa DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MIGRATION: Move data from 'employees' to 'users' if 'employees' exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
        INSERT INTO users (id, email, full_name, clerk_id, role, created_at)
        SELECT id, email, full_name, clerk_user_id, 'instructor'::user_role, created_at
        FROM employees
        ON CONFLICT (email) DO UPDATE 
        SET clerk_id = EXCLUDED.clerk_id, 
            full_name = EXCLUDED.full_name;
            
        -- Note: We drop employees later or keep it as backup. 
        -- For safety, we keep it but the code should point to users now.
    END IF;
END $$;

-- 3. ATTENDANCE CORRECTIONS TABLE
CREATE TABLE IF NOT EXISTS attendance_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    current_status VARCHAR(20) NOT NULL,
    requested_status VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ALIGN FACULTY ATTENDANCE
-- Code expects 'on_campus' and 'left_campus'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faculty_attendance') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faculty_attendance' AND column_name = 'on_campus') THEN
            ALTER TABLE faculty_attendance ADD COLUMN on_campus TIME;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'faculty_attendance' AND column_name = 'left_campus') THEN
            ALTER TABLE faculty_attendance ADD COLUMN left_campus TIME;
        END IF;
    END IF;
END $$;

-- 5. NOTIFICATIONS ENHANCEMENTS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES users(id);
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_entity_type VARCHAR(50);
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_entity_id UUID;
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(255);
    END IF;
END $$;

-- 6. DASHBOARD VIEWS (Crucial for removing Mock Data)

-- View for Admin: Discipline Attendance Percentage
CREATE OR REPLACE VIEW discipline_attendance_stats AS
SELECT 
    d.id as discipline_id,
    d.name as discipline_name,
    COALESCE(
        ROUND(
            AVG(
                CASE 
                    WHEN la.status IN ('present', 'late', 'excused') THEN 100 
                    ELSE 0 
                END
            ), 2
        ), 0
    ) as attendance_percentage,
    COUNT(DISTINCT c.id) as courses_count,
    COUNT(DISTINCT e.student_id) as students_count
FROM disciplines d
LEFT JOIN courses c ON c.discipline_id = d.id
LEFT JOIN lectures l ON l.course_id = c.id
LEFT JOIN lecture_attendance la ON la.lecture_id = l.id
LEFT JOIN enrollments e ON e.course_id = c.id
GROUP BY d.id, d.name;

-- View for Instructor: Stats (Classes, Active Days, Exams)
CREATE OR REPLACE VIEW instructor_dashboard_stats AS
SELECT 
    u.id as instructor_id,
    COUNT(DISTINCT l.id) as total_classes,
    COUNT(DISTINCT l.date) FILTER (WHERE l.status = 'completed') as active_days,
    COUNT(DISTINCT ex.id) FILTER (WHERE ex.date >= CURRENT_DATE) as upcoming_exams,
    COALESCE(
        ROUND(
            AVG(
                CASE 
                    WHEN fa.status IN ('present', 'late') THEN 100 
                    ELSE 0 
                END
            ) FILTER (WHERE fa.date <= CURRENT_DATE), 2
        ), 100
    ) as persona_attendance_rate
FROM users u
LEFT JOIN lectures l ON l.instructor_id = u.id
LEFT JOIN faculty_attendance fa ON fa.instructor_id = u.id
LEFT JOIN exams ex ON ex.course_id IN (SELECT id FROM courses WHERE instructor_id = u.id)
WHERE u.role = 'instructor'
GROUP BY u.id;
