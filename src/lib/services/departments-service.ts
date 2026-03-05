import { supabase } from '../supabase';
import { toast } from 'sonner';

export type Department = {
  id: string;
  name: string;
  hod: string;
  description?: string;
  created_at: string;
  updated_at: string;
  student_count?: number;
  instructor_count?: number;
};

export type CreateDepartmentInput = {
  name: string;
  hod: string;
  description?: string;
};

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>;

// Get all departments
export async function getDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching departments:', error);
    toast.error('Failed to load departments');
    return [];
  }

  // Fetch counts for each department
  const deptsWithCounts = await Promise.all(
    (data || []).map(async (dept) => {
      const [{ count: sCount }, { count: iCount }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('department_id', dept.id).eq('role', 'student'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('department_id', dept.id).eq('role', 'instructor')
      ]);
      return {
        ...dept,
        student_count: sCount || 0,
        instructor_count: iCount || 0
      };
    })
  );

  return deptsWithCounts;
}

// Get single department
export async function getDepartment(id: string): Promise<Department | null> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching department:', error);
    toast.error('Failed to load department');
    return null;
  }

  return data;
}

// Create department
export async function createDepartment(input: CreateDepartmentInput): Promise<Department | null> {
  const { data, error } = await supabase
    .from('departments')
    .insert([input])
    .select()
    .maybeSingle();

  if (error) {
    console.error(`Error creating department: ${error.message} (Code: ${error.code})`, error);
    toast.error(`Failed to create department: ${error.message || 'Unknown error'}`);
    return null;
  }

  return data;
}

// Update department
export async function updateDepartment(id: string, input: UpdateDepartmentInput): Promise<Department | null> {
  const { data, error } = await supabase
    .from('departments')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating department:', error);
    toast.error('Failed to update department');
    return null;
  }

  toast.success('Department updated successfully');
  return data;
}

// Delete department
export async function deleteDepartment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting department:', error);
    toast.error('Failed to delete department');
    return false;
  }

  toast.success('Department deleted successfully');
  return true;
}

// Get department count
export async function getDepartmentsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('departments')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error fetching departments count:', error);
    return 0;
  }

  return count || 0;
}
