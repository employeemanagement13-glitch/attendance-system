"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Upload, Download, Plus, MoreHorizontal, Loader2, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// Services
import {
    getStudents,
    getInstructors,
    createUser,
    updateUser,
    deleteUser,
    UserWithDepartment,
    CreateUserInput
} from "@/lib/services/users-service";
import { getDepartments } from "@/lib/services/departments-service";
import { getDisciplines } from "@/lib/services/disciplines-service";

export default function UserManagementPage() {
    const [instructors, setInstructors] = useState<UserWithDepartment[]>([]);
    const [students, setStudents] = useState<UserWithDepartment[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [disciplines, setDisciplines] = useState<any[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingUser, setEditingUser] = useState<UserWithDepartment | null>(null);
    const [currentTab, setCurrentTab] = useState<"students" | "instructors">("students");
    const [formData, setFormData] = useState<CreateUserInput>({
        email: "",
        full_name: "",
        role: "student",
        department_id: "",
        discipline_id: "",
        current_semester: 1,
        phone: ""
    });

    const fetchData = async () => {
        const [studentsData, instructorsData, depts, disps] = await Promise.all([
            getStudents(),
            getInstructors(),
            getDepartments(),
            getDisciplines()
        ]);
        setStudents(studentsData);
        setInstructors(instructorsData);
        setDepartments(depts);
        setDisciplines(disps);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async () => {
        if (!formData.email || !formData.full_name || !formData.role) {
            toast.error("Please fill in all required fields");
            return;
        }

        if ((formData.role === 'student' || formData.role === 'instructor') && !formData.discipline_id) {
            toast.error("Discipline is required for students and instructors");
            return;
        }

        setIsSubmitting(true);
        try {
            let success = false;
            if (editingUser) {
                const { email, ...updateData } = formData;
                const result = await updateUser(editingUser.id, updateData);
                success = !!result;
                if (success) toast.success("User updated successfully");
            } else {
                const result = await createUser(formData);
                success = !!result;
                if (success) toast.success("User created successfully");
            }

            if (success) {
                await fetchData();
                setFormData({
                    email: "",
                    full_name: "",
                    role: currentTab === "students" ? "student" : "instructor",
                    department_id: "",
                    discipline_id: "",
                    current_semester: 1,
                    phone: ""
                });
                setEditingUser(null);
                setDialogOpen(false);
            }
        } catch (error) {
            console.error("Error submitting user:", error);
            toast.error("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (user: UserWithDepartment) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            full_name: user.full_name || "",
            role: user.role,
            department_id: user.department_id || "",
            discipline_id: user.discipline_id || "",
            current_semester: user.current_semester || 1,
            phone: user.phone || ""
        });
        setDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this user?")) {
            try {
                await deleteUser(id);
                toast.success("User deleted successfully");
                await fetchData();
            } catch (error) {
                toast.error("Failed to delete user");
            }
        }
    };

    const importData = async (file: File, type: "instructor" | "student") => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const wb = XLSX.read(e.target?.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                let successCount = 0;
                for (const row of data) {
                    try {
                        await createUser({
                            email: row.Email || row.email,
                            full_name: row.Name || row.name || row.FullName || row.full_name,
                            role: type,
                            department_id: row.DepartmentId || row.department_id || "",
                            current_semester: Number(row.Semester || row.semester) || 1,
                            phone: row.Phone || row.phone || ""
                        });
                        successCount++;
                    } catch (err) {
                        console.error("Error importing row:", err);
                    }
                }

                await fetchData();
                toast.success(`Successfully imported ${successCount} out of ${data.length} records`);
            } catch (error) {
                console.error("Error importing file:", error);
                toast.error("Failed to import file");
            }
        };
        reader.readAsBinaryString(file);
    };

    const exportData = () => {
        const data = currentTab === "students" ? students : instructors;
        const formatted = data.map(u => ({
            Email: u.email,
            Name: u.full_name,
            Department: u.department?.name || "N/A",
            Discipline: u.discipline?.name || "N/A",
            Semester: u.current_semester || "",
            Phone: u.phone || "",
            Status: u.status
        }));

        const ws = XLSX.utils.json_to_sheet(formatted);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, currentTab);
        XLSX.writeFile(wb, `${currentTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success("Data exported successfully");
    };

    const instructorColumns: ColumnDef<UserWithDepartment>[] = [
        { accessorKey: "full_name", header: "Name" },
        { accessorKey: "email", header: "Email" },
        {
            accessorKey: "department",
            header: "Department",
            cell: ({ row }) => row.original.department?.name || ""
        },
        {
            accessorKey: "discipline",
            header: "Discipline",
            cell: ({ row }) => row.original.discipline?.name || ""
        },
        { accessorKey: "phone", header: "Phone" },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                return <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>;
            }
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/faculty/${row.original.id}`} className="cursor-pointer w-full">
                                    View Profile
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-500 cursor-pointer" onClick={() => handleDelete(row.original.id)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-black hover:bg-gray-100 cursor-pointer"
                        title="Edit Details"
                        onClick={() => handleEdit(row.original)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ];

    const studentColumns: ColumnDef<UserWithDepartment>[] = [
        { accessorKey: "full_name", header: "Name" },
        { accessorKey: "email", header: "Email" },
        {
            accessorKey: "department",
            header: "Department",
            cell: ({ row }) => row.original.department?.name || ""
        },
        {
            accessorKey: "discipline",
            header: "Discipline",
            cell: ({ row }) => row.original.discipline?.name || ""
        },
        {
            accessorKey: "current_semester",
            header: "Semester",
            cell: ({ row }) => (
                <Badge variant="outline" className="font-bold">
                    Sem {row.original.current_semester || "1"}
                </Badge>
            )
        },
        { accessorKey: "phone", header: "Phone" },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                return <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>;
            }
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/users/${row.original.id}`} className="cursor-pointer w-full">
                                    View Profile
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-500 cursor-pointer" onClick={() => handleDelete(row.original.id)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-black hover:bg-gray-100 cursor-pointer"
                        title="Edit Details"
                        onClick={() => handleEdit(row.original)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <PageWrapper>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">User Management</h1>

                <Tabs defaultValue="students" className="w-full" onValueChange={(v) => setCurrentTab(v as any)}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                            <TabsTrigger value="students">Students</TabsTrigger>
                            <TabsTrigger value="instructors">Instructors</TabsTrigger>
                        </TabsList>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            importData(e.target.files[0], currentTab === "students" ? "student" : "instructor");
                                            e.target.value = ""; // Reset file input
                                        }
                                    }}
                                />
                                <Button className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer w-full sm:w-auto">
                                    <Upload className="mr-2 h-4 w-4" /> <span className="sm:inline">Bulk Import</span><span className="inline sm:hidden">Import</span>
                                </Button>
                            </div>
                            <Button onClick={exportData} variant="outline" className="cursor-pointer w-full sm:w-auto">
                                <Download className="mr-2 h-4 w-4" /> <span className="sm:inline">Export</span>
                            </Button>
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer w-full sm:w-auto"
                                        onClick={() => {
                                            setEditingUser(null);
                                            setFormData({
                                                email: "",
                                                full_name: "",
                                                role: currentTab === "students" ? "student" : "instructor",
                                                department_id: "",
                                                discipline_id: "",
                                                current_semester: 1,
                                                phone: ""
                                            });
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> <span className="sm:inline">Add New</span><span className="inline sm:hidden">Add</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>{editingUser ? "Edit User" : `Add New ${currentTab === "students" ? "Student" : "Instructor"}`}</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-5 py-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="full_name">Full Name *</Label>
                                            <Input
                                                id="full_name"
                                                placeholder="John Doe"
                                                value={formData.full_name}
                                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="email">Email *</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="john@university.edu"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                disabled={!!editingUser}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="department">Department</Label>
                                            <Select value={formData.department_id || ""} onValueChange={(value) => setFormData({ ...formData, department_id: value })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {departments.map(d => (
                                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="discipline">Discipline *</Label>
                                            <Select value={formData.discipline_id || ""} onValueChange={(value) => setFormData({ ...formData, discipline_id: value })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select discipline" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {disciplines.map(d => (
                                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="phone">Phone</Label>
                                            <Input
                                                id="phone"
                                                placeholder="+1-555-0100"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            />
                                        </div>
                                        {formData.role === "student" && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="current_semester">Current Semester</Label>
                                                <Input
                                                    id="current_semester"
                                                    type="number"
                                                    min="1"
                                                    max="8"
                                                    value={formData.current_semester || 1}
                                                    onChange={(e) => setFormData({ ...formData, current_semester: parseInt(e.target.value) || 1 })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setDialogOpen(false);
                                                setFormData({ email: "", full_name: "", role: "student", department_id: "", discipline_id: "", current_semester: 1, phone: "" });
                                                setEditingUser(null);
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
                                            {editingUser ? "Update" : "Create"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                    <TabsContent value="students" className="space-y-4">
                        <DataTable columns={studentColumns} data={students} searchKey="full_name" filename="students_list" />
                    </TabsContent>

                    <TabsContent value="instructors" className="space-y-4">
                        <DataTable columns={instructorColumns} data={instructors} searchKey="full_name" filename="instructors_list" />
                    </TabsContent>
                </Tabs>
            </div>
        </PageWrapper>
    );
}
