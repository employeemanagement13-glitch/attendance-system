"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Services
import {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    Department,
    CreateDepartmentInput
} from "@/lib/services/departments-service";

export default function DepartmentsPage() {
    const [data, setData] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<CreateDepartmentInput>({
        name: "",
        hod: "",
        description: ""
    });

    // Fetch departments
    const fetchDepartments = async () => {
        setLoading(true);
        const departments = await getDepartments();
        setData(departments);
        setLoading(false);
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    // Handle create/update
    const handleSubmit = async () => {
        if (!formData.name || !formData.hod) {
            toast.error("Department Name and HOD are required");
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingDept) {
                await updateDepartment(editingDept.id, formData);
                toast.success("Department updated successfully");
            } else {
                await createDepartment(formData);
                toast.success("Department created successfully");
            }

            // Refresh data
            await fetchDepartments();

            // Reset form
            setFormData({ name: "", hod: "", description: "" });
            setEditingDept(null);
            setDialogOpen(false);
        } catch (error) {
            toast.error("An error occurred while saving the department");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle delete
    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this department?")) {
            try {
                const success = await deleteDepartment(id);
                if (success) {
                    toast.success("Department deleted successfully");
                    await fetchDepartments();
                }
            } catch (error) {
                toast.error("Failed to delete department. It may have associated records.");
            }
        }
    };

    // Handle edit
    const handleEdit = (dept: Department) => {
        setEditingDept(dept);
        setFormData({
            name: dept.name,
            hod: dept.hod,
            description: dept.description || ""
        });
        setDialogOpen(true);
    };

    const columns: ColumnDef<Department>[] = [
        { accessorKey: "name", header: "Name" },
        { accessorKey: "hod", header: "HOD" },
        {
            accessorKey: "student_count",
            header: "Students",
            cell: ({ row }) => <Badge variant="secondary">{row.original.student_count || 0}</Badge>
        },
        {
            accessorKey: "instructor_count",
            header: "Faculty",
            cell: ({ row }) => <Badge variant="outline">{row.original.instructor_count || 0}</Badge>
        },
        { accessorKey: "description", header: "Description" },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const dept = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(dept.id)} className="cursor-pointer">
                                    Copy ID
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/admin/departments/${dept.id}`} className="cursor-pointer w-full">
                                        View Details
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-red-500 cursor-pointer"
                                    onClick={() => handleDelete(dept.id)}
                                >
                                    Delete Department
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-black hover:bg-gray-100 cursor-pointer"
                            title="Edit"
                            onClick={() => handleEdit(dept)}
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <PageWrapper>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer"
                                onClick={() => {
                                    setEditingDept(null);
                                    setFormData({ name: "", hod: "", description: "" });
                                }}
                            >
                                Add Department
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>{editingDept ? "Edit Department" : "Add Department"}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="name">Department Name *</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Computer Science Department"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="hod">Head of Department *</Label>
                                    <Input
                                        id="hod"
                                        placeholder="e.g., Dr. John Smith"
                                        value={formData.hod}
                                        onChange={(e) => setFormData({ ...formData, hod: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Brief description of the department"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setDialogOpen(false);
                                        setFormData({ name: "", hod: "", description: "" });
                                        setEditingDept(null);
                                    }}
                                    className="cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {editingDept ? "Update" : "Create"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <DataTable columns={columns} data={data} searchKey="name" filename="departments" />
            </div>
        </PageWrapper>
    );
}
