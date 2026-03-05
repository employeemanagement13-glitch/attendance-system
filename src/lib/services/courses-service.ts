import { supabase } from '../supabase';
import { toast } from 'sonner';
import { logAction } from './audit-service';

// Compute section letter(s) from student count
// 1-100 → A, 101-200 → A,B, etc.
export function computeSectionLabel(courseCode: string, studentCount: number): string {
    if (!studentCount || studentCount <= 0) return courseCode + 'A';
    const sectionCount = Math.ceil(studentCount / 100);
    const letters = [];
    for (let i = 0; i < sectionCount; i++) {
        letters.push(String.fromCharCode(65 + i));
    }
    return courseCode + letters.join(', ' + courseCode);
}

// Simple section: just the letter(s) based on count
export function computeSectionLetters(studentCount: number): string {
    if (!studentCount || studentCount <= 0) return 'A';
    const sectionCount = Math.ceil(studentCount / 100);
    const letters = [];
    for (let i = 0; i < sectionCount; i++) {
        letters.push(String.fromCharCode(65 + i));
    }
    return letters.join(', ');
}

export type Course = {
    id: string;
    code: string;
    name: string;
    discipline_id: string;
    instructor_id: string | null;
    semester: number;
    credit_hours: number;
    section: string | null;
    room: string | null;
    time_start: string | null;
    time_end: string | null;
    active_days: string[] | null;
    syllabus_path: string | null;
    created_at: string;
    status?: 'active' | 'archived';
};

export type CourseWithDetails = Course & {
    discipline?: { id: string; name: string; department: string };
    instructor?: { id: string; full_name: string; email: string };
    students_count?: number;
};

export type CreateCourseInput = {
    code: string;
    name: string;
    discipline_id: string;
    instructor_id?: string;
    semester: number;
    credit_hours: number;
    section?: string;
    room?: string;
    time_start?: string;
    time_end?: string;
    active_days?: string[];
    syllabus_path?: string;
};

export type UpdateCourseInput = Partial<CreateCourseInput>;

// Get all courses with related data
export async function getCourses(): Promise<CourseWithDetails[]> {
    const { data, error } = await supabase
        .from('courses')
        .select(`
      *,
      discipline:disciplines(id, name, department:departments(name)),
      instructor:users!instructor_id(id, full_name, email, department_id)
    `)
        .order('code');

    if (error) {
        console.error('Error fetching courses:', error);
        toast.error('Failed to load courses');
        return [];
    }

    // Get student counts for each course
    const coursesWithCounts = await Promise.all(
        (data || []).map(async (course) => {
            const { count } = await supabase
                .from('enrollments')
                .select('*', { count: 'exact', head: true })
                .eq('course_id', course.id);

            return {
                ...course,
                students_count: count || 0,
                status: 'active' as const,
                active_days: typeof course.active_days === 'string'
                    ? (course.active_days ? course.active_days.split(',').map((d: string) => d.trim()) : [])
                    : (course.active_days || [])
            };
        })
    );

    return coursesWithCounts;
}

// Get single course
export async function getCourse(id: string): Promise<CourseWithDetails | null> {
    const { data, error } = await supabase
        .from('courses')
        .select(`
      *,
      discipline:disciplines(id, name, department:departments(name)),
      instructor:users!instructor_id(id, full_name, email)
    `)
        .eq('id', id)
        .single();

    if (data) {
        return {
            ...data,
            active_days: typeof data.active_days === 'string'
                ? (data.active_days ? data.active_days.split(',').map((d: string) => d.trim()) : [])
                : (data.active_days || [])
        };
    }

    return null;
}

// Create course
export async function createCourse(input: CreateCourseInput): Promise<Course | null> {
    // Clean up input - convert empty string instructor_id to null
    const cleanedInput = {
        ...input,
        instructor_id: input.instructor_id && input.instructor_id.trim() !== "" ? input.instructor_id : null,
        discipline_id: input.discipline_id && input.discipline_id.trim() !== "" ? input.discipline_id : null,
        active_days: Array.isArray(input.active_days) ? input.active_days.join(',') : input.active_days
    };

    const { data, error } = await supabase
        .from('courses')
        .insert([cleanedInput])
        .select()
        .maybeSingle();

    // Log the creation
    if (data) {
        await logAction('create', 'course', data.id, undefined, undefined, `Created course ${data.code}`);
    }

    toast.success('Course created successfully');
    return data;
}

// Update course
export async function updateCourse(id: string, input: UpdateCourseInput): Promise<Course | null> {
    const cleanedInput = {
        ...input,
        instructor_id: input.instructor_id && input.instructor_id.trim() !== "" ? input.instructor_id : (input.instructor_id === "" ? null : input.instructor_id),
        discipline_id: input.discipline_id && input.discipline_id.trim() !== "" ? input.discipline_id : (input.discipline_id === "" ? null : input.discipline_id),
        active_days: Array.isArray(input.active_days) ? input.active_days.join(',') : input.active_days
    };

    const { data, error } = await supabase
        .from('courses')
        .update(cleanedInput)
        .eq('id', id)
        .select()
        .maybeSingle();

    // Log the update
    if (data) {
        await logAction('update', 'course', id, undefined, undefined, `Updated course ${data.code}`);
    }

    toast.success('Course updated successfully');
    return data;
}

// Delete course
export async function deleteCourse(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id);

    // Log the deletion
    await logAction('delete', 'course', id, undefined, undefined, 'Course deleted');

    toast.success('Course deleted successfully');
    return true;
}

// Get course count
export async function getCoursesCount(): Promise<number> {
    const { count, error } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error fetching courses count:', error);
        return 0;
    }

    return count || 0;
}

// Get active days for course (dummy calculation - you may want to enhance this)
export async function getCourseActiveDays(courseId: string): Promise<number> {
    const { data, error } = await supabase
        .from('attendance')
        .select('date')
        .eq('course_id', courseId);

    if (error) {
        console.error('Error fetching course active days:', error);
        return 0;
    }

    // Count unique dates
    const uniqueDates = new Set((data || []).map(a => a.date));
    return uniqueDates.size;
}

// Get courses by instructor
export async function getCoursesByInstructor(instructorId: string): Promise<CourseWithDetails[]> {
    const { data, error } = await supabase
        .from('courses')
        .select(`
            *,
            discipline:disciplines(id, name, department:departments(name))
        `)
        .eq('instructor_id', instructorId)
        .order('code');

    if (error) {
        console.error('Error fetching instructor courses:', error);
        return [];
    }

    // Get student counts
    const coursesWithCounts = await Promise.all(
        (data || []).map(async (course) => {
            const { count } = await supabase
                .from('enrollments')
                .select('*', { count: 'exact', head: true })
                .eq('course_id', course.id);

            return {
                ...course,
                students_count: count || 0,
                status: 'active' as const,
                active_days: typeof course.active_days === 'string'
                    ? (course.active_days ? course.active_days.split(',').map((d: string) => d.trim()) : [])
                    : (course.active_days || [])
            };
        })
    );

    return coursesWithCounts;
}
