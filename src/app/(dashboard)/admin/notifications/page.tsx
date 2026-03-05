"use client";

import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "sonner";

// Services
import {
    getNotifications,
    createNotification,
    updateNotification,
    deleteNotification,
    NotificationWithCreator,
    UpdateNotificationInput
} from "@/lib/services/notifications-service";
import { ExpandableText } from "@/components/shared/expandable-text";
import { Edit, Loader2 } from "lucide-react";

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<NotificationWithCreator[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingNotification, setEditingNotification] = useState<NotificationWithCreator | null>(null);
    const [formData, setFormData] = useState<any>({
        title: "",
        message: "",
        type: "system",
        target_role: null
    });

    const fetchNotifications = async () => {
        setLoading(true);
        const data = await getNotifications();
        setNotifications(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleSave = async () => {
        if (!formData.title || !formData.message) {
            toast.error("Please fill all fields");
            return;
        }
        setIsSubmitting(true);

        // Prepare the payload correctly based on values
        const updatePayload: any = {
            title: formData.title,
            message: formData.message,
            type: formData.type || 'system',
            target_role: formData.target_role === "all" ? null : formData.target_role
        };

        console.log('Updating payload:', updatePayload);

        if (editingNotification) {
            const result = await updateNotification(editingNotification.id, updatePayload);
            if (result) {
                setDialogOpen(false);
                setFormData({ title: "", message: "", type: "system", target_role: null });
                setEditingNotification(null);
                fetchNotifications();
                toast.success("Notification updated successfully");
            } else {
                toast.error("Update returned null, check console for details");
            }
        } else {
            const result = await createNotification(updatePayload);
            if (result) {
                setDialogOpen(false);
                setFormData({ title: "", message: "", type: "system", target_role: null });
                fetchNotifications();
            }
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this notification?")) {
            await deleteNotification(id);
            await fetchNotifications();
        }
    };

    const columns: ColumnDef<NotificationWithCreator>[] = [
        { accessorKey: "title", header: "Title" },
        {
            accessorKey: "message",
            header: "Message",
            cell: ({ row }) => <ExpandableText text={row.original.message} limit={40} />
        },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.getValue("type")}</Badge>
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                return <Badge variant={status === "unread" ? "default" : "secondary"} className="capitalize">{status}</Badge>;
            }
        },
        {
            accessorKey: "created_at",
            header: "Date",
            cell: ({ row }) => new Date(row.getValue("created_at")).toLocaleDateString()
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-black hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                            setEditingNotification(row.original);
                            setFormData({
                                title: row.original.title,
                                message: row.original.message,
                                type: row.original.type,
                                target_role: row.original.target_role
                            });
                            setDialogOpen(true);
                        }}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 cursor-pointer"
                        onClick={() => handleDelete(row.original.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <PageWrapper>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Notification Center</h1>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer"
                                onClick={() => {
                                    setEditingNotification(null);
                                    setFormData({ title: "", message: "", type: "system", target_role: null });
                                }}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Create Notification
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px]">
                            <DialogHeader>
                                <DialogTitle>{editingNotification ? "Edit Notification" : "Create New Notification"}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-5 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="title">Title *</Label>
                                    <Input
                                        id="title"
                                        placeholder="Notification title"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="message">Message *</Label>
                                    <Textarea
                                        id="message"
                                        placeholder="Notification message"
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        rows={4}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="type">Type *</Label>
                                        <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="system">System</SelectItem>
                                                <SelectItem value="academic">Academic</SelectItem>
                                                <SelectItem value="alert">Alert</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="target_role">Target Role</Label>
                                        <Select value={formData.target_role || "all"} onValueChange={(value: any) => setFormData({ ...formData, target_role: value === "all" ? null : value })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Roles</SelectItem>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="instructor">Instructor</SelectItem>
                                                <SelectItem value="student">Student</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setDialogOpen(false);
                                        setFormData({ title: "", message: "", type: "system", target_role: null });
                                    }}
                                    className="cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {editingNotification ? "Update" : "Create"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <DataTable columns={columns} data={notifications} searchKey="title" filename="notifications" isLoading={loading} />
            </div>
        </PageWrapper>
    );
}
