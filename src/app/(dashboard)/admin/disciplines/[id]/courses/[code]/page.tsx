"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Services
import { getCourses, CourseWithDetails } from "@/lib/services/courses-service";
import { getFacultyStats } from "@/lib/services/faculty-attendance-service";
import { getInstructors } from "@/lib/services/users-service";

type FacultyInCourse = {
    id: string;
    name: string;
    on_campus: string; // Time In
    on_leave: string; // Time Out
    attendance_percentage: number;
    total_students: number; // In this course
    total_sections: number;
};

export default function CourseBreakdownPage() {
    const params = useParams();
    const router = useRouter();
    const [coursesData, setCoursesData] = useState<CourseWithDetails[]>([]);
    const [facultyList, setFacultyList] = useState<FacultyInCourse[]>([]);
    const [loading, setLoading] = useState(true);
    const [overloadedFaculty, setOverloadedFaculty] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!params.code) return;
            setLoading(true);
            const code = decodeURIComponent(params.code as string);
            const dId = params.id as string; // Discipline ID

            // Get all sections for this course code & discipline
            const allCourses = await getCourses();
            const sections = allCourses.filter(c => c.code === code && c.discipline_id === dId);

            if (sections.length === 0) {
                toast.error("Course not found");
                router.back();
                return;
            }

            setCoursesData(sections);

            // Group by Instructor
            const groupedByInstructor: Record<string, { sections: typeof sections, students: number }> = {};

            sections.forEach(sec => {
                if (sec.instructor_id) {
                    if (!groupedByInstructor[sec.instructor_id]) {
                        groupedByInstructor[sec.instructor_id] = { sections: [], students: 0 };
                    }
                    groupedByInstructor[sec.instructor_id].sections.push(sec);
                    groupedByInstructor[sec.instructor_id].students += sec.students_count || 0;
                }
            });

            const overloaded: string[] = [];

            // Fetch Instructor details & stats
            const facultyData: FacultyInCourse[] = await Promise.all(
                Object.keys(groupedByInstructor).map(async (instrId) => {
                    const group = groupedByInstructor[instrId];
                    // Fetch real instructor details if needed, or use what's in course objects
                    // We need to fetch stats specifically
                    const stats = await getFacultyStats(instrId);

                    // Check overload
                    if (group.students > 500) {
                        overloaded.push(group.sections[0].instructor?.full_name || "Unknown");
                    }

                    return {
                        id: instrId,
                        name: group.sections[0].instructor?.full_name || "Unknown",
                        // Mocking Times for now or fetching if available in stats
                        // Assuming getFacultyStats returns general stats, not specific daily times.
                        // For "Real-time status", we'd need a "getTodayStatus" call. 
                        // Using placeholders as per user request to simply show the columns.
                        on_campus: "08:00 AM",
                        on_leave: "-",
                        attendance_percentage: stats.percentage,
                        total_students: group.students,
                        total_sections: group.sections.length
                    };
                })
            );

            setFacultyList(facultyData);
            setOverloadedFaculty(overloaded);
            setLoading(false);
        };

        fetchData();
    }, [params.code, params.id, router]);

    const columns: ColumnDef<FacultyInCourse>[] = [
        { accessorKey: "name", header: "Faculty Name" },
        { accessorKey: "id", header: "ID", cell: ({ row }) => row.original.id.slice(0, 8) },
        { accessorKey: "on_campus", header: "Time In" },
        { accessorKey: "on_leave", header: "Time Out" },
        {
            accessorKey: "attendance_percentage",
            header: "Attendance %",
            cell: ({ row }) => <span className={row.original.attendance_percentage < 85 ? "text-red-500 font-bold" : ""}>{row.original.attendance_percentage}%</span>
        },
        {
            accessorKey: "total_students",
            header: "Total Students",
            cell: ({ row }) => (
                <Badge variant={row.original.total_students > 500 ? "destructive" : "secondary"}>
                    {row.original.total_students}
                </Badge>
            )
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <Link href={`/admin/disciplines/${params.id}/courses/${params.code}/faculty/${row.original.id}`}>
                    <Button variant="ghost" size="sm" className="cursor-pointer text-[#FF8020]">
                        View Sections
                    </Button>
                </Link>
            )
        }
    ];

    if (loading) return <div>Loading...</div>;

    const courseName = coursesData[0]?.name || params.code;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="cursor-pointer pl-0 hover:pl-2 transition-all"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Discipline
                </Button>

                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">{courseName} ({decodeURIComponent(params.code as string)})</h1>
                    <p className="text-muted-foreground">Faculty Breakdown</p>
                </div>

                {overloadedFaculty.length > 0 && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Capacity Warning</AlertTitle>
                        <AlertDescription>
                            The following faculty members have over 500 students in this course: {overloadedFaculty.join(", ")}.
                            Please consider adding more faculty.
                        </AlertDescription>
                    </Alert>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Faculty Teaching Course</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable columns={columns} data={facultyList} searchKey="name" filename={`${params.code}_faculty`} />
                    </CardContent>
                </Card>
            </div>
        </PageWrapper>
    );
}
