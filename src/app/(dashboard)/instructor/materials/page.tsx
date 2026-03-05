"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Trash2, Loader2, Download, HardDrive, Edit } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// Services
import { getUserByEmail } from "@/lib/services/users-service";
import {
    getInstructorResources,
    uploadFile,
    createResource,
    updateResource,
    deleteResource,
    deleteFile,
    getFileUrl,
    downloadResourceFile,
    ResourceWithDetails,
    formatFileSize
} from "@/lib/services/resources-service";
import { getCoursesByInstructor, CourseWithDetails } from "@/lib/services/courses-service";
import { format } from "date-fns";

export default function InstructorMaterialsPage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [resources, setResources] = useState<ResourceWithDetails[]>([]);
    const [courses, setCourses] = useState<CourseWithDetails[]>([]);
    const [userData, setUserData] = useState<any>(null);

    // Form State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingFilePath, setEditingFilePath] = useState<string | null>(null);

    // Form Inputs
    const [name, setName] = useState("");
    const [courseId, setCourseId] = useState("");
    const [description, setDescription] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const fetchData = async () => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

        try {
            const userDetails = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (userDetails && userDetails.role === 'instructor') {
                setUserData(userDetails);

                // Fetch Courses related to instructor
                const myCourses = await getCoursesByInstructor(userDetails.id);
                setCourses(myCourses);

                // Fetch Resources using the new inclusive query
                const myResources = await getInstructorResources(userDetails.id);
                setResources(myResources);
            }
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Failed to load materials");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isLoaded, user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const resetForm = () => {
        setIsDialogOpen(false);
        setIsEditing(false);
        setEditingId(null);
        setEditingFilePath(null);
        setName("");
        setCourseId("");
        setDescription("");
        setSelectedFile(null);
    };

    const handleEditClick = (resource: ResourceWithDetails) => {
        setIsEditing(true);
        setEditingId(resource.id);
        setEditingFilePath(resource.file_path);
        setName(resource.name);
        setCourseId(resource.course_id || "");
        setDescription(resource.description || "");
        setSelectedFile(null);
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!name || !courseId || (!isEditing && !selectedFile)) {
            toast.error("Please fill in all required fields (Name, Course, and File)");
            return;
        }

        try {
            setSubmitting(true);

            let filePath = editingFilePath;
            let fileType = undefined;
            let fileSize = undefined;

            if (selectedFile) {
                const folder = courseId ? `course-${courseId}` : "general";
                const newFilePath = await uploadFile(selectedFile, 'course-materials', folder);
                if (!newFilePath) throw new Error("File upload failed");

                if (isEditing && editingFilePath) {
                    await deleteFile(editingFilePath, "course-materials").catch(e => console.error(e));
                }

                filePath = newFilePath;
                fileType = selectedFile.type;
                fileSize = selectedFile.size;
            }

            if (isEditing && editingId) {
                await updateResource(editingId, {
                    name,
                    ...(filePath !== editingFilePath && { file_path: filePath as string }),
                    ...(fileType && { file_type: fileType }),
                    ...(fileSize !== undefined && { file_size: fileSize }),
                    course_id: courseId || undefined,
                    description: description || undefined
                });
                toast.success("Resource updated successfully");
            } else {
                await createResource({
                    name,
                    file_path: filePath as string,
                    file_type: fileType,
                    file_size: fileSize,
                    course_id: courseId || undefined,
                    uploaded_by: userData.id,
                    description: description || undefined
                });
                toast.success("Resource uploaded successfully");
            }

            resetForm();

            // Refresh list
            const refresh = await getInstructorResources(userData.id);
            setResources(refresh);

        } catch (error) {
            console.error(error);
            // Error toast handled by service mostly, but fallback:
            if ((error as Error).message === "File upload failed") return;
            toast.error("Failed to save resource");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure? This will delete the file permanently.")) {
            await deleteResource(id);
            // Refresh
            const refresh = resources.filter(r => r.id !== id);
            setResources(refresh);
        }
    };

    const handleDownload = async (resource: ResourceWithDetails) => {
        try {
            // Get the original file name or use the resource name
            let fileName = resource.name;

            // Try to append correct extension if missing
            const extension = resource.file_path.split('.').pop();
            if (extension && !fileName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
                fileName = `${fileName}.${extension}`;
            }

            toast.info(`Starting download: ${fileName}`);
            await downloadResourceFile(resource.file_path, fileName, 'course-materials');
        } catch (error) {
            console.error("Error downloading file:", error);
            // toast.error is already handled in service but as fallback:
            // toast.error("Failed to download file");
        }
    };

    const columns: ColumnDef<ResourceWithDetails>[] = [
        {
            accessorKey: "name",
            header: "Resource Name",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-orange-500" />
                        {row.original.name}
                    </span>
                    {row.original.description && (
                        <span className="text-xs text-muted-foreground ml-6 truncate max-w-[200px]">{row.original.description}</span>
                    )}
                </div>
            )
        },
        {
            accessorKey: "course",
            header: "Course",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.course?.code}</span>
                    <span className="text-xs text-muted-foreground">{row.original.course?.name}</span>
                </div>
            )
        },
        {
            accessorKey: "file_size",
            header: "Size",
            cell: ({ row }) => formatFileSize(row.original.file_size || 0)
        },
        {
            accessorKey: "created_at",
            header: "Uploaded",
            cell: ({ row }) => format(new Date(row.original.created_at), "MMM d, yyyy")
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const isOwner = userData?.id && row.original.uploaded_by === userData.id;

                return (
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            title="Download"
                            onClick={() => handleDownload(row.original)}
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                        {isOwner && (
                            <>
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
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                    title="Delete"
                                    onClick={() => handleDelete(row.original.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                );
            }
        }
    ];

    if (loading) return <div className="p-8">Loading resources...</div>;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Course Materials</h1>
                        <p className="text-muted-foreground">Upload and manage learning resources.</p>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white">
                                <Upload className="mr-2 h-4 w-4" /> Upload Resource
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>{isEditing ? "Edit Resource" : "Upload New Resource"}</DialogTitle>
                                <DialogDescription>
                                    Share files with your students.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="name">Resource Name</Label>
                                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lecture 1 Slides" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="course">Course *</Label>
                                    <Select value={courseId} onValueChange={setCourseId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Course" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {courses.map(course => (
                                                <SelectItem key={course.id} value={course.id}>
                                                    {course.code} - {course.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="file">File {isEditing ? "(Optional, upload new to replace)" : "*"}</Label>
                                    <Input id="file" type="file" onChange={handleFileChange} />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="desc">Description</Label>
                                    <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={resetForm} className="cursor-pointer">
                                    Cancel
                                </Button>
                                <Button onClick={handleSubmit} disabled={submitting || !name} className="cursor-pointer bg-[#FF8020] hover:bg-[#FF8020]/90 text-white">
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    {isEditing ? "Save Changes" : "Upload"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <DataTable columns={columns} data={resources} searchKey="name" filename="course_materials" />
            </div>
        </PageWrapper>
    );
}
