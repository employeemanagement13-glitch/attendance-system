import { supabase } from '../supabase';
import { toast } from 'sonner';

export type LeaveStatus = 'pending' | 'approved' | 'reject';
export type UserRole = 'student' | 'instructor';

export type LeaveRequest = {
    id: string;
    user_id: string;
    user_type: UserRole;
    date: string;
    time_start?: string | null;
    time_end?: string | null;
    lecture_id?: string | null;
    reason: string;
    status: LeaveStatus;
    created_at: string;
    reviewed_at?: string;
    review_comments?: string;
    student?: { full_name: string; email: string };
    course_id?: string | null;
    discipline_id?: string | null;
    semester?: number | null;
    section?: string | null;
};

export async function createLeaveRequest(input: Partial<LeaveRequest>) {
    // Only include fields that exist in the table
    const dbInput = {
        user_id: input.user_id,
        user_type: input.user_type,
        date: input.date,
        reason: input.reason,
        status: input.status || 'pending',
        // Context fields for routing
        course_id: input.course_id,
        discipline_id: input.discipline_id,
        semester: input.semester,
        section: input.section,
        // Optional
        lecture_id: input.lecture_id,
        time_start: input.time_start,
        time_end: input.time_end
    };

    const { data, error } = await supabase
        .from('leaves')
        .insert([dbInput])
        .select()
        .single();

    if (error) {
        console.error('Error creating leave request (Detailed):', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        toast.error(`Failed to submit: ${error.message}`);
        return null;
    }

    toast.success('Leave request submitted');
    return data;
}

export async function getLeaveRequests(filters?: {
    userId?: string;
    status?: LeaveStatus;
    userType?: UserRole;
    disciplineId?: string;
    semester?: number;
    courseId?: string;
    date?: string;
}) {
    let query = supabase
        .from('leaves')
        .select(`
            *,
            student:users!user_id(id, full_name, email)
        `)
        .order('date', { ascending: false });

    if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
    }
    if (filters?.userType) {
        query = query.eq('user_type', filters.userType);
    }
    if (filters?.status) {
        query = query.eq('status', filters.status);
    }
    if (filters?.disciplineId) {
        query = query.eq('discipline_id', filters.disciplineId);
    }
    if (filters?.semester) {
        query = query.eq('semester', filters.semester);
    }
    if (filters?.courseId) {
        query = query.eq('course_id', filters.courseId);
    }
    if (filters?.date) {
        query = query.eq('date', filters.date);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching leaves (Full):', JSON.stringify(error, null, 2));
        // Return empty array but log explicitly
        return [];
    }

    return data || [];
}

export async function updateLeaveStatus(id: string, status: LeaveStatus, reviewedBy: string, comments?: string) {
    const { error } = await supabase
        .from('leaves')
        .update({
            status,
            approved_by: reviewedBy,
            approved_at: new Date().toISOString(),
            review_comments: comments
        })
        .eq('id', id);

    if (error) {
        console.error('Error updating leave:', JSON.stringify(error, null, 2));
        toast.error('Failed to update status');
        return false;
    }

    toast.success(`Leave request ${status}`);
    return true;
}
