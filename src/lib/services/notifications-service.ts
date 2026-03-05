import { supabase } from '../supabase';
import { toast } from 'sonner';

export type Notification = {
    id: string;
    title: string;
    message: string;
    type: 'system' | 'academic' | 'alert';
    status: 'unread' | 'read';
    target_role: 'admin' | 'instructor' | 'student' | null;
    created_by: string | null;
    created_at: string;
};

export type NotificationWithCreator = Notification & {
    creator?: { id: string; full_name: string; email: string };
};

export type CreateNotificationInput = {
    title: string;
    message: string;
    type: 'system' | 'academic' | 'alert';
    target_role?: 'admin' | 'instructor' | 'student' | null;
    created_by?: string;
};

export type UpdateNotificationInput = {
    status?: 'unread' | 'read';
    title?: string;
    message?: string;
    type?: 'system' | 'academic' | 'alert';
    target_role?: 'admin' | 'instructor' | 'student' | null;
};

// Get all notifications
export async function getNotifications(): Promise<NotificationWithCreator[]> {
    const { data, error } = await supabase
        .from('notifications')
        .select(`
      *,
      creator:users!created_by(id, full_name, email)
    `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching notifications:', error);
        toast.error('Failed to load notifications');
        return [];
    }

    return data || [];
}

// Helper to get read IDs from localStorage
function getLocalReadIds(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem('ams_read_notifications');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

// Helper to mark as read locally
function markReadLocally(id: string) {
    if (typeof window === 'undefined') return;
    try {
        const readIds = getLocalReadIds();
        if (!readIds.includes(id)) {
            localStorage.setItem('ams_read_notifications', JSON.stringify([...readIds, id]));
        }
    } catch (e) {
        console.error('Error saving read status to localStorage:', e);
    }
}

// Get notifications by role
export async function getNotificationsByRole(role: 'admin' | 'instructor' | 'student'): Promise<NotificationWithCreator[]> {
    if (!role) {
        console.warn('getNotificationsByRole called without a valid role');
        return [];
    }

    // Try with creator join first
    const { data, error } = await supabase
        .from('notifications')
        .select(`
      *,
      creator:users!created_by(id, full_name, email)
    `)
        .or(`target_role.eq.${role},target_role.is.null`)
        .order('created_at', { ascending: false });

    let notifications = data || [];

    if (error) {
        // Fallback: query without creator join if RLS blocks it
        const { data: fallbackData, error: fallbackError } = await supabase
            .from('notifications')
            .select('*')
            .or(`target_role.eq.${role},target_role.is.null`)
            .order('created_at', { ascending: false });

        if (fallbackError) {
            return [];
        }
        notifications = fallbackData || [];
    }

    // Apply local read status
    const readIds = getLocalReadIds();

    return notifications.map((n: any) => ({
        ...n,
        status: (n.status === 'read' || readIds.includes(n.id)) ? 'read' as const : 'unread' as const
    }));
}

// Get single notification
export async function getNotification(id: string): Promise<NotificationWithCreator | null> {
    const { data, error } = await supabase
        .from('notifications')
        .select(`
      *,
      creator:users!created_by(id, full_name, email)
    `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching notification:', error);
        toast.error('Failed to load notification');
        return null;
    }

    const readIds = getLocalReadIds();
    return {
        ...data,
        status: (data.status === 'read' || readIds.includes(data.id)) ? 'read' as const : 'unread' as const
    };
}

// Create notification
export async function createNotification(input: CreateNotificationInput): Promise<Notification | null> {
    const { data, error } = await supabase
        .from('notifications')
        .insert([{ ...input, status: 'unread' }])
        .select()
        .single();

    if (error) {
        console.error('Error creating notification:', error);
        toast.error('Failed to create notification');
        return null;
    }

    toast.success('Notification created successfully');
    return data;
}

// Update notification (mainly for marking as read)
export async function updateNotification(id: string, input: UpdateNotificationInput): Promise<Notification | null> {
    const { data, error } = await supabase
        .from('notifications')
        .update(input)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating notification:', error);
        toast.error('Failed to update notification');
        return null;
    }

    return data;
}

// Mark notification as read
export async function markAsRead(id: string): Promise<boolean> {
    // Mark locally regardless of DB success
    markReadLocally(id);

    // Only update DB if it's a specific user notification?
    // For now, we update DB which marks it read globally, BUT our get logic now checks local too.
    // If we want it strictly per user, we should NOT update the global status in DB for role-based notifications.
    // However, if the notification is for a specific user, we can update DB.

    const { data: notif } = await supabase.from('notifications').select('target_user_id').eq('id', id).single();
    if (notif?.target_user_id) {
        const result = await updateNotification(id, { status: 'read' });
        return result !== null;
    }

    // For role-based/system-wide, we just rely on localStorage
    return true;
}

// Mark notification as unread
export async function markAsUnread(id: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
        try {
            const readIds = getLocalReadIds();
            localStorage.setItem('ams_read_notifications', JSON.stringify(readIds.filter(rid => rid !== id)));
        } catch (e) { }
    }

    const { data: notif } = await supabase.from('notifications').select('target_user_id').eq('id', id).single();
    if (notif?.target_user_id) {
        const result = await updateNotification(id, { status: 'unread' });
        return result !== null;
    }
    return true;
}

// Delete notification
export async function deleteNotification(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting notification:', error);
        toast.error('Failed to delete notification');
        return false;
    }

    toast.success('Notification deleted successfully');
    return true;
}

// Get unread notifications count
export async function getUnreadCount(role?: 'admin' | 'instructor' | 'student'): Promise<number> {
    let query = supabase
        .from('notifications')
        .select('id, status', { count: 'exact' })
        .eq('status', 'unread');

    if (role) {
        query = query.or(`target_role.eq.${role},target_role.is.null`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
    }

    const readIds = getLocalReadIds();
    const unreadCount = (data || []).filter(n => !readIds.includes(n.id)).length;

    return unreadCount;
}
