import { supabase } from '../supabase';
import { toast } from 'sonner';

export type AttendanceCorrection = {
    id: string;
    student_id: string;
    lecture_id: string;
    current_status: 'present' | 'absent' | 'late' | 'excused' | 'leave';
    requested_status: 'present' | 'absent' | 'late' | 'excused' | 'leave';
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_comments: string | null;
    created_at: string;
    updated_at: string;
};

export type CorrectionWithDetails = AttendanceCorrection & {
    student?: { id: string; full_name: string; email: string };
    lecture?: {
        id: string;
        date: string;
        time_start: string;
        course: { id: string; code: string; name: string };
    };
    reviewer?: { id: string; full_name: string };
};

export type CreateCorrectionInput = {
    student_id: string;
    lecture_id: string;
    current_status: 'present' | 'absent' | 'late' | 'excused' | 'leave';
    requested_status: 'present' | 'absent' | 'late' | 'excused' | 'leave';
    reason: string;
};

export type ReviewCorrectionInput = {
    reviewed_by: string;
    review_comments?: string;
};

// Get all correction requests with filters
export async function getCorrectionRequests(filters?: {
    student_id?: string;
    lecture_id?: string;
    status?: 'pending' | 'approved' | 'rejected';
}): Promise<CorrectionWithDetails[]> {
    let query = supabase
        .from('attendance_corrections')
        .select(`
      *,
      student:users!student_id(id, full_name, email),
      lecture:lectures!lecture_id(
        id,
        date,
        time_start,
        course:courses(id, code, name)
      ),
      reviewer:users!reviewed_by(id, full_name)
    `)
        .order('created_at', { ascending: false });

    if (filters?.student_id) {
        query = query.eq('student_id', filters.student_id);
    }
    if (filters?.lecture_id) {
        query = query.eq('lecture_id', filters.lecture_id);
    }
    if (filters?.status) {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching correction requests:', error);
        toast.error('Failed to load correction requests');
        return [];
    }

    return data || [];
}

// Get requests by student
export async function getStudentCorrectionRequests(studentId: string): Promise<CorrectionWithDetails[]> {
    return getCorrectionRequests({ student_id: studentId });
}

// Get pending requests (for instructors/admins)
export async function getPendingCorrectionRequests(): Promise<CorrectionWithDetails[]> {
    return getCorrectionRequests({ status: 'pending' });
}

// Create new correction request
export async function createCorrectionRequest(input: CreateCorrectionInput): Promise<AttendanceCorrection | null> {
    try {
        // Check if there's already a pending request for this lecture
        const existing = await getCorrectionRequests({
            student_id: input.student_id,
            lecture_id: input.lecture_id,
            status: 'pending'
        });

        if (existing.length > 0) {
            toast.error('You already have a pending correction request for this lecture');
            return null;
        }

        const { data, error } = await supabase
            .from('attendance_corrections')
            .insert([{
                ...input,
                status: 'pending'
            }])
            .select()
            .maybeSingle();

        if (error) throw error;

        // Create notification for instructor
        const lectureData = await supabase
            .from('lectures')
            .select('course_id, courses(instructor_id)')
            .eq('id', input.lecture_id)
            .single();

        // Check if course data exists and has instructor
        const course = lectureData.data?.courses as any;
        if (course && course.instructor_id) {
            await supabase
                .from('notifications')
                .insert([{
                    target_user_id: course.instructor_id,
                    title: 'New Attendance Correction Request',
                    message: `A student has requested an attendance correction`,
                    type: 'attendance',
                    related_entity_type: 'attendance_correction',
                    related_entity_id: data?.id,
                    link: '/instructor/attendance-requests'
                }]);
        }

        toast.success('Correction request submitted successfully');
        return data;
    } catch (error) {
        console.error('Error creating correction request:', error);
        toast.error('Failed to submit correction request');
        return null;
    }
}

// Approve correction request
export async function approveCorrectionRequest(
    requestId: string,
    reviewInput: ReviewCorrectionInput
): Promise<boolean> {
    try {
        // Get the correction request details
        const { data: correction } = await supabase
            .from('attendance_corrections')
            .select('student_id, lecture_id, requested_status')
            .eq('id', requestId)
            .single();

        if (!correction) {
            toast.error('Correction request not found');
            return false;
        }

        // Update the correction request status
        const { error: updateError } = await supabase
            .from('attendance_corrections')
            .update({
                status: 'approved',
                reviewed_by: reviewInput.reviewed_by,
                reviewed_at: new Date().toISOString(),
                review_comments: reviewInput.review_comments,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (updateError) throw updateError;

        // Update the actual attendance record
        const { error: attendanceError } = await supabase
            .from('lecture_attendance')
            .update({
                status: correction.requested_status,
                marked_at: new Date().toISOString()
            })
            .eq('student_id', correction.student_id)
            .eq('lecture_id', correction.lecture_id);

        if (attendanceError) throw attendanceError;

        // Create notification for student
        await supabase
            .from('notifications')
            .insert([{
                target_user_id: correction.student_id,
                title: 'Attendance Correction Approved',
                message: 'Your attendance correction request has been approved',
                type: 'attendance',
                related_entity_type: 'attendance_correction',
                related_entity_id: requestId,
                link: '/student/leaves'
            }]);

        toast.success('Correction request approved');
        return true;
    } catch (error) {
        console.error('Error approving correction request:', error);
        toast.error('Failed to approve correction request');
        return false;
    }
}

// Reject correction request
export async function rejectCorrectionRequest(
    requestId: string,
    reviewInput: ReviewCorrectionInput
): Promise<boolean> {
    try {
        // Get student ID for notification
        const { data: correction } = await supabase
            .from('attendance_corrections')
            .select('student_id')
            .eq('id', requestId)
            .single();

        if (!correction) {
            toast.error('Correction request not found');
            return false;
        }

        const { error } = await supabase
            .from('attendance_corrections')
            .update({
                status: 'rejected',
                reviewed_by: reviewInput.reviewed_by,
                reviewed_at: new Date().toISOString(),
                review_comments: reviewInput.review_comments,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (error) throw error;

        // Create notification for student
        await supabase
            .from('notifications')
            .insert([{
                target_user_id: correction.student_id,
                title: 'Attendance Correction Rejected',
                message: 'Your attendance correction request has been rejected',
                type: 'attendance',
                related_entity_type: 'attendance_correction',
                related_entity_id: requestId,
                link: '/student/leaves'
            }]);

        toast.success('Correction request rejected');
        return true;
    } catch (error) {
        console.error('Error rejecting correction request:', error);
        toast.error('Failed to reject correction request');
        return false;
    }
}

// Cancel correction request (by student)
export async function cancelCorrectionRequest(requestId: string, studentId: string): Promise<boolean> {
    try {
        // Verify the request belongs to the student
        const { data: correction } = await supabase
            .from('attendance_corrections')
            .select('student_id, status')
            .eq('id', requestId)
            .single();

        if (!correction) {
            toast.error('Correction request not found');
            return false;
        }

        if (correction.student_id !== studentId) {
            toast.error('Unauthorized action');
            return false;
        }

        if (correction.status !== 'pending') {
            toast.error('Can only cancel pending requests');
            return false;
        }

        const { error } = await supabase
            .from('attendance_corrections')
            .delete()
            .eq('id', requestId);

        if (error) throw error;

        toast.success('Correction request cancelled');
        return true;
    } catch (error) {
        console.error('Error cancelling correction request:', error);
        toast.error('Failed to cancel correction request');
        return false;
    }
}

// Get correction request by ID
export async function getCorrectionRequest(id: string): Promise<CorrectionWithDetails | null> {
    const { data, error } = await supabase
        .from('attendance_corrections')
        .select(`
      *,
      student:users!student_id(id, full_name, email),
      lecture:lectures!lecture_id(
        id,
        date,
        time_start,
        course:courses(id, code, name)
      ),
      reviewer:users!reviewed_by(id, full_name)
    `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching correction request:', error);
        return null;
    }

    return data;
}

// Get correction requests for a course (for instructors)
export async function getCourseCorrectionRequests(courseId: string): Promise<CorrectionWithDetails[]> {
    try {
        // Get all lectures for this course
        const { data: lectures } = await supabase
            .from('lectures')
            .select('id')
            .eq('course_id', courseId);

        if (!lectures || lectures.length === 0) {
            return [];
        }

        const lectureIds = lectures.map(l => l.id);

        const { data, error } = await supabase
            .from('attendance_corrections')
            .select(`
        *,
        student:users!student_id(id, full_name, email),
        lecture:lectures!lecture_id(
          id,
          date,
          time_start,
          course:courses(id, code, name)
        ),
        reviewer:users!reviewed_by(id, full_name)
      `)
            .in('lecture_id', lectureIds)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error fetching course correction requests:', error);
        return [];
    }
}
