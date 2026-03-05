import { supabase } from '../supabase';
import { toast } from 'sonner';

export type SystemSetting = {
    id: string;
    key: string;
    value: string;
    description: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
};

export type SystemSettingWithUpdater = SystemSetting & {
    updater?: { id: string; full_name: string; email: string } | null;
};

export type UpdateSettingInput = {
    value: string;
    updated_by?: string;
};

// Get all settings
export async function getSettings(): Promise<SystemSettingWithUpdater[]> {
    const { data, error } = await supabase
        .from('system_settings')
        .select(`
      *,
      updater:users!updated_by(id, full_name, email)
    `)
        .order('key');

    if (error) {
        console.error('Error fetching settings:', error);
        toast.error('Failed to load settings');
        return [];
    }

    return data || [];
}

// Get setting by key
export async function getSetting(key: string): Promise<SystemSetting | null> {
    const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', key)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // No rows returned
            return null;
        }
        console.error('Error fetching setting:', error);
        return null;
    }

    return data;
}

// Get setting value
export async function getSettingValue(key: string, defaultValue?: string): Promise<string | null> {
    const setting = await getSetting(key);
    return setting?.value || defaultValue || null;
}

// Update setting
export async function updateSetting(key: string, input: UpdateSettingInput): Promise<SystemSetting | null> {
    const { data, error } = await supabase
        .from('system_settings')
        .update({
            value: input.value,
            updated_by: input.updated_by || null,
            updated_at: new Date().toISOString()
        })
        .eq('key', key)
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error updating setting:', error);
        toast.error('Failed to update setting');
        return null;
    }

    toast.success('Setting updated successfully');
    return data;
}

// Create setting (if it doesn't exist)
export async function createSetting(
    key: string,
    value: string,
    description?: string,
    updatedBy?: string
): Promise<SystemSetting | null> {
    const { data, error } = await supabase
        .from('system_settings')
        .insert([{
            key,
            value,
            description,
            updated_by: updatedBy
        }])
        .select()
        .maybeSingle();

    if (error) {
        console.error('Error creating setting:', error);
        toast.error('Failed to create setting');
        return null;
    }

    return data;
}

// Upsert setting (create if not exists, update if exists)
export async function upsertSetting(
    key: string,
    value: string,
    description?: string,
    updatedBy?: string
): Promise<SystemSetting | null> {
    const existing = await getSetting(key);

    if (existing) {
        return updateSetting(key, { value, updated_by: updatedBy });
    } else {
        return createSetting(key, value, description, updatedBy);
    }
}

// Batch update settings
export async function updateMultipleSettings(
    settings: Array<{ key: string; value: string }>,
    updatedBy?: string
): Promise<boolean> {
    try {
        await Promise.all(
            settings.map(s => updateSetting(s.key, { value: s.value, updated_by: updatedBy }))
        );
        return true;
    } catch (error) {
        console.error('Error updating multiple settings:', error);
        toast.error('Failed to update some settings');
        return false;
    }
}

// Convenience getters for common settings
export async function getMaintenanceMode(): Promise<boolean> {
    const value = await getSettingValue('maintenance_mode', 'false');
    return value === 'true';
}

export async function setMaintenanceMode(enabled: boolean, updatedBy?: string): Promise<boolean> {
    const result = await updateSetting('maintenance_mode', {
        value: enabled ? 'true' : 'false',
        updated_by: updatedBy
    });
    return result !== null;
}

export async function getSupportEmail(): Promise<string> {
    return await getSettingValue('support_email', 'support@university.edu') || 'support@university.edu';
}

export async function getCurrentSemester(): Promise<string> {
    return await getSettingValue('current_semester', 'Fall 2024') || 'Fall 2024';
}

export async function getSemesterEndDate(): Promise<string> {
    return await getSettingValue('semester_end_date', '2024-12-20') || '2024-12-20';
}

export async function getWarningThreshold(): Promise<number> {
    const value = await getSettingValue('warning_threshold', '75');
    return parseInt(value || '75', 10);
}

export async function getDebarmentThreshold(): Promise<number> {
    const value = await getSettingValue('debarment_threshold', '60');
    return parseInt(value || '60', 10);
}
