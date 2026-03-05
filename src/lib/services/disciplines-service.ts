import { supabase } from '../supabase';
import { toast } from 'sonner';

export type Discipline = {
    id: string;
    name: string;
    department_id: string;
    created_at: string;
};

export type DisciplineWithDetails = Discipline & {
    department: { name: string };
    courses_count?: number;
    students_count?: number;
    total_credit_hours?: number;
};

export async function getDisciplines(): Promise<DisciplineWithDetails[]> {
    try {
        // Fetch direct data for IDs, counts, and departments
        const { data: directData, error: directError } = await supabase
            .from('disciplines')
            .select(`
                *,
                department:departments(id, name),
                courses(id, credit_hours),
                users(id, role)
            `)
            .order('name');

        if (directError) {
            console.error('Error fetching disciplines directly:', JSON.stringify(directError, null, 2));
            return [];
        }

        // Map data with accurate counts
        const disciplines = (directData || []).map((d: any) => {
            const coursesCount = d.courses?.length || 0;
            const studentsCount = d.users?.filter((u: any) => u.role === 'student').length || 0;
            let totalCreditHours = 0;
            d.courses?.forEach((c: any) => {
                totalCreditHours += (c.credit_hours || 0);
            });
            return {
                ...d,
                courses_count: coursesCount,
                students_count: studentsCount,
                total_credit_hours: totalCreditHours,
                attendance: 0,
                department: { name: d.department?.name || "N/A" }
            };
        });

        // Try getting attendance from the view if available
        const { data: viewData } = await supabase
            .from('discipline_attendance_stats')
            .select('discipline_id, attendance_percentage');

        if (viewData) {
            return disciplines.map(d => {
                const v = viewData.find(v => v.discipline_id === d.id);
                return {
                    ...d,
                    attendance: v ? v.attendance_percentage : 0
                };
            }) as DisciplineWithDetails[];
        }

        return disciplines as DisciplineWithDetails[];
    } catch (err) {
        console.error('Unexpected error in getDisciplines:', err);
        return [];
    }
}

export async function getDiscipline(id: string): Promise<DisciplineWithDetails | null> {
    const { data, error } = await supabase
        .from('disciplines')
        .select(`
            *,
            department:departments(name)
        `)
        .eq('id', id)
        .single();

    if (error) {
        return null;
    }

    return data;
}

export async function createDiscipline(input: { name: string, department_id: string }) {
    const { data, error } = await supabase
        .from('disciplines')
        .insert([input])
        .select()
        .single();

    if (error) {
        toast.error('Failed to create discipline');
        return null;
    }
    toast.success('Discipline created');
    return data;
}

export async function updateDiscipline(id: string, input: { name?: string, department_id?: string }) {
    const { data, error } = await supabase
        .from('disciplines')
        .update(input)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        toast.error('Failed to update discipline');
        return null;
    }
    toast.success('Discipline updated');
    return data;
}

export async function deleteDiscipline(id: string) {
    const { error } = await supabase.from('disciplines').delete().eq('id', id);
    if (error) {
        toast.error('Delete failed');
        return false;
    }
    toast.success('Discipline deleted');
    return true;
}
