import { supabase } from '../supabase';
import { toast } from 'sonner';

export type Resource = {
    id: string;
    name: string;
    file_path: string;
    file_type: string | null;
    file_size: number | null;
    course_id: string | null;
    uploaded_by: string | null;
    description: string | null;
    visibility?: string;
    created_at: string;
    updated_at: string;
};

export type ResourceWithDetails = Resource & {
    course?: { id: string; code: string; name: string } | null;
    uploader?: { id: string; full_name: string; email: string } | null;
};

export type CreateResourceInput = {
    name: string;
    file_path: string;
    file_type?: string;
    file_size?: number;
    course_id?: string;
    uploaded_by?: string;
    description?: string;
    visibility?: string;
};

export type UpdateResourceInput = Partial<CreateResourceInput>;

// Get all resources with optional filters
export async function getResources(filters?: {
    uploadedBy?: string;
    courseId?: string;
}): Promise<ResourceWithDetails[]> {
    let query = supabase
        .from('resources')
        .select(`
      *,
      course:courses(id, code, name),
      uploader:users!uploaded_by(id, full_name, email)
    `)
        .order('created_at', { ascending: false });

    if (filters?.uploadedBy) {
        query = query.eq('uploaded_by', filters.uploadedBy);
    }
    if (filters?.courseId) {
        query = query.eq('course_id', filters.courseId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching resources:', error);
        toast.error('Failed to load resources');
        return [];
    }

    return data || [];
}

// Get instructor resources (own uploads + visibility 'all' + their course specific)
export async function getInstructorResources(instructorId: string): Promise<ResourceWithDetails[]> {
    // 1. Get courses taught by instructor
    const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('instructor_id', instructorId);

    const courseIds = (courses || []).map(c => c.id);

    let query = supabase
        .from('resources')
        .select(`
      *,
      course:courses(id, code, name),
      uploader:users!uploaded_by(id, full_name, email)
    `)
        .order('created_at', { ascending: false });

    // Instructor needs to see:
    // 1. Resources they uploaded
    // 2. Resources where visibility = 'all'
    // 3. Resources where course_id is in their course list

    let orConditions = [`uploaded_by.eq.${instructorId}`, `visibility.eq.all`];
    if (courseIds.length > 0) {
        orConditions.push(`course_id.in.(${courseIds.join(',')})`);
    }

    const { data, error } = await query.or(orConditions.join(','));

    if (error) {
        console.error('Error fetching instructor resources:', error);
        toast.error('Failed to load resources');
        return [];
    }

    return data || [];
}

// Get resources by course
export async function getResourcesByCourse(courseId: string): Promise<ResourceWithDetails[]> {
    const { data, error } = await supabase
        .from('resources')
        .select(`
      *,
      course:courses(id, code, name),
      uploader:users!uploaded_by(id, full_name, email)
    `)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching course resources:', error);
        toast.error('Failed to load resources');
        return [];
    }

    return data || [];
}

// Get single resource
export async function getResource(id: string): Promise<ResourceWithDetails | null> {
    const { data, error } = await supabase
        .from('resources')
        .select(`
      *,
      course:courses(id, code, name),
      uploader:users!uploaded_by(id, full_name, email)
    `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching resource:', error);
        toast.error('Failed to load resource');
        return null;
    }

    return data;
}

// Upload file to Supabase Storage
export async function uploadFile(
    file: File,
    bucket: string = 'course-materials',
    folder?: string
): Promise<string | null> {
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

    if (error) {
        console.error('Error uploading file:', error);
        toast.error('Failed to upload file');
        return null;
    }

    return data.path;
}

// Get public URL for file
export async function getFileUrl(filePath: string, bucket: string = 'course-materials'): Promise<string> {
    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return data.publicUrl;
}

// Download file from storage
export async function downloadResourceFile(filePath: string, fileName: string, bucket: string = 'course-materials'): Promise<void> {
    try {
        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath, { download: fileName });

        // Navigate to the direct download URL forcing the specified file name
        const link = document.createElement('a');
        link.href = data.publicUrl;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        console.error('Error downloading file:', error);
        toast.error('Failed to download file');
        throw error;
    }
}

// Delete file from Supabase Storage
export async function deleteFile(filePath: string, bucket: string = 'course-materials'): Promise<boolean> {
    const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

    if (error) {
        console.error('Error deleting file:', error);
        return false;
    }

    return true;
}

// Create resource metadata
export async function createResource(input: CreateResourceInput): Promise<Resource | null> {
    const { data, error } = await supabase
        .from('resources')
        .insert([input])
        .select()
        .single();

    if (error) {
        console.error('Error creating resource:', error);
        toast.error('Failed to create resource');
        return null;
    }

    toast.success('Resource uploaded successfully');
    return data;
}

// Update resource metadata
export async function updateResource(id: string, input: UpdateResourceInput): Promise<Resource | null> {
    const { data, error } = await supabase
        .from('resources')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating resource:', error);
        toast.error('Failed to update resource');
        return null;
    }

    toast.success('Resource updated successfully');
    return data;
}

// Delete resource (both metadata and file)
export async function deleteResource(id: string): Promise<boolean> {
    // First get the resource to get file path
    const resource = await getResource(id);
    if (!resource) return false;

    // Delete from storage
    const fileDeleted = await deleteFile(resource.file_path);

    // Delete metadata from database
    const { error } = await supabase
        .from('resources')
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

// Get storage usage statistics
export async function getStorageUsage(): Promise<{
    totalSize: number;
    fileCount: number;
}> {
    const { data, error } = await supabase
        .from('resources')
        .select('file_size');

    if (error) {
        console.error('Error fetching storage usage:', error);
        return { totalSize: 0, fileCount: 0 };
    }

    const totalSize = (data || []).reduce((sum, r) => sum + (r.file_size || 0), 0);

    return {
        totalSize,
        fileCount: data?.length || 0
    };
}

// Get top uploaders
export async function getTopUploaders(limit: number = 5): Promise<Array<{
    user: { id: string; full_name: string };
    count: number;
    totalSize: number;
}>> {
    const { data, error } = await supabase
        .from('resources')
        .select(`
      uploaded_by,
      file_size,
      uploader:users!uploaded_by(id, full_name)
    `);

    if (error) {
        console.error('Error fetching top uploaders:', error);
        return [];
    }

    // Group by uploader
    const uploaderMap = new Map<string, { user: any; count: number; totalSize: number }>();

    (data || []).forEach(resource => {
        if (!resource.uploaded_by || !resource.uploader) return;

        const existing = uploaderMap.get(resource.uploaded_by);
        if (existing) {
            existing.count++;
            existing.totalSize += resource.file_size || 0;
        } else {
            uploaderMap.set(resource.uploaded_by, {
                user: resource.uploader,
                count: 1,
                totalSize: resource.file_size || 0
            });
        }
    });

    // Convert to array and sort by total size
    return Array.from(uploaderMap.values())
        .sort((a, b) => b.totalSize - a.totalSize)
        .slice(0, limit);
}

// Helper function to format file size
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get all resources for enrolled courses of a student
 */
export async function getStudentResources(studentId: string): Promise<ResourceWithDetails[]> {
    // 1. Get enrolled courses
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', studentId)
        .eq('status', 'enrolled');

    const courseIds = (enrollments || []).map(e => e.course_id);

    // 2. Get resources for these courses AND general resources
    let query = supabase
        .from('resources')
        .select(`
            *,
            course:courses(id, code, name),
            uploader:users!uploaded_by(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

    let orConditions = [`visibility.eq.all`];
    if (courseIds.length > 0) {
        orConditions.push(`course_id.in.(${courseIds.join(',')})`);
    }

    const { data: resources, error } = await query.or(orConditions.join(','));

    if (error) {
        console.error('Error fetching student resources:', error);
        return [];
    }

    return resources || [];
}
