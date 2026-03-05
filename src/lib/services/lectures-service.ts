import { supabase } from '../supabase';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

export type LectureStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';

export type Lecture = {
    id: string;
    course_id: string;
    instructor_id: string;
    topic: string | null;
    date: string;
    time_start: string;
    time_end: string;
    room: string | null;
    semester: number;
    section: string | null;
    status: LectureStatus;
    cancelled_reason: string | null;
    rescheduled_from: string | null;
    rescheduled_to_date: string | null;
    rescheduled_to_time: string | null;
    created_at: string;
    updated_at: string;
};

export type LectureWithDetails = Lecture & {
    course?: {
        id: string;
        code: string;
        name: string;
        discipline_id: string;
        active_days?: string[] | string | null;
    };
    instructor?: {
        id: string;
        full_name: string;
        email: string;
    };
    students_count?: number;
    present_count?: number;
    attendance_percentage?: number;
};

export type CreateLectureInput = {
    course_id: string;
    instructor_id: string;
    date: string;
    time_start: string;
    time_end: string;
    room?: string;
    semester: number;
    section?: string;
};

export type UpdateLectureInput = Partial<CreateLectureInput> & {
    status?: LectureStatus;
    cancelled_reason?: string;
};

export type RescheduleLectureInput = {
    rescheduled_to_date: string;
    rescheduled_to_time: string;
    room?: string;
};

// ============================================
// LECTURE CRUD OPERATIONS
// ============================================

/**
 * Get all lectures with related course and instructor details
 */
export async function getLectures(filters?: {
    courseId?: string;
    instructorId?: string;
    date?: string;
    status?: LectureStatus;
    semester?: number;
    section?: string;
}): Promise<LectureWithDetails[]> {
    let query = supabase
        .from('lectures')
        .select(`
            *,
            course:courses(id, code, name, discipline_id),
            instructor:users!instructor_id(id, full_name, email)
        `)
        .order('date', { ascending: false })
        .order('time_start', { ascending: true });

    // Apply filters
    if (filters?.courseId) query = query.eq('course_id', filters.courseId);
    if (filters?.instructorId) query = query.eq('instructor_id', filters.instructorId);
    if (filters?.date) query = query.eq('date', filters.date);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.semester) query = query.eq('semester', filters.semester);
    if (filters?.section) query = query.eq('section', filters.section);

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching lectures:', error);
        toast.error('Failed to load lectures');
        return [];
    }

    // Get attendance counts for each lecture
    const lecturesWithCounts = await Promise.all(
        (data || []).map(async (lecture) => {
            const [enrollmentCount, attendanceData] = await Promise.all([
                supabase
                    .from('enrollments')
                    .select('*', { count: 'exact', head: true })
                    .eq('course_id', lecture.course_id)
                    .eq('semester', lecture.semester)
                    .eq('section', lecture.section || ''),
                supabase
                    .from('lecture_attendance')
                    .select('status')
                    .eq('lecture_id', lecture.id)
            ]);

            const studentsCount = enrollmentCount.count || 0;
            const presentCount = attendanceData.data?.filter(a => a.status === 'present').length || 0;
            const attendancePercentage = studentsCount > 0 ? (presentCount / studentsCount) * 100 : 0;

            return {
                ...lecture,
                students_count: studentsCount,
                present_count: presentCount,
                attendance_percentage: Math.round(attendancePercentage * 100) / 100
            };
        })
    );

    return lecturesWithCounts;
}

/**
 * Get a single lecture by ID
 */
export async function getLecture(id: string): Promise<LectureWithDetails | null> {
    const { data, error } = await supabase
        .from('lectures')
        .select(`
            *,
            course:courses(id, code, name, discipline_id),
            instructor:users!instructor_id(id, full_name, email)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching lecture:', error);
        toast.error('Failed to load lecture');
        return null;
    }

    return data;
}

/**
 * Create a new lecture
 */
export async function createLecture(input: CreateLectureInput): Promise<Lecture | null> {
    const { data, error } = await supabase
        .from('lectures')
        .insert([{
            ...input,
            status: 'scheduled'
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating lecture:', error);
        toast.error(`Failed to create lecture: ${error.message}`);
        return null;
    }

    toast.success('Lecture created successfully');
    return data;
}

/**
 * Update a lecture
 */
export async function updateLecture(id: string, input: UpdateLectureInput): Promise<Lecture | null> {
    const { data, error } = await supabase
        .from('lectures')
        .update(input)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating lecture:', error);
        toast.error('Failed to update lecture');
        return null;
    }

    toast.success('Lecture updated successfully');
    return data;
}

/**
 * Delete a lecture
 */
export async function deleteLecture(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('lectures')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting lecture:', error);
        toast.error('Failed to delete lecture');
        return false;
    }

    toast.success('Lecture deleted successfully');
    return true;
}

/**
 * Cancel a lecture
 */
export async function cancelLecture(id: string, reason: string): Promise<boolean> {
    const { error } = await supabase
        .from('lectures')
        .update({
            status: 'cancelled',
            cancelled_reason: reason
        })
        .eq('id', id);

    if (error) {
        console.error('Error cancelling lecture:', error);
        toast.error('Failed to cancel lecture');
        return false;
    }

    toast.success('Lecture cancelled successfully');
    return true;
}

/**
 * Reschedule a cancelled lecture
 */
export async function rescheduleLecture(
    originalLectureId: string,
    rescheduleData: RescheduleLectureInput
): Promise<Lecture | null> {
    // Get original lecture details
    const original = await getLecture(originalLectureId);
    if (!original) return null;

    // Create new lecture with rescheduled data
    const { data: newLecture, error: createError } = await supabase
        .from('lectures')
        .insert([{
            course_id: original.course_id,
            instructor_id: original.instructor_id,
            date: rescheduleData.rescheduled_to_date,
            time_start: rescheduleData.rescheduled_to_time,
            time_end: original.time_end,
            room: rescheduleData.room || original.room,
            semester: original.semester,
            section: original.section,
            status: 'rescheduled',
            rescheduled_from: originalLectureId
        }])
        .select()
        .single();

    if (createError) {
        console.error('Error rescheduling lecture:', createError);
        toast.error('Failed to reschedule lecture');
        return null;
    }

    // Update original lecture to mark as rescheduled
    await supabase
        .from('lectures')
        .update({
            status: 'rescheduled',
            rescheduled_to_date: rescheduleData.rescheduled_to_date,
            rescheduled_to_time: rescheduleData.rescheduled_to_time
        })
        .eq('id', originalLectureId);

    toast.success('Lecture rescheduled successfully');
    return newLecture;
}

/**
 * Get lectures for today
 */
export async function getTodayLectures(instructorId?: string): Promise<LectureWithDetails[]> {
    const today = new Date().toISOString().split('T')[0];
    return getLectures({
        date: today,
        instructorId,
        status: 'scheduled'
    });
}

/**
 * Get cancelled lectures
 */
export async function getCancelledLectures(instructorId?: string): Promise<LectureWithDetails[]> {
    return getLectures({
        status: 'cancelled',
        instructorId
    });
}

/**
 * Get lectures by course
 */
export async function getLecturesByCourse(courseId: string): Promise<LectureWithDetails[]> {
    return getLectures({ courseId });
}

/**
 * Get lecture count
 */
export async function getLecturesCount(filters?: { instructor_id?: string; status?: LectureStatus }): Promise<number> {
    let query = supabase
        .from('lectures')
        .select('*', { count: 'exact', head: true });

    if (filters?.instructor_id) query = query.eq('instructor_id', filters.instructor_id);
    if (filters?.status) query = query.eq('status', filters.status);

    const { count, error } = await query;

    if (error) {
        console.error('Error fetching lectures count:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Get dynamic stats for instructor dashboard — computed directly, no view dependency
 */
export async function getInstructorDashboardStats(instructorId: string) {
    try {
        // Try fetching from the optimized view first
        const { data, error } = await supabase
            .from('instructor_dashboard_stats')
            .select('*')
            .eq('instructor_id', instructorId)
            .single();

        if (!error && data) {
            return {
                total_classes: data.total_classes || 0,
                active_days: data.active_days || 0,
                upcoming_exams: data.upcoming_exams || 0,
                persona_attendance_rate: data.persona_attendance_rate || 100
            };
        }

        if (error) {
            console.error('Error fetching instructor stats from view:', JSON.stringify(error, null, 2));
        }

        // Fallback to manual computation
        const today = new Date().toISOString().split('T')[0];

        const [lecturesRes, attendanceRes, examsRes] = await Promise.all([
            // Total completed classes
            supabase
                .from('lectures')
                .select('id', { count: 'exact', head: true })
                .eq('instructor_id', instructorId)
                .eq('status', 'completed'),
            // Unique active days (days faculty was present/late)
            supabase
                .from('faculty_attendance')
                .select('date')
                .eq('instructor_id', instructorId)
                .in('status', ['present', 'late']),
            // Upcoming exams
            supabase
                .from('exams')
                .select('id', { count: 'exact', head: true })
                .eq('created_by', instructorId)
                .gte('date', today),
        ]);

        const uniqueDates = new Set((attendanceRes.data || []).map((r: any) => r.date));

        return {
            total_classes: lecturesRes.count || 0,
            active_days: uniqueDates.size,
            upcoming_exams: examsRes.count || 0,
            persona_attendance_rate: 100
        };
    } catch (error) {
        console.error('Unexpected error in getInstructorDashboardStats:', JSON.stringify(error, null, 2));
        return { total_classes: 0, active_days: 0, upcoming_exams: 0, persona_attendance_rate: 100 };
    }
}

/**
 * Mark lecture as completed (after attendance is taken)
 */
export async function completeLecture(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('lectures')
        .update({ status: 'completed' })
        .eq('id', id);

    if (error) {
        console.error('Error completing lecture:', error);
        toast.error('Failed to mark lecture as completed');
        return false;
    }

    toast.success('Lecture marked as completed');
    return true;
}


/**
 * Get weekly schedule for an instructor
 */
export async function getWeeklySchedule(instructorId: string): Promise<any[]> {
    const { data: lectures, error } = await supabase
        .from('lectures')
        .select(`
            id,
            time_start,
            time_end,
            room,
            date,
            course:courses(id, code, name)
        `)
        .eq('instructor_id', instructorId)
        .gte('date', new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 1)).toISOString().split('T')[0]) // Start of week (Monday)
        .lte('date', new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 5)).toISOString().split('T')[0]) // End of week (Friday)
        .order('date', { ascending: true })
        .order('time_start', { ascending: true });

    if (error) {
        console.error('Error fetching schedule:', error);
        return [];
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const schedule = days.map(day => ({
        day,
        events: [] as any[]
    }));

    lectures?.forEach(lecture => {
        const date = new Date(lecture.date);
        const dayIndex = date.getDay() - 1; // 0 for Monday
        if (dayIndex >= 0 && dayIndex < 5) {
            schedule[dayIndex].events.push({
                id: lecture.id,
                title: `${(lecture.course as any)?.code} Lecture`,
                time: `${lecture.time_start} - ${lecture.time_end}`,
                type: 'class',
                room: lecture.room || 'N/A'
            });
        }
    });

    return schedule;
}
/**
 * Get aggregated attendance stats for an instructor's course
 */
export async function getInstructorCourseStats(courseId: string, instructorId: string): Promise<{
    presents: number;
    absents: number;
    percentage: number;
}> {
    // 1. Get all completed lectures for this course and instructor
    const { data: lectures, error: lecturesError } = await supabase
        .from('lectures')
        .select('id')
        .eq('course_id', courseId)
        .eq('instructor_id', instructorId)
        .eq('status', 'completed');

    if (lecturesError || !lectures || lectures.length === 0) {
        return { presents: 0, absents: 0, percentage: 0 };
    }

    const lectureIds = lectures.map(l => l.id);

    // 2. Get attendance records
    const { data: attendance, error: attError } = await supabase
        .from('lecture_attendance')
        .select('status')
        .in('lecture_id', lectureIds);

    if (attError || !attendance) {
        return { presents: 0, absents: 0, percentage: 0 };
    }

    const total = attendance.length;
    if (total === 0) return { presents: 0, absents: 0, percentage: 0 };

    const presents = attendance.filter(a =>
        a.status === 'present' || a.status === 'late' || a.status === 'excused'
    ).length;
    const absents = total - presents;
    const percentage = Math.round((presents / total) * 100);

    return { presents, absents, percentage };
}

/**
 * Get lectures for a student based on their enrolled courses
 * Optionally filter by date to get lectures for a specific day
 */
export async function getStudentLectures(
    studentId: string,
    filters?: { date?: string; status?: LectureStatus }
): Promise<LectureWithDetails[]> {
    // 1. Get the student's enrolled course IDs
    const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', studentId)
        .eq('status', 'enrolled');

    if (enrollError || !enrollments || enrollments.length === 0) {
        return [];
    }

    const courseIds = enrollments.map(e => e.course_id);

    // 2. Build query for lectures in those courses
    let query = supabase
        .from('lectures')
        .select(`
            *,
            course:courses(id, code, name, discipline_id, active_days),
            instructor:users!instructor_id(id, full_name, email)
        `)
        .in('course_id', courseIds)
        .order('time_start', { ascending: true });

    if (filters?.date) {
        query = query.eq('date', filters.date);
    }
    if (filters?.status) {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching student lectures:', error);
        return [];
    }

    // Normalize active_days from string to array
    return (data || []).map(lecture => ({
        ...lecture,
        course: lecture.course ? {
            ...lecture.course,
            active_days: typeof lecture.course.active_days === 'string'
                ? (lecture.course.active_days ? lecture.course.active_days.split(',').map((d: string) => d.trim()) : [])
                : (lecture.course.active_days || [])
        } : lecture.course
    }));
}
