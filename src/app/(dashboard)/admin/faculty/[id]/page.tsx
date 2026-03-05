"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Mail, Phone, MapPin, Building, GraduationCap, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Separator } from "@/components/ui/separator";

// Services
import { getUser, UserWithDepartment } from "@/lib/services/users-service";
import { getFacultyStats, getInstructorAttendanceHistory, FacultyAttendance } from "@/lib/services/faculty-attendance-service";
import { getCourses, CourseWithDetails } from "@/lib/services/courses-service";

export default function FacultyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [faculty, setFaculty] = useState<UserWithDepartment | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [attendanceHistory, setAttendanceHistory] = useState<FacultyAttendance[]>([]);
    const [courses, setCourses] = useState<CourseWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!params.id) return;
            setLoading(true);
            const fId = params.id as string;

            try {
                const [userData, statsData, allCourses, attendanceData] = await Promise.all([
                    getUser(fId),
                    getFacultyStats(fId),
                    getCourses(),
                    getInstructorAttendanceHistory(fId, 50)
                ]);

                if (!userData) {
                    toast.error("Faculty member not found");
                    router.back();
                    return;
                }

                setFaculty(userData);
                setStats(statsData);
                setCourses(allCourses.filter(c => c.instructor_id === fId));
                setAttendanceHistory(attendanceData);

            } catch (error) {
                console.error("Error fetching details:", error);
                toast.error("Failed to load faculty details");
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [params.id, router]);

    const courseColumns: ColumnDef<CourseWithDetails>[] = [
        { accessorKey: "code", header: "Code" },
        { accessorKey: "name", header: "Course Name" },
        {
            accessorKey: "section", header: "Section", cell: ({ row }) => {
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
        { accessorKey: "students_count", header: "Students" },
        { accessorKey: "discipline.name", header: "Discipline" },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <Button variant="ghost" size="sm" className="text-[#FF8020] cursor-pointer" onClick={() => router.push(`/admin/courses/${row.original.id}`)}>
                    View
                </Button>
            )
        }
    ];

    const attendanceColumns: ColumnDef<FacultyAttendance>[] = [
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => new Date(row.original.date).toLocaleDateString()
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.original.status === 'present' ? 'default' : row.original.status === 'absent' ? 'destructive' : 'secondary'}>
                    <span className="capitalize">{row.original.status}</span>
                </Badge>
            )
        },
        { accessorKey: "on_campus", header: "Time In" },
        { accessorKey: "left_campus", header: "Time Out" },
    ];

    if (loading) return <div>Loading...</div>;
    if (!faculty) return <div>Not found</div>;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="cursor-pointer pl-0 hover:pl-2 transition-all"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Faculty List
                </Button>

                {/* Profile Header */}
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="h-24 w-24 rounded-full bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-500">
                        {faculty.full_name?.charAt(0) || "U"}
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">{faculty.full_name}</h1>
                                {/* @ts-ignore */}
                                <p className="text-muted-foreground">{faculty.designation || "Instructor"} • {faculty.department?.name}</p>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="outline" className="text-sm py-1 px-3">
                                    ID: {faculty.id.slice(0, 8)}
                                </Badge>
                                <Badge className="bg-[#FF8020] text-sm py-1 px-3">
                                    {/* @ts-ignore */}
                                    {stats?.percentage || 0}% Attendance
                                </Badge>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4">
                            <div className="flex items-center gap-1">
                                <Mail className="h-4 w-4" /> {faculty.email}
                            </div>
                            {faculty.phone && (
                                <div className="flex items-center gap-1">
                                    <Phone className="h-4 w-4" /> {faculty.phone}
                                </div>
                            )}
                            {/* @ts-ignore */}
                            {faculty.office_location && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" /> {faculty.office_location}
                                </div>
                            )}
                            {faculty.department && (
                                <div className="flex items-center gap-1">
                                    <Building className="h-4 w-4" /> {faculty.department.name}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <Separator />

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Stats Cards */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Attendance Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col items-center justify-center p-4 border border-black rounded-lg">
                                <span className="text-2xl font-bold text-green-600">
                                    {/* @ts-ignore */}
                                    {attendanceHistory.filter(a => a.status === 'present').length}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium">Presents</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4 border border-black rounded-lg">
                                <span className="text-2xl font-bold text-red-600">
                                    {/* @ts-ignore */}
                                    {stats?.absents || 0}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium">Absents</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4 border border-black rounded-lg">
                                <span className="text-2xl font-bold text-black">
                                    {/* @ts-ignore */}
                                    {stats?.lates || 0}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium">Lates</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4 border border-black rounded-lg">
                                <span className="text-2xl font-bold text-black">
                                    {/* @ts-ignore */}
                                    {stats?.shortLeaves || 0}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium">Short Leaves</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Workload</CardTitle>
                            <CardDescription>Current Semester</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Courses Taught</span>
                                </div>
                                <span className="font-bold">{courses.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Total Students</span>
                                </div>
                                <span className="font-bold">{courses.reduce((acc, c) => acc + (c.students_count || 0), 0)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Credit Hours</span>
                                </div>
                                <span className="font-bold">{courses.reduce((acc, c) => acc + (c.credit_hours || 0), 0)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Courses Table */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold tracking-tight">Courses Taught</h2>
                    <DataTable columns={courseColumns} data={courses} searchKey="name" filename="faculty_courses" />
                </div>

                {/* Attendance History Table */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold tracking-tight">Attendance History</h2>
                    <DataTable columns={attendanceColumns} data={attendanceHistory} searchKey="date" filename="faculty_attendance_history" />
                </div>
            </div>
        </PageWrapper>
    );
}

// Icon helper
function BookOpen(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    )
}
