"use client";

import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { UploadCloud, Download, Trash2, FileText, Edit, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { getUserByEmail } from "@/lib/services/users-service";

// Services
import {
    getResources,
    uploadFile,
    createResource,
    updateResource,
    deleteResource,
    deleteFile,
    getStorageUsage,
    formatFileSize,
    downloadResourceFile,
    ResourceWithDetails
} from "@/lib/services/resources-service";
import { getCourses } from "@/lib/services/courses-service";

export default function ResourcesPage() {
    const { user, isLoaded } = useUser();
    const [dbUser, setDbUser] = useState<any>(null);

    const [resources, setResources] = useState<ResourceWithDetails[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingFilePath, setEditingFilePath] = useState<string | null>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        course_id: "",
        visibility: "all",
        description: ""
    });
    const [storageInfo, setStorageInfo] = useState({ totalSize: 0, fileCount: 0 });

    const fetchData = async () => {
        const [resourcesData, coursesData, storage] = await Promise.all([
            getResources(),
            getCourses(),
            getStorageUsage()
        ]);
        setResources(resourcesData);
        setCourses(coursesData);
        setStorageInfo(storage);
    };

    useEffect(() => {
        fetchData();
        if (isLoaded && user?.primaryEmailAddress?.emailAddress) {
            getUserByEmail(user.primaryEmailAddress.emailAddress).then(res => setDbUser(res));
        }
    }, [isLoaded, user]);

    const handleSubmit = async () => {
        if (!formData.name) {
            toast.error("Please provide a name");
            return;
        }

        if (!isEditing && !selectedFile) {
            toast.error("Please select a file to upload");
            return;
        }

        try {
            setIsSubmitting(true);
            const effectiveCourseId = formData.course_id && formData.course_id !== "none" ? formData.course_id : "";
            const actualVisibility = effectiveCourseId ? "course" : formData.visibility;

            let filePath = editingFilePath;
            let fileType = undefined;
            let fileSize = undefined;

            if (selectedFile) {
                const folder = effectiveCourseId ? `course_${effectiveCourseId}` : "general";
                const newFilePath = await uploadFile(selectedFile, "course-materials", folder);

                if (!newFilePath) return;

                if (isEditing && editingFilePath) {
                    await deleteFile(editingFilePath, "course-materials").catch(e => console.error(e));
                }

                filePath = newFilePath;
                fileType = selectedFile.type || "application/octet-stream";
                fileSize = selectedFile.size;
            }

            if (isEditing && editingId) {
                await updateResource(editingId, {
                    name: formData.name,
                    ...(filePath !== editingFilePath && { file_path: filePath as string }),
                    ...(fileType && { file_type: fileType }),
                    ...(fileSize !== undefined && { file_size: fileSize }),
                    course_id: effectiveCourseId || undefined,
                    visibility: actualVisibility,
                    description: formData.description || undefined
                });
            } else {
                await createResource({
                    name: formData.name,
                    file_path: filePath as string,
                    file_type: fileType,
                    file_size: fileSize,
                    course_id: effectiveCourseId || undefined,
                    visibility: actualVisibility,
                    uploaded_by: dbUser?.id,
                    description: formData.description || undefined
                });
            }

            await fetchData();
            resetForm();
        } catch (error) {
            console.error("Submit error:", error);
            toast.error("Failed to save resource");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setDialogOpen(false);
        setIsEditing(false);
        setEditingId(null);
        setEditingFilePath(null);
        setFormData({ name: "", course_id: "", visibility: "all", description: "" });
        setSelectedFile(null);
    };

    const handleEditClick = (resource: ResourceWithDetails) => {
        setIsEditing(true);
        setEditingId(resource.id);
        setEditingFilePath(resource.file_path);
        setFormData({
            name: resource.name,
            course_id: resource.course_id || "none",
            visibility: resource.visibility || (resource.course_id ? "course" : "all"),
            description: resource.description || ""
        });
        setSelectedFile(null);
        setDialogOpen(true);
    };

    const handleDownload = async (resource: ResourceWithDetails) => {
        try {
            let fileName = resource.name;
            const extension = resource.file_path.split('.').pop();
            if (extension && !fileName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
                fileName = `${fileName}.${extension}`;
            }
            toast.info(`Starting download: ${fileName}`);
            await downloadResourceFile(resource.file_path, fileName, 'course-materials');
        } catch (error) {
            console.error("Error downloading file:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this resource?")) {
            await deleteResource(id);
            await fetchData();
        }
    };

    const columns: ColumnDef<ResourceWithDetails>[] = [
        {
            accessorKey: "name",
            header: "Name",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{row.getValue("name")}</span>
                </div>
            )
        },
        {
            accessorKey: "file_type",
            header: "Type",
            cell: ({ row }) => {
                const type = row.getValue("file_type") as string || "Unknown";
                const ext = type.split("/")[1] || type;
                return <Badge variant="outline" className="uppercase">{ext}</Badge>;
            }
        },
        {
            accessorKey: "file_size",
            header: "Size",
            cell: ({ row }) => formatFileSize(row.getValue("file_size") as number || 0)
        },
        {
            accessorKey: "course",
            header: "Course / Audience",
            cell: ({ row }) => row.original.course?.name ? row.original.course.code : (row.original.visibility === "admins" ? "Admins Only" : "All Users")
        },
        {
            accessorKey: "uploader",
            header: "Uploaded By",
            cell: ({ row }) => row.original.uploader?.full_name || "System"
        },
        {
            accessorKey: "created_at",
            header: "Uploaded",
            cell: ({ row }) => new Date(row.getValue("created_at")).toLocaleDateString()
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="cursor-pointer"
                        title="Download"
                        onClick={() => handleDownload(row.original)}
                    >
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-black hover:bg-gray-100 cursor-pointer"
                        title="Edit"
                        onClick={() => handleEditClick(row.original)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 cursor-pointer"
                        title="Delete"
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
                    <h1 className="text-3xl font-bold tracking-tight">Resource Management</h1>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer">
                                <UploadCloud className="mr-2 h-4 w-4" /> Upload Resource
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px]">
                            <DialogHeader>
                                <DialogTitle>{isEditing ? "Edit Resource" : "Upload New Resource"}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-5 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="file">File {isEditing ? "(Optional, upload new to replace)" : "*"}</Label>
                                    <Input
                                        id="file"
                                        type="file"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            setSelectedFile(file || null);
                                            if (file && !formData.name && !isEditing) {
                                                setFormData({ ...formData, name: file.name });
                                            }
                                        }}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Resource Name *</Label>
                                    <Input
                                        id="name"
                                        placeholder="Lecture 1 Slides.pdf"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="course">Course</Label>
                                    <Select value={formData.course_id || "none"} onValueChange={(value) => setFormData({ ...formData, course_id: value })} className="bg-white">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select course" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">General / No Course</SelectItem>
                                            {courses.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(!formData.course_id || formData.course_id === "none") && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="visibility">Visibility / Audience</Label>
                                        <Select value={formData.visibility} onValueChange={(value) => setFormData({ ...formData, visibility: value })} className="bg-white">
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select visibility" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">General: All Users</SelectItem>
                                                <SelectItem value="admins">General: Admins Only</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="grid gap-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Brief description of the resource"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={resetForm}
                                    className="cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer"
                                    disabled={!formData.name || isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {isEditing ? "Save Changes" : "Upload"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Storage Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{storageInfo.fileCount}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatFileSize(storageInfo.totalSize)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Storage Provider</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-semibold">Supabase Storage</div>
                        </CardContent>
                    </Card>
                </div>

                <DataTable columns={columns} data={resources} searchKey="name" filename="resources_list" />
            </div>
        </PageWrapper>
    );
}
