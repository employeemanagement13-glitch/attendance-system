"use client";

import { useState, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { format, formatDistanceToNow } from "date-fns";
import { Bell, Calendar, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getNotificationsByRole, markAsRead, getUnreadCount, NotificationWithCreator } from "@/lib/services/notifications-service";
import { supabase } from "@/lib/supabase";

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
    const { user, isLoaded } = useUser();
    const [notifications, setNotifications] = useState<NotificationWithCreator[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const currentDate = format(new Date(), "EEEE, MMMM d, yyyy");
    const [role, setRole] = useState<string>("");

    useEffect(() => {
        const fetchRoleAndNotifications = async () => {
            if (!isLoaded || !user) {
                console.log('[Navbar] Skipping fetch - missing data');
                return;
            }

            // 1. Determine role (try publicMetadata first, fallback to DB)
            let userRole = (user.publicMetadata?.role as string) || "";

            if (!userRole) {
                try {
                    const email = user.primaryEmailAddress?.emailAddress;
                    if (email) {
                        const { data: rows } = await supabase.rpc('get_user_by_email', { p_email: email });
                        if (rows && rows[0] && rows[0].role) {
                            userRole = rows[0].role;
                        }
                    }
                } catch (e) {
                    console.error('[Navbar] Error fetching role from DB:', e);
                }
            }

            setRole(userRole);

            if (!userRole) {
                return;
            }

            const validRole = userRole.toLowerCase() as 'admin' | 'instructor' | 'student';
            if (!['admin', 'instructor', 'student'].includes(validRole)) {
                console.log('[Navbar] Invalid role:', validRole);
                return;
            }

            // 2. Fetch notifications
            try {
                console.log('[Navbar] Fetching notifications for role:', validRole);
                const data = await getNotificationsByRole(validRole);
                setNotifications(data);

                // Compute unread count precisely from the fetched data
                const count = data.filter(n => n.status === 'unread').length;
                setUnreadCount(count);
            } catch (error) {
                console.error('[Navbar] Error fetching notifications:', error);
            }
        };

        fetchRoleAndNotifications();
        const interval = setInterval(fetchRoleAndNotifications, 60000);
        return () => clearInterval(interval);
    }, [isLoaded, user]);

    const handleMarkAsRead = async (id: string) => {
        const success = await markAsRead(id);
        if (success) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' as const } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    return (
        <nav className="h-16 md:h-20 border-b bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 shrink-0">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={onMenuClick}
                >
                    <Menu className="h-5 w-5" />
                </Button>
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold text-foreground tracking-tight">University Panel</h1>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Calendar className="h-3 w-3 text-[#FF8020]" />
                        <span>{currentDate}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-6">
                {/* Notification Bell */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative group hover:bg-orange-50 transition-colors">
                            <Bell className="h-5 w-5 text-muted-foreground group-hover:text-[#FF8020]" />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 h-4 w-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white shadow-sm animate-pulse">
                                    {unreadCount}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96 p-0 bg-white shadow-2xl border-orange-100 rounded-2xl overflow-hidden mt-1" align="end">
                        <div className="p-5 border-b bg-orange-50/50 flex justify-between items-center">
                            <div className="flex flex-col">
                                <h4 className="font-bold text-foreground">Notifications</h4>
                                <p className="text-[11px] text-muted-foreground">Keep up with latest updates</p>
                            </div>
                            {unreadCount > 0 && (
                                <Badge className="bg-[#FF8020] text-white hover:bg-[#FF8020]">{unreadCount} New</Badge>
                            )}
                        </div>
                        <ScrollArea className="h-[350px]">
                            <div className="flex flex-col p-2 space-y-1">
                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-12 text-center">
                                        <Bell className="h-8 w-8 text-slate-200 mb-2" />
                                        <p className="text-sm text-muted-foreground">All caught up!</p>
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            onClick={() => notif.status === 'unread' && handleMarkAsRead(notif.id)}
                                            className={cn(
                                                "flex flex-col gap-1 p-4 rounded-xl cursor-pointer transition-all duration-200",
                                                notif.status === 'unread'
                                                    ? 'bg-orange-50/40 hover:bg-orange-50 border border-orange-100/50'
                                                    : 'hover:bg-slate-50 border border-transparent'
                                            )}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <span className={cn("text-sm font-semibold leading-tight", notif.status === 'unread' ? "text-foreground" : "text-muted-foreground")}>
                                                    {notif.title}
                                                </span>
                                                {notif.status === 'unread' && <div className="h-2 w-2 rounded-full bg-[#FF8020] shrink-0 mt-1" />}
                                            </div>
                                            <p className="text-[13px] text-foreground/70 leading-relaxed font-medium">
                                                {notif.message}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                                                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                        <div className="p-3 border-t bg-slate-50/50 text-center">
                            {role && (
                                <Link href={`/${role.toLowerCase()}/notifications`}>
                                    <Button variant="ghost" size="sm" className="text-xs font-bold text-[#FF8020] hover:text-[#FF8020] hover:bg-orange-50 w-full">
                                        View all notifications
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

                <div className="h-8 w-px bg-slate-200" />

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-sm font-bold text-foreground leading-none">{user?.fullName || "User"}</span>
                    </div>
                </div>
            </div>
        </nav>
    );
}

