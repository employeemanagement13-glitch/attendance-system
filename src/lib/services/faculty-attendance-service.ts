import { supabase } from '../supabase';
import { toast } from 'sonner';

export type FacultyAttendanceStatus = 'present' | 'absent' | 'late' | 'short_leave';

export type FacultyAttendance = {
    id: string;
    instructor_id: string;
    date: string;
    on_campus: string | null;
    left_campus: string | null;
    status: FacultyAttendanceStatus;
    created_at: string;
};

export type FacultyAttendanceWithDetails = FacultyAttendance & {
    instructor?: {
        id: string;
        full_name: string;
        clerk_id: string;
        department?: { name: string };
    };
};

export async function getFacultyAttendance(date?: string): Promise<FacultyAttendanceWithDetails[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('faculty_attendance')
        .select(`
            *,
            instructor:users!instructor_id(
                id,
                full_name,
                clerk_id,
                department:departments(name)
            )
        `)
        .eq('date', targetDate);

    if (error) {
        console.error('Error fetching faculty attendance:', error);
        return [];
    }

    return data;
}

export async function markFacultyAttendance(input: {
    instructor_id: string;
    date: string;
    status: FacultyAttendanceStatus;
    on_campus?: string;
    left_campus?: string;
}) {
    const { data, error } = await supabase
        .from('faculty_attendance')
        .upsert(input, { onConflict: 'instructor_id,date' })
        .select()
        .single();

    if (error) {
        console.error('Error marking faculty attendance:', error);
        toast.error('Failed to mark attendance');
        return null;
    }

    // toast.success('Attendance marked'); // Silent for radio button UX
    return data;
}

export async function getFacultyStats(instructor_id: string) {
    const { data, error } = await supabase
        .from('faculty_attendance')
        .select('status')
        .eq('instructor_id', instructor_id);

    if (error) return { lates: 0, absents: 0, shortLeaves: 0, percentage: 100 };

    const total = data.length || 1;
    const lates = data.filter(d => d.status === 'late').length;
    const absents = data.filter(d => d.status === 'absent').length;
    const shortLeaves = data.filter(d => d.status === 'short_leave').length;
    const presents = data.filter(d => d.status === 'present').length;

    const percentage = ((presents + lates + shortLeaves) / total) * 100;

    return {
        lates,
        absents,
        shortLeaves,
        percentage: Math.round(percentage)
    };
}

// Get attendance history for a specific instructor
export async function getInstructorAttendanceHistory(
    instructor_id: string,
    limit: number = 30
): Promise<FacultyAttendanceWithDetails[]> {
    const { data, error } = await supabase
        .from('faculty_attendance')
        .select(`
            *,
            instructor:users!instructor_id(
                id,
                full_name,
                clerk_id,
                department:departments(name)
            )
        `)
        .eq('instructor_id', instructor_id)
        .order('date', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching instructor attendance history:', error);
        return [];
    }

    return data;
}
