import { supabase } from '../supabase';
import { toast } from 'sonner';

export type CourseMaterial = {
    id: string;
    course_id: string;
    title: string;
    description: string | null;
    file_path: string;
    file_type: string | null;
    file_size: number | null;
    category: string | null;
    uploaded_by: string | null;
    created_at: string;
    updated_at: string;
};

export type MaterialWithDetails = CourseMaterial & {
    course?: { id: string; code: string; name: string };
    uploader?: { id: string; full_name: string };
};

export type CreateMaterialInput = {
    course_id: string;
    title: string;
    description?: string;
    file_path: string;
    file_type?: string;
    file_size?: number;
    category?: string;
    uploaded_by?: string;
};

export type UpdateMaterialInput = Partial<Omit<CreateMaterialInput, 'course_id' | 'file_path'>>;

// Get all materials with filters
export async function getMaterials(filters?: {
    course_id?: string;
    category?: string;
}): Promise<MaterialWithDetails[]> {
    let query = supabase
        .from('course_materials')
        .select(`
      *,
      course:courses(id, code, name),
      uploader:users!uploaded_by(id, full_name)
    `)
        .order('created_at', { ascending: false });

    if (filters?.course_id) {
        query = query.eq('course_id', filters.course_id);
    }
    if (filters?.category) {
        query = query.eq('category', filters.category);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching materials:', error);
        toast.error('Failed to load materials');
        return [];
    }

    return data || [];
}

// Get materials by course
export async function getMaterialsByCourse(courseId: string): Promise<MaterialWithDetails[]> {
    return getMaterials({ course_id: courseId });
}

// Get materials by type
export async function getMaterialsByType(courseId: string, category: string): Promise<MaterialWithDetails[]> {
    return getMaterials({ course_id: courseId, category });
}

// Get single material
export async function getMaterial(id: string): Promise<MaterialWithDetails | null> {
    const { data, error } = await supabase
        .from('course_materials')
        .select(`
      *,
      course:courses(id, code, name),
      uploader:users!uploaded_by(id, full_name)
    `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching material:', error);
        toast.error('Failed to load material');
        return null;
    }

    return data;
}

// Upload new material
export async function uploadMaterial(input: CreateMaterialInput): Promise<CourseMaterial | null> {
    const { data, error } = await supabase
        .from('course_materials')
        .insert([input])
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error uploading material:', error);
        toast.error('Failed to upload material');
        return null;
    }

    toast.success('Material uploaded successfully');
    return data;
}

// Update material
export async function updateMaterial(id: string, input: UpdateMaterialInput): Promise<CourseMaterial | null> {
    const { data, error } = await supabase
        .from('course_materials')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error updating material:', error);
        toast.error('Failed to update material');
        return null;
    }

    toast.success('Material updated successfully');
    return data;
}

// Delete material
export async function deleteMaterial(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('course_materials')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting material:', error);
        toast.error('Failed to delete material');
        return false;
    }

    toast.success('Material deleted successfully');
    return true;
}

// Get material categories for a course
export async function getMaterialCategories(courseId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('course_materials')
        .select('category')
        .eq('course_id', courseId)
        .not('category', 'is', null);

    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }

    const categories = [...new Set(data.map(m => m.category))].filter(Boolean) as string[];
    return categories;
}

// Course Resources (URLs, Links, etc.)
export type CourseResource = {
    id: string;
    course_id: string;
    title: string;
    resource_type: string;
    resource_url: string;
    description: string | null;
    created_at: string;
    created_by: string | null;
};

export type ResourceWithDetails = CourseResource & {
    course?: { id: string; code: string; name: string };
    creator?: { id: string; full_name: string };
};

export type CreateResourceInput = {
    course_id: string;
    title: string;
    resource_type: string;
    resource_url: string;
    description?: string;
    created_by?: string;
};

// Get resources by course
export async function getResourcesByCourse(courseId: string): Promise<ResourceWithDetails[]> {
    const { data, error } = await supabase
        .from('course_resources')
        .select(`
      *,
      course:courses(id, code, name),
      creator:users!created_by(id, full_name)
    `)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching resources:', error);
        toast.error('Failed to load resources');
        return [];
    }

    return data || [];
}

// Create resource
export async function createResource(input: CreateResourceInput): Promise<CourseResource | null> {
    const { data, error } = await supabase
        .from('course_resources')
        .insert([input])
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error creating resource:', error);
        toast.error('Failed to create resource');
        return null;
    }

    toast.success('Resource added successfully');
    return data;
}

// Delete resource
export async function deleteResource(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('course_resources')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting resource:', error);
        toast.error('Failed to delete resource');
        return false;
    }

    toast.success('Resource deleted successfully');
    return true;
}
