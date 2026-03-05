"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Check, Trash2, Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import {
    getNotificationsByRole,
    markAsRead,
    deleteNotification,
    NotificationWithCreator
} from "@/lib/services/notifications-service";

export default function InstructorNotificationsPage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState<NotificationWithCreator[]>([]);

    const fetchData = async () => {
        if (!isLoaded || !user) return;

        try {
            // Role is fixed as instructor for this page
            const data = await getNotificationsByRole('instructor');
            setNotifications(data);
        } catch (error) {
            console.error("Error loading notifications:", error);
            toast.error("Failed to load notifications");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isLoaded, user]);

    const handleMarkRead = async (id: string) => {
        const success = await markAsRead(id);
        if (success) {
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, status: 'read' as const } : n
            ));
            toast.success("Marked as read");
        }
    };

    const handleDelete = async (id: string) => {
        const success = await deleteNotification(id);
        if (success) {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }
    };

    const handleMarkAllRead = async () => {
        const unreadIds = notifications.filter(n => n.status === 'unread').map(n => n.id);
        if (unreadIds.length === 0) {
            toast.info("No unread notifications");
            return;
        }

        try {
            const promises = unreadIds.map(id => markAsRead(id));
            await Promise.all(promises);
            setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as const })));
            toast.success(`Marked ${unreadIds.length} notifications as read`);
        } catch (error) {
            console.error("Error marking all as read:", error);
            toast.error("Failed to mark all as read");
        }
    };

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
                    <p className="text-muted-foreground">Stay updated with system alerts</p>
                </div>
                <Button variant="outline" onClick={handleMarkAllRead}>
                    <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {notifications.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-black">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Bell className="h-8 w-8 opacity-50" />
                                        <p>No notifications</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            notifications.map((notification) => (
                                <TableRow key={notification.id} className={notification.status === 'unread' ? 'bg-muted/30 text-black' : 'text-black'}>
                                    <TableCell className="text-black">
                                        <Badge variant={
                                            notification.type === 'alert' ? 'default' :
                                                notification.type === 'academic' ? 'default' : 'secondary'
                                        }>
                                            {notification.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{notification.title}</span>
                                            <span className="text-sm text-muted-foreground">{notification.message}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                                    </TableCell>
                                    <TableCell>
                                        {notification.status === 'unread' ? (
                                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                                Unread
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-gray-500 border-gray-200 bg-gray-50">
                                                Read
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {notification.status === 'unread' && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleMarkRead(notification.id)}
                                                    title="Mark as read"
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-500 hover:text-red-600"
                                                onClick={() => handleDelete(notification.id)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
