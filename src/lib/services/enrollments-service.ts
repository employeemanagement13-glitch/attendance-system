import { supabase } from '../supabase';
import { toast } from 'sonner';

export type Enrollment = {
    id: string;
    student_id: string;
    course_id: string;
    semester: number;
    section: string | null;
    status: 'enrolled' | 'dropped' | 'completed';
    enrolled_at: string;
};

export type EnrollmentWithDetails = Enrollment & {
    student?: { id: string; full_name: string; email: string };
    course?: { id: string; code: string; name: string; credit_hours: number; section: string | null; active_days?: string[] | string | null };
};

export type CreateEnrollmentInput = {
    student_id: string;
    course_id: string;
    semester: number;
    section?: string;
};

export type UpdateEnrollmentInput = Partial<Omit<CreateEnrollmentInput, 'student_id' | 'course_id'>> & {
    status?: 'enrolled' | 'dropped' | 'completed';
};

// Get all enrollments with optional filters
export async function getEnrollments(filters?: {
    student_id?: string;
    course_id?: string;
    semester?: number;
    status?: string;
}): Promise<EnrollmentWithDetails[]> {
    let query = supabase
        .from('enrollments')
        .select(`
      *,
      student:users!student_id(id, full_name, email),
      course:courses!course_id(id, code, name, credit_hours, section, active_days)
    `)
        .order('enrolled_at', { ascending: false });

    if (filters?.student_id) {
        query = query.eq('student_id', filters.student_id);
    }
    if (filters?.course_id) {
        query = query.eq('course_id', filters.course_id);
    }
    if (filters?.semester) {
        query = query.eq('semester', filters.semester);
    }
    if (filters?.status) {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching enrollments:', error);
        toast.error('Failed to load enrollments');
        return [];
    }

    return data || [];
}

// Get enrollments by student
export async function getEnrollmentsByStudent(studentId: string): Promise<EnrollmentWithDetails[]> {
    return getEnrollments({ student_id: studentId, status: 'enrolled' });
}

// Get enrollments by course
export async function getEnrollmentsByCourse(courseId: string): Promise<EnrollmentWithDetails[]> {
    return getEnrollments({ course_id: courseId, status: 'enrolled' });
}

// Create new enrollment
export async function createEnrollment(input: CreateEnrollmentInput): Promise<Enrollment | null> {
    // First check if student already enrolled in this course
    const existing = await getEnrollments({
        student_id: input.student_id,
        course_id: input.course_id
    });

    if (existing.length > 0 && existing[0].status === 'enrolled') {
        toast.error('Student already enrolled in this course');
        return null;
    }

    // Check minimum course requirement (students need at least 8 courses)
    // const studentCourseCount = await getStudentCourseCount(input.student_id);

    // Check MAX enrollment (500 limit)
    const { count: currentEnrollmentCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', input.course_id)
        .eq('status', 'enrolled');

    if ((currentEnrollmentCount || 0) >= 500) {
        toast.error('Course is full (Max 500 students)');
        return null;
    }

    const { data, error } = await supabase
        .from('enrollments')
        .insert([{ ...input, status: 'enrolled' }])
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error creating enrollment:', error);
        toast.error('Failed to enroll student');
        return null;
    }

    toast.success('Student enrolled successfully');
    return data;
}

// Update enrollment
export async function updateEnrollment(id: string, input: UpdateEnrollmentInput): Promise<Enrollment | null> {
    const { data, error } = await supabase
        .from('enrollments')
        .update(input)
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error updating enrollment:', error);
        toast.error('Failed to update enrollment');
        return null;
    }

    toast.success('Enrollment updated successfully');
    return data;
}

// Delete enrollment (drop course)
export async function deleteEnrollment(id: string): Promise<boolean> {
    // Before deleting, check if student will still have minimum courses
    const enrollment = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('id', id)
        .single();

    if (enrollment.data) {
        const courseCount = await getStudentCourseCount(enrollment.data.student_id);
        if (courseCount <= 8) {
            toast.error('Cannot drop course: Student must be enrolled in at least 8 courses');
            return false;
        }

        // Check if the course is compulsory (same discipline as student)
        const { data: studentData, error: studentError } = await supabase
            .from('users')
            .select('discipline_id')
            .eq('id', enrollment.data.student_id)
            .single();

        const { data: courseData, error: courseError } = await supabase
            .from('enrollments')
            .select('course:courses(discipline_id)')
            .eq('id', id)
            .single();

        if (studentData && courseData && courseData.course) {
            // @ts-ignore
            if (studentData.discipline_id === courseData.course.discipline_id) {
                toast.error('Cannot drop compulsory course');
                return false;
            }
        }
    }

    const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting enrollment:', error);
        toast.error('Failed to drop course');
        return false;
    }

    toast.success('Course dropped successfully');
    return true;
}

// Get student's enrolled course count
export async function getStudentCourseCount(studentId: string): Promise<number> {
    const { count, error } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('status', 'enrolled');

    if (error) {
        console.error('Error getting course count:', error);
        return 0;
    }

    return count || 0;
}

// Validate if student meets minimum course requirement
export async function validateMinimumCourses(studentId: string): Promise<boolean> {
    const courseCount = await getStudentCourseCount(studentId);
    const MIN_COURSES = 8;

    return courseCount >= MIN_COURSES;
}

// Enforce minimum course enrollment
export async function enforceMinimumCourses(studentId: string): Promise<{ valid: boolean; message: string }> {
    const courseCount = await getStudentCourseCount(studentId);
    const MIN_COURSES = 8;

    if (courseCount < MIN_COURSES) {
        return {
            valid: false,
            message: `Student must be enrolled in at least ${MIN_COURSES} courses. Currently enrolled in ${courseCount}.`
        };
    }

    return {
        valid: true,
        message: `Student is enrolled in ${courseCount} courses.`
    };
}

// Get students enrolled in a course
export async function getCourseStudents(courseId: string): Promise<any[]> {
    const enrollments = await getEnrollmentsByCourse(courseId);
    return enrollments.map(e => e.student).filter(Boolean);
}

// Compute section letter based on student's enrollment position in a course
// 1-100 students = A, 101-200 = B, 201-300 = C, etc.
export async function getStudentSectionForCourse(courseId: string, studentId: string, courseCode: string): Promise<string> {
    const { data, error } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', courseId)
        .eq('status', 'enrolled')
        .order('enrolled_at', { ascending: true });

    if (error || !data) {
        return courseCode + 'A'; // Default to A if error
    }

    const studentIndex = data.findIndex(e => e.student_id === studentId);
    if (studentIndex === -1) {
        return courseCode + 'A'; // Default to A if student not found
    }

    // 0-99 = A, 100-199 = B, 200-299 = C, etc.
    const sectionLetter = String.fromCharCode(65 + Math.floor(studentIndex / 100));
    return courseCode + sectionLetter;
}

// Compute sections for all enrollments of a student (batch)
export async function getEnrollmentsWithComputedSections(studentId: string): Promise<(EnrollmentWithDetails & { computed_section: string })[]> {
    const enrollments = await getEnrollmentsByStudent(studentId);

    // For each enrollment, compute the section
    const enriched = await Promise.all(
        enrollments.map(async (enrollment) => {
            const courseCode = enrollment.course?.code || '';
            const courseId = enrollment.course_id;

            const computed_section = await getStudentSectionForCourse(courseId, studentId, courseCode);

            return {
                ...enrollment,
                computed_section
            };
        })
    );

    return enriched;
}
