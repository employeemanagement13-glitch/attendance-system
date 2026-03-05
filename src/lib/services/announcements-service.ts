import { supabase } from '../supabase';
import { toast } from 'sonner';
import { createNotification } from './notifications-service';

export type Announcement = {
    id: string;
    title: string;
    content: string;
    type: 'system' | 'course' | 'department';
    course_id: string | null;
    department_id: string | null;
    target_role: 'admin' | 'instructor' | 'student' | null;
    created_by: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
};

export type AnnouncementWithDetails = Announcement & {
    course?: { id: string; code: string; name: string };
    department?: { id: string; name: string };
    creator?: { id: string; full_name: string };
};

export type CreateAnnouncementInput = {
    title: string;
    content: string;
    type: 'system' | 'course' | 'department';
    course_id?: string;
    department_id?: string;
    target_role?: 'admin' | 'instructor' | 'student';
    created_by?: string;
    expires_at?: string;
};

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput>;

// Get all announcements with filters
export async function getAnnouncements(filters?: {
    type?: string;
    course_id?: string;
    department_id?: string;
    target_role?: string;
}): Promise<AnnouncementWithDetails[]> {
    let query = supabase
        .from('announcements')
        .select(`
      *,
      course:courses(id, code, name),
      department:departments(id, name),
      creator:users!created_by(id, full_name)
    `)
        .order('created_at', { ascending: false });

    if (filters?.type) {
        query = query.eq('type', filters.type);
    }
    if (filters?.course_id) {
        query = query.eq('course_id', filters.course_id);
    }
    if (filters?.department_id) {
        query = query.eq('department_id', filters.department_id);
    }
    if (filters?.target_role) {
        query = query.eq('target_role', filters.target_role);
    }

    // Filter out expired announcements
    query = query.or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching announcements:', error);
        toast.error('Failed to load announcements');
        return [];
    }

    return data || [];
}

// Get announcements for a specific user based on their role
export async function getAnnouncementsByUser(
    userId: string,
    role: 'admin' | 'instructor' | 'student'
): Promise<AnnouncementWithDetails[]> {
    try {
        // Get user details to determine department and courses
        const { data: user } = await supabase
            .from('users')
            .select('id, department_id')
            .eq('id', userId)
            .single();

        if (!user) return [];

        // Get system-wide announcements
        const systemAnnouncements = await getAnnouncements({ type: 'system' });

        // Get role-specific announcements
        const roleAnnouncements = await getAnnouncements({ target_role: role });

        // Get department announcements
        let departmentAnnouncements: AnnouncementWithDetails[] = [];
        if (user.department_id) {
            departmentAnnouncements = await getAnnouncements({
                type: 'department',
                department_id: user.department_id
            });
        }

        // Get course announcements (if student or instructor)
        let courseAnnouncements: AnnouncementWithDetails[] = [];
        if (role === 'student') {
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('course_id')
                .eq('student_id', userId)
                .eq('status', 'enrolled');

            if (enrollments) {
                const courseIds = enrollments.map(e => e.course_id);
                for (const courseId of courseIds) {
                    const announcements = await getAnnouncements({
                        type: 'course',
                        course_id: courseId
                    });
                    courseAnnouncements.push(...announcements);
                }
            }
        } else if (role === 'instructor') {
            const { data: courses } = await supabase
                .from('courses')
                .select('id')
                .eq('instructor_id', userId);

            if (courses) {
                for (const course of courses) {
                    const announcements = await getAnnouncements({
                        type: 'course',
                        course_id: course.id
                    });
                    courseAnnouncements.push(...announcements);
                }
            }
        }

        // Combine and deduplicate
        const allAnnouncements = [
            ...systemAnnouncements,
            ...roleAnnouncements,
            ...departmentAnnouncements,
            ...courseAnnouncements
        ];

        const uniqueAnnouncements = Array.from(
            new Map(allAnnouncements.map(a => [a.id, a])).values()
        );

        return uniqueAnnouncements.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    } catch (error) {
        console.error('Error fetching user announcements:', error);
        return [];
    }
}

// Get single announcement
export async function getAnnouncement(id: string): Promise<AnnouncementWithDetails | null> {
    const { data, error } = await supabase
        .from('announcements')
        .select(`
      *,
      course:courses(id, code, name),
      department:departments(id, name),
      creator:users!created_by(id, full_name)
    `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching announcement:', error);
        toast.error('Failed to load announcement');
        return null;
    }

    return data;
}

// Create new announcement
export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement | null> {
    // Clean up input based on type
    const cleanedInput = {
        ...input,
        course_id: input.type === 'course' ? input.course_id : null,
        department_id: input.type === 'department' ? input.department_id : null
    };

    const { data, error } = await supabase
        .from('announcements')
        .insert([cleanedInput])
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error creating announcement:', error);
        toast.error('Failed to create announcement');
        return null;
    }

    // Create notification for all affected users
    if (data) {
        await createNotification({
            title: `New ${input.type.charAt(0).toUpperCase() + input.type.slice(1)} Announcement`,
            message: input.title,
            type: input.type === 'system' ? 'system' : 'academic',
            target_role: input.target_role || null,
            created_by: input.created_by
        });
    }

    toast.success('Announcement created successfully');
    return data;
}

// Update announcement
export async function updateAnnouncement(id: string, input: UpdateAnnouncementInput): Promise<Announcement | null> {
    const { data, error } = await supabase
        .from('announcements')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error updating announcement:', error);
        toast.error('Failed to update announcement');
        return null;
    }

    toast.success('Announcement updated successfully');
    return data;
}

// Delete announcement
export async function deleteAnnouncement(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting announcement:', error);
        toast.error('Failed to delete announcement');
        return false;
    }

    toast.success('Announcement deleted successfully');
    return true;
}

// Get announcements by course
export async function getAnnouncementsByCourse(courseId: string): Promise<AnnouncementWithDetails[]> {
    return getAnnouncements({ type: 'course', course_id: courseId });
}

// Get announcements by department
export async function getAnnouncementsByDepartment(departmentId: string): Promise<AnnouncementWithDetails[]> {
    return getAnnouncements({ type: 'department', department_id: departmentId });
}
