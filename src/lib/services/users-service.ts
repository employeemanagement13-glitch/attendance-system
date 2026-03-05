import { supabase } from '../supabase';
import { toast } from 'sonner';
import { logAction } from './audit-service';

export type User = {
    id: string;
    email: string;
    full_name: string | null;
    role: 'admin' | 'instructor' | 'student';
    clerk_id: string | null;
    department_id: string | null;
    discipline_id: string | null;
    status: 'active' | 'inactive';
    phone: string | null;
    address: string | null;
    profile_picture: string | null;
    designation: string | null;
    education: string | null;
    office_location: string | null;
    daily_time_start: string | null;
    daily_time_end: string | null;
    availability: string | null;
    cgpa: number | null;
    gpa: number | null;
    current_semester: number | null;
    created_at: string;
    updated_at: string;
};

export type UserWithDepartment = User & {
    department?: { id: string; name: string };
    discipline?: { id: string; name: string };
};

export type CreateUserInput = {
    email: string;
    full_name: string;
    role: 'admin' | 'instructor' | 'student';
    department_id?: string;
    discipline_id?: string;
    current_semester?: number;
    phone?: string;
    address?: string;
    clerk_id?: string;
    profile_picture?: string;
    designation?: string;
    education?: string;
    office_location?: string;
    daily_time_start?: string;
    daily_time_end?: string;
    availability?: string;
    cgpa?: number;
    gpa?: number;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'email'>> & {
    status?: 'active' | 'inactive';
};


// Get all users with optional role filter
export async function getUsers(role?: 'admin' | 'instructor' | 'student'): Promise<UserWithDepartment[]> {
    let query = supabase
        .from('users')
        .select(`
      *,
      department:departments(id, name),
      discipline:disciplines(id, name)
    `)
        .order('full_name');

    if (role) {
        query = query.eq('role', role);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching users:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
        toast.error('Failed to load users');
        return [];
    }

    return data || [];
}

// Get students only
export async function getStudents(): Promise<UserWithDepartment[]> {
    return getUsers('student');
}

// Get instructors only
export async function getInstructors(): Promise<UserWithDepartment[]> {
    return getUsers('instructor');
}

// Get single user
export async function getUser(id: string): Promise<UserWithDepartment | null> {
    const { data, error } = await supabase
        .from('users')
        .select(`
      *,
      department:departments(id, name),
      discipline:disciplines(id, name)
    `)
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error('Error fetching user:', error.message, error.code);
        toast.error('Failed to load user');
        return null;
    }

    return data;
}

// Create user
export async function createUser(input: CreateUserInput): Promise<User | null> {
    // Enforce discipline for students and instructors
    if ((input.role === 'student' || input.role === 'instructor') && (!input.discipline_id || input.discipline_id.trim() === '')) {
        toast.error('Discipline is required for students and instructors');
        return null;
    }

    const cleanedInput = {
        ...input,
        department_id: input.department_id && input.department_id.trim() !== "" ? input.department_id : null,
        discipline_id: input.discipline_id && input.discipline_id.trim() !== "" ? input.discipline_id : null,
        status: 'active' as const
    };

    const { data, error } = await supabase
        .from('users')
        .insert([cleanedInput])
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error creating user:', error.message, error.code, error.details);
        toast.error(`Failed to create user: ${error.message}`);
        return null;
    }

    if (data) {
        // Log the creation
        await logAction('create', 'user', data.id, undefined, undefined, `Created user with role ${data.role}`);
    }

    return data;
}

// Update user
export async function updateUser(id: string, input: UpdateUserInput): Promise<User | null> {
    const cleanedInput = {
        ...input,
        department_id: input.department_id && input.department_id.trim() !== "" ? input.department_id : (input.department_id === "" ? null : input.department_id),
        discipline_id: input.discipline_id && input.discipline_id.trim() !== "" ? input.discipline_id : (input.discipline_id === "" ? null : input.discipline_id)
    };

    const { data, error } = await supabase
        .from('users')
        .update({ ...cleanedInput, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();

    // Log the update
    await logAction('update', 'user', id, undefined, undefined, 'User details updated');

    toast.success('User updated successfully');
    return data;
}

// Delete user
export async function deleteUser(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

    // Log the deletion
    await logAction('delete', 'user', id, undefined, undefined, 'User deleted');

    toast.success('User deleted successfully');
    return true;
}

// Deactivate user
export async function deactivateUser(id: string): Promise<boolean> {
    const result = await updateUser(id, { status: 'inactive' });
    return result !== null;
}

// Activate user
export async function activateUser(id: string): Promise<boolean> {
    const result = await updateUser(id, { status: 'active' });
    return result !== null;
}

// Get user counts by role
export async function getUsersCount(role?: 'admin' | 'instructor' | 'student'): Promise<number> {
    let query = supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

    if (role) {
        query = query.eq('role', role);
    }

    const { count, error } = await query;

    if (error) {
        console.error('Error fetching users count:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
        return 0;
    }

    return count || 0;
}

// Get low attendance students (below threshold) using optimized SQL function
export async function getLowAttendanceStudents(threshold: number = 75): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .rpc('get_low_attendance_students_func', { threshold });

        if (error) {
            console.error('Error calling get_low_attendance_students_func:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error calculating low attendance students:', error);
        return [];
    }
}

// Get low attendance faculty (instructors who are frequently late/absent)
export async function getLowAttendanceFaculty(threshold: number = 85): Promise<UserWithDepartment[]> {
    try {
        const { data: instructors, error } = await supabase
            .from('users')
            .select(`
                *,
                department:departments(id, name)
            `)
            .eq('role', 'instructor')
            .eq('status', 'active');

        if (error || !instructors) {
            console.error('Error fetching instructors:', error);
            return [];
        }

        // Calculate attendance for each instructor
        const instructorsWithAttendance = await Promise.all(
            instructors.map(async (instructor) => {
                const { data: facultyAttendance } = await supabase
                    .from('faculty_attendance')
                    .select('status, date')
                    .eq('instructor_id', instructor.id)
                    .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Last 90 days

                if (!facultyAttendance || facultyAttendance.length === 0) {
                    return null;
                }

                const totalDays = facultyAttendance.length;
                const presentDays = facultyAttendance.filter(a =>
                    a.status === 'present' || a.status === 'late'
                ).length;
                const percentage = Math.round((presentDays / totalDays) * 100);

                return {
                    ...instructor,
                    attendancePercentage: percentage
                };
            })
        );

        // Filter and return instructors below threshold
        const lowAttendance = instructorsWithAttendance
            .filter(i => i !== null && i.attendancePercentage < threshold)
            .sort((a, b) => a.attendancePercentage - b.attendancePercentage);

        return lowAttendance;
    } catch (error) {
        console.error('Error calculating low attendance faculty:', error);
        return [];
    }
}

// Get user by email
export async function getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        if (error.code === 'PGRST116') {
            // No rows returned
            return null;
        }
        console.error('Error fetching user by email:', error);
        return null;
    }

    return data;
}
