"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Clock, Activity, Mail, User, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";

// Services
import { getUser, UserWithDepartment } from "@/lib/services/users-service";
import { supabase } from "@/lib/supabase";

export default function StudentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [student, setStudent] = useState<UserWithDepartment | null>(null);
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDetails = async () => {
        if (!params.id) return;
        setLoading(true);
        const sId = params.id as string;

        const [sData, eData] = await Promise.all([
            getUser(sId),
            supabase
                .from('enrollments')
                .select(`
                    id,
                    enrolled_at,
                    course:courses(id, code, name, credit_hours)
                `)
                .eq('student_id', sId)
        ]);

        if (!sData || sData.role !== 'student') {
            toast.error("Student not found");
            router.push("/admin/users");
            return;
        }

        setStudent(sData);
        setEnrollments(eData.data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchDetails();
    }, [params.id, router]);

    const courseColumns: ColumnDef<any>[] = [
        {
            accessorKey: "course.code",
            header: "Code",
            cell: ({ row }) => row.original.course?.code
        },
        {
            accessorKey: "course.name",
            header: "Course Name",
            cell: ({ row }) => row.original.course?.name
        },
        {
            accessorKey: "course.credit_hours",
            header: "Credits",
            cell: ({ row }) => row.original.course?.credit_hours
        },
        {
            accessorKey: "enrolled_at",
            header: "Enrolled Date",
            cell: ({ row }) => new Date(row.original.enrolled_at).toLocaleDateString()
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <Button variant="ghost" size="sm" className="text-[#FF8020] cursor-pointer" onClick={() => router.push(`/admin/courses/${row.original.course?.id}`)}>
                    View Course
                </Button>
            )
        }
    ];

    if (loading) return <div className="p-8">Loading student details...</div>;
    if (!student) return <div className="p-8 text-red-500 text-center">Student not found</div>;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="cursor-pointer pl-0 hover:pl-2 transition-all"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to User Management
                </Button>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight">{student.full_name}</h1>
                            <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                                {student.status}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-muted-foreground">
                            <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {student.email}</span>
                            <span className="flex items-center gap-1"><GraduationCap className="h-4 w-4" /> Student</span>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Courses Enrolled</CardTitle>
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{enrollments.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Department</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold truncate">{student.department?.name || "N/A"}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-[#FF8020]">--%</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Status</CardTitle>
                            <User className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold capitalize">{student.status}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Enrolled Courses</h2>
                    <DataTable columns={courseColumns} data={enrollments} searchKey="course_name" filename={`${student.full_name}_enrollments`} />
                </div>
            </div>
        </PageWrapper>
    );
}
