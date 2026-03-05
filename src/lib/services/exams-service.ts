import { supabase } from '../supabase';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

export type ExamType = 'mids' | 'finals' | 'quiz';

export type Exam = {
    id: string;
    name: string;
    course_id: string;
    type: ExamType;
    date: string;
    time_start: string;
    time_end: string;
    total_marks: number;
    semester: number;
    section: string | null;
    discipline_id: string | null;
    room: string | null;
    created_by: string | null;
    created_at: string;
};

export type ExamWithDetails = Exam & {
    course?: { code: string; name: string };
    discipline?: { name: string };
    students_count?: number;
    present_count?: number;
    average_percentage?: number;
};

export type ExamResult = {
    id: string;
    exam_id: string;
    student_id: string;
    status: 'present' | 'absent';
    total_marks: number;
    obtained_marks: number | null;
    percentage: number | null;
    remarks: string | null;
};

export type CreateExamInput = {
    name: string;
    course_id: string;
    type: ExamType;
    date: string;
    time_start: string;
    time_end: string;
    total_marks: number;
    semester: number;
    section?: string;
    discipline_id?: string;
    room?: string;
};

// ============================================
// EXAM OPERATIONS
// ============================================

export async function getExams(filters?: {
    type?: ExamType;
    semester?: number;
    discipline_id?: string;
    course_id?: string;
}): Promise<ExamWithDetails[]> {
    let query = supabase
        .from('exams')
        .select(`
            *,
            course:courses(code, name),
            discipline:disciplines(name)
        `)
        .order('date', { ascending: false });

    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.semester) query = query.eq('semester', filters.semester);
    if (filters?.discipline_id) query = query.eq('discipline_id', filters.discipline_id);
    if (filters?.course_id) query = query.eq('course_id', filters.course_id);

    const { data: exams, error } = await query;

    if (error) {
        console.error('Error fetching exams:', error);
        toast.error('Failed to load exams');
        return [];
    }

    // Calculate stats for each exam
    // Note: This could be optimized with a database function/view
    const examsWithStats = await Promise.all(exams.map(async (exam) => {
        const { data: results } = await supabase
            .from('exam_results')
            .select('*')
            .eq('exam_id', exam.id);

        const totalStudents = results?.length || 0;
        const presentStudents = results?.filter(r => r.status === 'present').length || 0;

        // Calculate average percentage
        const percentages = results?.map(r => r.percentage || 0) || [];
        const avgPercentage = percentages.length > 0
            ? percentages.reduce((a, b) => a + b, 0) / percentages.length
            : 0;

        return {
            ...exam,
            students_count: totalStudents,
            present_count: presentStudents,
            average_percentage: parseFloat(avgPercentage.toFixed(2))
        };
    }));

    return examsWithStats;
}

export async function getExamdById(id: string): Promise<ExamWithDetails | null> {
    const { data, error } = await supabase
        .from('exams')
        .select(`
            *,
            course:courses(code, name),
            discipline:disciplines(name)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching exam:', error);
        return null;
    }

    return data;
}

export async function createExam(input: CreateExamInput): Promise<Exam | null> {
    const { data, error } = await supabase
        .from('exams')
        .insert([input])
        .select()
        .single();

    if (error) {
        console.error('Error creating exam:', error);
        toast.error('Failed to create exam');
        return null;
    }

    // Auto-create exam_results for all enrolled students
    // 1. Get enrolled students
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', input.course_id)
        .eq('semester', input.semester)
        .eq('section', input.section || ''); // Handle section filtering carefully if null

    if (enrollments && enrollments.length > 0) {
        const resultsToCreate = enrollments.map(e => ({
            exam_id: data.id,
            student_id: e.student_id,
            status: 'absent', // Default
            total_marks: input.total_marks
        }));

        await supabase.from('exam_results').insert(resultsToCreate);
    }

    toast.success('Exam created successfully');
    return data;
}

export async function updateExam(id: string, input: Partial<CreateExamInput>): Promise<boolean> {
    const { error } = await supabase
        .from('exams')
        .update(input)
        .eq('id', id);

    if (error) {
        console.error('Error updating exam:', error);
        toast.error('Failed to update exam');
        return false;
    }

    toast.success('Exam updated successfully');
    return true;
}

export async function deleteExam(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting exam:', error);
        toast.error('Failed to delete exam');
        return false;
    }

    toast.success('Exam deleted successfully');
    return true;
}

export async function updateExamResults(examId: string, results: { student_id: string; obtained_marks: number; status: 'present' | 'absent' }[]) {
    const exam = await getExamdById(examId);
    if (!exam) return;

    for (const result of results) {
        const percentage = result.obtained_marks
            ? (result.obtained_marks / exam.total_marks) * 100
            : 0;

        // Use upsert so we can create records for students who don't have one yet
        await supabase
            .from('exam_results')
            .upsert({
                exam_id: examId,
                student_id: result.student_id,
                obtained_marks: result.obtained_marks,
                status: result.status,
                total_marks: exam.total_marks,
                percentage: parseFloat(percentage.toFixed(2))
            }, { onConflict: 'exam_id, student_id' });
    }

    toast.success('Exam results updated');
}

export async function getExamResults(examId: string) {
    const { data, error } = await supabase
        .from('exam_results')
        .select(`
            *,
            student:users(id, full_name, email)
        `)
        .eq('exam_id', examId);

    if (error) {
        console.error("Error fetching results", error);
        return [];
    }
    return data;
}

/**
 * Get all enrolled students for the exam's course, merged with any existing results.
 * Students without an exam_result row are shown as absent with null marks.
 */
export async function getExamResultsWithAllStudents(examId: string) {
    // 1. Get exam details to know the course
    const exam = await getExamdById(examId);
    if (!exam) return [];

    // 2. Get existing results
    const existingResults = await getExamResults(examId);

    // 3. Get all enrolled students for this course
    const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
            student_id,
            student:users(id, full_name, email)
        `)
        .eq('course_id', exam.course_id)
        .eq('status', 'enrolled');

    if (enrollError) {
        console.error('Error fetching enrolled students:', enrollError);
        return existingResults;
    }

    // 4. Merge: for each enrolled student, use existing result or create a placeholder
    const resultMap = new Map(existingResults.map((r: any) => [r.student_id, r]));

    const merged = (enrollments || []).map((enrollment: any) => {
        const existing = resultMap.get(enrollment.student_id);
        if (existing) return existing;

        // Placeholder for student with no result row
        return {
            id: `placeholder-${enrollment.student_id}`,
            exam_id: examId,
            student_id: enrollment.student_id,
            status: 'absent' as const,
            total_marks: exam.total_marks,
            obtained_marks: null,
            percentage: null,
            remarks: null,
            student: enrollment.student,
            _isPlaceholder: true
        };
    });

    return merged;
}

/**
 * Get lecture attendance for the exam date to sync status
 */
export async function getExamDayLectureAttendance(courseId: string, examDate: string) {
    // Find lectures for this course on the exam date
    const { data: lectures } = await supabase
        .from('lectures')
        .select('id')
        .eq('course_id', courseId)
        .eq('date', examDate);

    if (!lectures || lectures.length === 0) return new Map();

    // Get attendance for those lectures
    const lectureIds = lectures.map(l => l.id);
    const { data: attendance } = await supabase
        .from('lecture_attendance')
        .select('student_id, status')
        .in('lecture_id', lectureIds);

    // Return a map of student_id -> attendance status
    const attendanceMap = new Map<string, string>();
    (attendance || []).forEach((a: any) => {
        attendanceMap.set(a.student_id, a.status);
    });

    return attendanceMap;
}

/**
 * Get all exams for a specific course
 */
export async function getExamsByCourse(courseId: string): Promise<Exam[]> {
    const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('course_id', courseId)
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching exams by course:', error);
        return [];
    }

    return data || [];
}

export type StudentExamWithResult = Exam & {
    result?: ExamResult;
};

/**
 * Get all exams for a course with student specific results
 */
export async function getStudentCourseExams(courseId: string, studentId: string): Promise<StudentExamWithResult[]> {
    // 1. Get exams for the course
    const { data: exams, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .eq('course_id', courseId)
        .order('date', { ascending: false });

    if (examsError) {
        console.error('Error fetching course exams:', examsError);
        return [];
    }

    if (!exams || exams.length === 0) return [];

    // 2. Get results for these exams for the student
    const examIds = exams.map(e => e.id);
    const { data: results, error: resultsError } = await supabase
        .from('exam_results')
        .select('*')
        .in('exam_id', examIds)
        .eq('student_id', studentId);

    if (resultsError) {
        console.error('Error fetching student exam results:', resultsError);
        // Return exams without results (unmarked yet)
        return exams;
    }

    // 3. Merge data
    return exams.map(exam => ({
        ...exam,
        result: results?.find(r => r.exam_id === exam.id)
    }));
}
