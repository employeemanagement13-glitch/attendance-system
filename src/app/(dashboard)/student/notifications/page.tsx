"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
    getNotificationsByRole,
    markAsRead,
    deleteNotification,
    NotificationWithCreator
} from "@/lib/services/notifications-service";

export default function StudentNotificationsPage() {
    const { isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState<NotificationWithCreator[]>([]);

    const fetchData = async () => {
        try {
            const data = await getNotificationsByRole('student');
            setNotifications(data);
        } catch (error) {
            console.error("Error loading notifications:", error);
            toast.error("Failed to load notifications");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isLoaded) {
            fetchData();
        }
    }, [isLoaded]);

    const handleMarkAsRead = async (id: string) => {
        try {
            const success = await markAsRead(id);
            if (success) {
                setNotifications(prev => prev.map(n =>
                    n.id === id ? { ...n, status: 'read' } : n
                ));
                toast.success("Marked as read");
            }
        } catch (error) {
            toast.error("Failed to update notification");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const success = await deleteNotification(id);
            if (success) {
                setNotifications(prev => prev.filter(n => n.id !== id));
                toast.success("Notification deleted");
            }
        } catch (error) {
            toast.error("Failed to delete notification");
        }
    };

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
                <p className="text-muted-foreground">Stay updated with academic and system alerts</p>
            </div>

            <div className="space-y-4">
                {notifications.length === 0 ? (
                    <div className="text-center py-12 border rounded-md bg-muted/20">
                        <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">No notifications</h3>
                        <p className="text-muted-foreground">You're all caught up!</p>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <Card key={notification.id} className={notification.status === 'unread' ? "border-l-4 border-l-orange-500" : ""}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            {notification.title}
                                            {notification.status === 'unread' && (
                                                <Badge variant="secondary" className="text-xs">New</Badge>
                                            )}
                                        </CardTitle>
                                        <CardDescription>
                                            {format(new Date(notification.created_at), 'PPP p')}
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline" className="uppercase text-xs">
                                        {notification.type}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm">{notification.message}</p>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-2 pt-0">
                                {notification.status === 'unread' && (
                                    <Button variant="ghost" size="sm" onClick={() => handleMarkAsRead(notification.id)}>
                                        <Check className="h-4 w-4 mr-1" /> Mark as Read
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(notification.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
