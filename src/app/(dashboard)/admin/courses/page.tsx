"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, FileSpreadsheet, Edit, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import * as XLSX from "xlsx";

// Services
import {
    getCourses,
    createCourse,
    updateCourse,
    deleteCourse,
    CourseWithDetails,
    CreateCourseInput
} from "@/lib/services/courses-service";
import { getDisciplines, DisciplineWithDetails } from "@/lib/services/disciplines-service";
import { getInstructors } from "@/lib/services/users-service";

export default function AdminCoursesPage() {
    const [courses, setCourses] = useState<CourseWithDetails[]>([]);
    const [disciplines, setDisciplines] = useState<any[]>([]);
    const [instructors, setInstructors] = useState<any[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState<CourseWithDetails | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<CreateCourseInput>({
        code: "",
        name: "",
        discipline_id: "",
        instructor_id: "",
        semester: 1,
        credit_hours: 3,
        section: "",
        active_days: []
    });

    const fetchData = async () => {
        try {
            const [coursesData, disciplinesData, instrs] = await Promise.all([
                getCourses(),
                getDisciplines(),
                getInstructors()
            ]);
            setCourses(coursesData);
            setDisciplines(disciplinesData);
            setInstructors(instrs);
        } catch (error) {
            console.error("Error fetching courses data:", error);
            toast.error("Failed to load data");
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async () => {
        if (!formData.code || !formData.name || !formData.discipline_id) {
            toast.error("Please fill in all required fields (Code, Name, Discipline)");
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingCourse) {
                const res = await updateCourse(editingCourse.id, formData);
                if (res) toast.success("Course updated successfully");
            } else {
                const res = await createCourse(formData);
                if (res) toast.success("Course created successfully");
            }

            await fetchData();
            setFormData({ code: "", name: "", discipline_id: "", instructor_id: "", semester: 1, credit_hours: 3, section: "", active_days: [] });
            setEditingCourse(null);
            setDialogOpen(false);
        } catch (error) {
            console.error("Error submitting course:", error);
            toast.error("Failed to save course");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this course?")) {
            await deleteCourse(id);
            await fetchData();
        }
    };

    const handleGenerateReport = async (course: CourseWithDetails) => {
        try {
            const { generateCourseReport } = await import("@/lib/services/reports-service");
            await generateCourseReport(course.id, course.name);
        } catch (error) {
            console.error("Error generating report:", error);
            toast.error("Failed to generate report");
        }
    };

    const handleEdit = (course: CourseWithDetails) => {
        setEditingCourse(course);
        setFormData({
            code: course.code,
            name: course.name,
            discipline_id: course.discipline_id,
            instructor_id: course.instructor_id || "",
            semester: course.semester,
            credit_hours: course.credit_hours,
            section: course.section || "",
            active_days: course.active_days || []
        });
        setDialogOpen(true);
    };

    const columns: ColumnDef<CourseWithDetails>[] = [
        { accessorKey: "code", header: "Code" },
        { accessorKey: "name", header: "Name" },
        {
            accessorKey: "instructor",
            header: "Faculty",
            cell: ({ row }) => row.original.instructor?.full_name || "Unassigned"
        },
        {
            accessorKey: "discipline",
            header: "Discipline",
            cell: ({ row }) => row.original.discipline?.name || "N/A"
        },
        {
            accessorKey: "students_count",
            header: "Students"
        },
        {
            accessorKey: "section",
            header: "Section",
            cell: ({ row }) => {
                const code = row.original.code;
                const count = row.original.students_count || 0;
                const sectionCount = Math.max(1, Math.ceil(count / 100));
                const letters = [];
                for (let i = 0; i < sectionCount; i++) {
                    letters.push(code + String.fromCharCode(65 + i));
                }
                return letters.join(', ');
            }
        },
        {
            accessorKey: "active_days",
            header: "Active Days",
            cell: ({ row }) => {
                const days = row.original.active_days;
                return Array.isArray(days) ? days.join(", ") : (typeof days === 'string' ? days : "-");
            }
        },
        {
            accessorKey: "credit_hours",
            header: "Credit Hours"
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => <Badge variant={row.getValue("status") === "active" ? "default" : "secondary"}>{row.getValue("status") || "active"}</Badge>
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Link href={`/admin/courses/${row.original.id}`}>
                        <Button variant="ghost" size="sm" className="text-[#FF8020] cursor-pointer">
                            View Details
                        </Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="text-[#FF8020] cursor-pointer gap-1" onClick={() => handleGenerateReport(row.original)}>
                        <FileSpreadsheet className="h-4 w-4" />
                        Generate Report
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={() => handleDelete(row.original.id)}>Delete Course</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-black hover:bg-gray-100 cursor-pointer"
                        title="Edit Course"
                        onClick={() => handleEdit(row.original)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <PageWrapper>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer"
                                onClick={() => {
                                    setEditingCourse(null);
                                    setFormData({ code: "", name: "", discipline_id: "", instructor_id: "", semester: 1, credit_hours: 3, section: "", active_days: [] });
                                }}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add Course
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px]">
                            <DialogHeader>
                                <DialogTitle>{editingCourse ? "Edit Course" : "Add New Course"}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-5 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="code">Course Code *</Label>
                                        <Input
                                            id="code"
                                            placeholder="e.g., CS101"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="credit_hours">Credit Hours *</Label>
                                        <Input
                                            id="credit_hours"
                                            type="number"
                                            value={formData.credit_hours}
                                            onChange={(e) => setFormData({ ...formData, credit_hours: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="section">Section</Label>
                                        <Input
                                            id="section"
                                            placeholder="e.g., A, B, Morning"
                                            value={formData.section}
                                            onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Course Name *</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Introduction to Computing"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="discipline">Discipline *</Label>
                                        <Select value={formData.discipline_id} onValueChange={(value) => setFormData({ ...formData, discipline_id: value })}>
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
                                        <Label htmlFor="semester">Semester *</Label>
                                        <Input
                                            id="semester"
                                            type="number"
                                            value={formData.semester}
                                            onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="instructor">Instructor</Label>
                                        <Select value={formData.instructor_id || ""} onValueChange={(value) => setFormData({ ...formData, instructor_id: value })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select instructor (optional)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {instructors.map(i => (
                                                    <SelectItem key={i.id} value={i.id}>{i.full_name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Active Days *</Label>
                                        <div className="flex flex-wrap gap-3 mt-1">
                                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                                                <div key={day} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`day-${day}`}
                                                        checked={formData.active_days?.includes(day)}
                                                        onChange={(e) => {
                                                            const current = formData.active_days || [];
                                                            if (e.target.checked) {
                                                                setFormData({ ...formData, active_days: [...current, day] });
                                                            } else {
                                                                setFormData({ ...formData, active_days: current.filter(d => d !== day) });
                                                            }
                                                        }}
                                                        className="h-4 w-4 rounded border-gray-300 text-[#FF8020] focus:ring-[#FF8020]"
                                                    />
                                                    <Label htmlFor={`day-${day}`} className="text-sm font-normal cursor-pointer">{day}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setDialogOpen(false);
                                        setFormData({ code: "", name: "", discipline_id: "", instructor_id: "", semester: 1, credit_hours: 3, section: "", active_days: [] });
                                        setEditingCourse(null);
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
                                    {editingCourse ? "Update" : "Create"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div >
                <DataTable columns={columns} data={courses} searchKey="name" filename="courses_list" />
            </div >
        </PageWrapper >
    );
}
