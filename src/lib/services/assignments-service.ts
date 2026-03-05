import { supabase } from '../supabase';
import { toast } from 'sonner';

export type Assignment = {
    id: string;
    course_id: string;
    title: string;
    description: string | null;
    due_date: string;
    total_marks: number;
    semester: number;
    section: string | null;
    file_path: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
};

export type AssignmentWithDetails = Assignment & {
    course?: { id: string; code: string; name: string };
    creator?: { id: string; full_name: string };
    submissions_count?: number;
};

export type CreateAssignmentInput = {
    course_id: string;
    title: string;
    description?: string;
    due_date: string;
    total_marks: number;
    semester: number;
    section?: string;
    file_path?: string;
    created_by?: string;
};

export type UpdateAssignmentInput = Partial<CreateAssignmentInput>;

// Get all assignments with filters
export async function getAssignments(filters?: {
    course_id?: string;
    semester?: number;
    section?: string;
    createdBy?: string;
}): Promise<AssignmentWithDetails[]> {
    let query = supabase
        .from('assignments')
        .select(`
      *,
      course:courses(id, code, name),
      creator:users!created_by(id, full_name)
    `)
        .order('due_date', { ascending: false });

    if (filters?.course_id) {
        query = query.eq('course_id', filters.course_id);
    }
    if (filters?.semester) {
        query = query.eq('semester', filters.semester);
    }
    if (filters?.section) {
        query = query.eq('section', filters.section);
    }
    if (filters?.createdBy) {
        query = query.eq('created_by', filters.createdBy);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching assignments:', error);
        toast.error('Failed to load assignments');
        return [];
    }

    // Get submission counts
    const assignmentsWithCounts = await Promise.all(
        (data || []).map(async (assignment) => {
            const { count } = await supabase
                .from('assignment_submissions')
                .select('*', { count: 'exact', head: true })
                .eq('assignment_id', assignment.id);

            return {
                ...assignment,
                submissions_count: count || 0
            };
        })
    );

    return assignmentsWithCounts;
}

// Get single assignment
export async function getAssignment(id: string): Promise<AssignmentWithDetails | null> {
    const { data, error } = await supabase
        .from('assignments')
        .select(`
      *,
      course:courses(id, code, name),
      creator:users!created_by(id, full_name)
    `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching assignment:', error);
        toast.error('Failed to load assignment');
        return null;
    }

    return data;
}

// Get assignments by course
export async function getAssignmentsByCourse(courseId: string): Promise<AssignmentWithDetails[]> {
    return getAssignments({ course_id: courseId });
}

// Create new assignment
export async function createAssignment(input: CreateAssignmentInput): Promise<Assignment | null> {
    const { data, error } = await supabase
        .from('assignments')
        .insert([input])
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error creating assignment:', error);
        toast.error('Failed to create assignment');
        return null;
    }

    toast.success('Assignment created successfully');
    return data;
}

// Update assignment
export async function updateAssignment(id: string, input: UpdateAssignmentInput): Promise<Assignment | null> {
    const { data, error } = await supabase
        .from('assignments')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error updating assignment:', error);
        toast.error('Failed to update assignment');
        return null;
    }

    toast.success('Assignment updated successfully');
    return data;
}

// Delete assignment
export async function deleteAssignment(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting assignment:', error);
        toast.error('Failed to delete assignment');
        return false;
    }

    toast.success('Assignment deleted successfully');
    return true;
}

// Assignment Submissions
export type AssignmentSubmission = {
    id: string;
    assignment_id: string;
    student_id: string;
    file_path: string | null;
    submission_text: string | null;
    submitted_at: string | null;
    obtained_marks: number | null;
    feedback: string | null;
    graded_by: string | null;
    graded_at: string | null;
    status: 'pending' | 'submitted' | 'graded' | 'late';
    created_at: string;
};

export type SubmissionWithDetails = AssignmentSubmission & {
    student?: { id: string; full_name: string; email: string };
    assignment?: { id: string; title: string; total_marks: number };
    grader?: { id: string; full_name: string };
};

export type CreateSubmissionInput = {
    assignment_id: string;
    student_id: string;
    file_path?: string;
    submission_text?: string;
};

export type GradeSubmissionInput = {
    obtained_marks: number;
    feedback?: string;
    graded_by: string;
};

// Get submissions for an assignment
export async function getSubmissions(assignmentId: string): Promise<SubmissionWithDetails[]> {
    const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
      *,
      student:users!student_id(id, full_name, email),
      assignment:assignments(id, title, total_marks),
      grader:users!graded_by(id, full_name)
    `)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

    if (error) {
        console.error('Error fetching submissions:', error);
        toast.error('Failed to load submissions');
        return [];
    }

    return data || [];
}

// Get student's submission for an assignment
export async function getStudentSubmission(
    assignmentId: string,
    studentId: string
): Promise<SubmissionWithDetails | null> {
    const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
      *,
      student:users!student_id(id, full_name, email),
      assignment:assignments(id, title, total_marks),
      grader:users!graded_by(id, full_name)
    `)
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching submission:', error);
        return null;
    }

    return data;
}

// Submit assignment
export async function createSubmission(input: CreateSubmissionInput): Promise<AssignmentSubmission | null> {
    // Check if already submitted
    const existing = await getStudentSubmission(input.assignment_id, input.student_id);
    if (existing) {
        toast.error('Assignment already submitted');
        return null;
    }

    // Check if past due date
    const assignment = await getAssignment(input.assignment_id);
    if (assignment) {
        const dueDate = new Date(assignment.due_date);
        const now = new Date();
        const status = now > dueDate ? 'late' : 'submitted';

        const { data, error } = await supabase
            .from('assignment_submissions')
            .insert([{
                ...input,
                status,
                submitted_at: new Date().toISOString()
            }])
            .select()
            .maybeSingle();

        if (error) {
            console.error('Error submitting assignment:', error);
            toast.error('Failed to submit assignment');
            return null;
        }

        toast.success(status === 'late' ? 'Assignment submitted (late)' : 'Assignment submitted successfully');
        return data;
    }

    return null;
}

// Grade submission
export async function gradeSubmission(
    submissionId: string,
    gradeInput: GradeSubmissionInput
): Promise<AssignmentSubmission | null> {
    const { data, error } = await supabase
        .from('assignment_submissions')
        .update({
            obtained_marks: gradeInput.obtained_marks,
            feedback: gradeInput.feedback,
            graded_by: gradeInput.graded_by,
            graded_at: new Date().toISOString(),
            status: 'graded'
        })
        .eq('id', submissionId)
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error grading submission:', error);
        toast.error('Failed to grade submission');
        return null;
    }

    toast.success('Submission graded successfully');
    return data;
}

// Get student's all submissions
export async function getStudentSubmissions(studentId: string): Promise<SubmissionWithDetails[]> {
    const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
      *,
      student:users!student_id(id, full_name, email),
      assignment:assignments(id, title, total_marks, course:courses(id, code, name)),
      grader:users!graded_by(id, full_name)
    `)
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });

    if (error) {
        console.error('Error fetching student submissions:', error);
        return [];
    }

    return data || [];
}

export type StudentAssignmentWithStatus = AssignmentWithDetails & {
    submission?: SubmissionWithDetails;
    status: 'pending' | 'submitted' | 'late' | 'graded' | 'missed';
};

/**
 * Get all assignments for a student (from enrolled courses) with status
 */
// ... (inside getStudentAssignments)
export async function getStudentAssignments(studentId: string): Promise<StudentAssignmentWithStatus[]> {
    // 1. Get enrolled courses
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id') // removed semester, section
        .eq('student_id', studentId)
        .eq('status', 'enrolled');

    if (!enrollments || enrollments.length === 0) return [];

    const courseIds = enrollments.map(e => e.course_id);

    // 2. Get assignments for these courses
    const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select(`
            *,
            course:courses(id, code, name),
            creator:users!created_by(id, full_name)
        `)
        .in('course_id', courseIds)
        .order('due_date', { ascending: true });

    if (assignmentsError) {
        console.error('Error fetching student assignments:', assignmentsError);
        return [];
    }

    // 3. Get student submissions
    const assignmentIds = assignments.map(a => a.id);
    const { data: submissions } = await supabase
        .from('assignment_submissions')
        .select('*')
        .in('assignment_id', assignmentIds)
        .eq('student_id', studentId);

    // 4. Merge and determine status
    const now = new Date();

    return assignments.map(assignment => {
        // Validation: Ensure course ID matches (already done by query but strictly mapping here)
        // Without checking enrollment semester/section since course_id is unique enough

        const submission = submissions?.find(s => s.assignment_id === assignment.id);
        let status: 'pending' | 'submitted' | 'late' | 'graded' | 'missed' = 'pending';

        if (submission) {
            status = submission.status as any; // 'submitted', 'graded', 'late'
        } else {
            const dueDate = new Date(assignment.due_date);
            if (now > dueDate) {
                status = 'missed';
            }
        }

        return {
            ...assignment,
            submission,
            status
        };
    }).filter(Boolean) as StudentAssignmentWithStatus[];
}
