import { supabase } from '../supabase';
import { toast } from 'sonner';

// Cache the IP so we don't call the API on every audit log
let cachedIP: string | null = null;
let ipFetchTime = 0;
const IP_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getClientIP(): Promise<string> {
    const now = Date.now();
    if (cachedIP && (now - ipFetchTime) < IP_CACHE_DURATION) {
        return cachedIP;
    }
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        cachedIP = data.ip;
        ipFetchTime = now;
        return data.ip;
    } catch {
        return 'unknown';
    }
}

export type AuditLog = {
    id: string;
    user_id: string | null;
    user_email: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: string | null;
    ip_address: string | null;
    type: 'security' | 'system' | 'user';
    created_at: string;
};

export type AuditLogWithUser = AuditLog & {
    user?: { id: string; full_name: string; email: string } | null;
};

export type CreateAuditLogInput = {
    user_id?: string | null;
    user_email?: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    details?: string;
    ip_address?: string;
    type?: 'security' | 'system' | 'user';
};

// Get all audit logs
export async function getAuditLogs(limit?: number): Promise<AuditLogWithUser[]> {
    let query = supabase
        .from('audit_logs')
        .select(`
      *,
      user:users(id, full_name, email)
    `)
        .order('created_at', { ascending: false });

    if (limit) {
        query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching audit logs:', error);
        return [];
    }

    return data || [];
}

// Get audit logs by type
export async function getAuditLogsByType(type: 'security' | 'system' | 'user', limit?: number): Promise<AuditLogWithUser[]> {
    let query = supabase
        .from('audit_logs')
        .select(`
      *,
      user:users(id, full_name, email)
    `)
        .eq('type', type)
        .order('created_at', { ascending: false });

    if (limit) {
        query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching audit logs by type:', error);
        return [];
    }

    return data || [];
}

// Get audit logs for specific entity
export async function getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLogWithUser[]> {
    const { data, error } = await supabase
        .from('audit_logs')
        .select(`
      *,
      user:users(id, full_name, email)
    `)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching audit logs by entity:', error);
        return [];
    }

    return data || [];
}

// Get audit logs for specific user
export async function getAuditLogsByUser(userId: string, limit?: number): Promise<AuditLogWithUser[]> {
    let query = supabase
        .from('audit_logs')
        .select(`
      *,
      user:users(id, full_name, email)
    `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (limit) {
        query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching audit logs by user:', error);
        return [];
    }

    return data || [];
}

// Create audit log
export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLog | null> {
    const { data, error } = await supabase
        .from('audit_logs')
        .insert([{
            ...input,
            type: input.type || 'user'
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating audit log:', error);
        // Don't show toast for audit log errors
        return null;
    }

    return data;
}

// Get counts by type
export async function getAuditLogCounts(): Promise<{
    security: number;
    system: number;
    user: number;
    total: number;
}> {
    const [securityRes, systemRes, userRes, totalRes] = await Promise.all([
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('type', 'security'),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('type', 'system'),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('type', 'user'),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true })
    ]);

    return {
        security: securityRes.count || 0,
        system: systemRes.count || 0,
        user: userRes.count || 0,
        total: totalRes.count || 0
    };
}

// Helper function to automatically log actions
export async function logAction(
    action: string,
    entityType: string,
    entityId?: string,
    userId?: string,
    userEmail?: string,
    details?: string
): Promise<void> {
    const ip = await getClientIP();
    await createAuditLog({
        user_id: userId || null,
        user_email: userEmail,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        ip_address: ip,
        type: 'user'
    });
}

// Helper for security events
export async function logSecurityEvent(
    action: string,
    details?: string,
    ip?: string,
    userEmail?: string
): Promise<void> {
    const resolvedIp = ip || await getClientIP();
    await createAuditLog({
        user_email: userEmail,
        action,
        entity_type: 'security',
        details,
        ip_address: resolvedIp,
        type: 'security'
    });
}
