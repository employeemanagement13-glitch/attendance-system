import { supabase } from '../supabase';
import { toast } from 'sonner';
import { LectureStatus } from './lectures-service';
import { logAction } from './audit-service';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'leave';

export type StudentAttendanceRecord = {
    id: string;
    lecture_id: string;
    student_id: string;
    status: AttendanceStatus;
    student?: {
        full_name: string;
        email: string;
        id: string;
    };
};

// Get attendance for a specific lecture
export async function getLectureAttendance(lectureId: string): Promise<StudentAttendanceRecord[]> {
    const { data, error } = await supabase
        .from('lecture_attendance')
        .select(`
            *,
            student:users!lecture_attendance_student_id_fkey(id, full_name, email)
        `)
        .eq('lecture_id', lectureId);

    if (error) {
        console.error('Error fetching attendance:', JSON.stringify(error, null, 2));
        toast.error('Failed to load attendance');
        return [];
    }

    return data;
}

// Mark attendance for a single student
export async function markStudentAttendance(
    lectureId: string,
    studentId: string,
    status: AttendanceStatus
) {
    const { error } = await supabase
        .from('lecture_attendance')
        .upsert({
            lecture_id: lectureId,
            student_id: studentId,
            status,
            marked_at: new Date().toISOString()
        }, { onConflict: 'lecture_id, student_id' });

    if (error) {
        console.error('Error marking attendance:', error);
        toast.error('Failed to mark attendance');
        return false;
    }

    return true;
}

// Bulk mark attendance
export async function bulkMarkAttendance(
    lectureId: string,
    records: { student_id: string; status: AttendanceStatus }[]
) {
    const { error } = await supabase
        .from('lecture_attendance')
        .upsert(
            records.map(r => ({
                lecture_id: lectureId,
                student_id: r.student_id,
                status: r.status,
                marked_at: new Date().toISOString()
            })),
            { onConflict: 'lecture_id, student_id' }
        );

    // Log the action
    await logAction('bulk_mark_attendance', 'lecture', lectureId, undefined, undefined, `Marked attendance for ${records.length} students`);

    toast.success('Attendance saved successfully');
    return true;
}

// Initialize attendance for a lecture (populate with absent/default)
export async function initializeLectureAttendance(lectureId: string, courseId: string, semester: number, section?: string) {
    // 1. Get all enrolled students
    // 1. Get all enrolled students
    // Note: enrollments table relies on course_id to define the section/semester context
    let query = supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', courseId)
        .eq('status', 'enrolled'); // Ensure active enrollment

    const { data: enrollments } = await query;

    if (!enrollments || enrollments.length === 0) return;

    // 2. Upsert initial 'absent' records if they don't exist
    const records = enrollments.map(e => ({
        lecture_id: lectureId,
        student_id: e.student_id,
        status: 'absent' as AttendanceStatus // Default to absent
    }));

    const { error } = await supabase
        .from('lecture_attendance')
        .upsert(records, { onConflict: 'lecture_id, student_id', ignoreDuplicates: true });

    if (error) {
        console.error('Error initializing attendance:', error);
    }
}

export type StudentAttendanceHistory = StudentAttendanceRecord & {
    lecture?: {
        id: string;
        date: string;
        time_start: string;
        time_end: string;
        status: string;
        course?: { name: string; code: string; active_days: string[] };
    };
};

/**
 * Get attendance history for a specific student
 */
export async function getStudentAttendance(studentId: string): Promise<StudentAttendanceHistory[]> {
    const { data, error } = await supabase
        .from('lecture_attendance')
        .select(`
            *,
            lecture:lectures(
                id, date, time_start, time_end, status,
                course:courses(name, code, active_days)
            )
        `)
        .eq('student_id', studentId)
        .order('lecture(date)', { ascending: false });

    if (error) {
        console.error('Error fetching student attendance:', error);
        return [];
    }

    return data || [];
}
