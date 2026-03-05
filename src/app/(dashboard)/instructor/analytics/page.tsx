"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, AlertTriangle, Users } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getCoursesByInstructor } from "@/lib/services/courses-service";

type StudentRisk = {
    id: string;
    name: string;
    email: string;
    course: string;
    attendance: number;
    riskLevel: "High" | "Moderate";
};

export default function InstructorAnalyticsPage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [atRiskStudents, setAtRiskStudents] = useState<StudentRisk[]>([]);
    const [stats, setStats] = useState({
        totalStudents: 0,
        avgAttendance: 0,
        atRiskCount: 0,
        totalCourses: 0,
    });

    useEffect(() => {
        const fetchData = async () => {
            const email = user?.primaryEmailAddress?.emailAddress;
            if (!email) return;
            try {
                const { data: rows } = await supabase.rpc('get_user_by_email', { p_email: email });
                const instructor = rows?.[0];
                if (!instructor) return;

                // Get this instructor's courses
                const courses = await getCoursesByInstructor(instructor.id);
                const courseIds = courses.map((c: any) => c.id);

                if (courseIds.length === 0) {
                    setLoading(false);
                    return;
                }

                // Get all enrollments for these courses
                const { data: enrollments } = await supabase
                    .from('enrollments')
                    .select('student_id, course_id, courses(name, code)')
                    .in('course_id', courseIds)
                    .eq('status', 'enrolled');

                const uniqueStudents = new Set((enrollments || []).map((e: any) => e.student_id));

                // Get attendance for each student
                const { data: attendanceData } = await supabase
                    .from('lecture_attendance')
                    .select('student_id, status, lecture:lectures(course_id)')
                    .in('lecture.course_id', courseIds);

                // Compute per-student attendance rates
                const studentStats: Record<string, { present: number; total: number; courseId: string }> = {};
                (attendanceData || []).forEach((a: any) => {
                    const sid = a.student_id;
                    const courseId = a.lecture?.course_id;
                    if (!sid || !courseId) return;
                    const key = `${sid}_${courseId}`;
                    if (!studentStats[key]) studentStats[key] = { present: 0, total: 0, courseId };
                    studentStats[key].total++;
                    if (a.status === 'present') studentStats[key].present++;
                });

                // Get student names
                const studentIds = Array.from(uniqueStudents);
                let nameMap: Record<string, string> = {};
                let emailMap: Record<string, string> = {};
                if (studentIds.length > 0) {
                    const { data: studentData } = await supabase
                        .from('users')
                        .select('id, full_name, email')
                        .in('id', studentIds);
                    (studentData || []).forEach((s: any) => {
                        nameMap[s.id] = s.full_name;
                        emailMap[s.id] = s.email;
                    });
                }

                // Build risk list
                const riskList: StudentRisk[] = [];
                let totalAttendance = 0;
                let count = 0;

                Object.entries(studentStats).forEach(([key, stat]) => {
                    const [sid, courseId] = key.split('_');
                    const rate = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 100;
                    totalAttendance += rate;
                    count++;
                    if (rate < 80) {
                        const courseName = courses.find((c: any) => c.id === courseId)?.name || courseId;
                        riskList.push({
                            id: key,
                            name: nameMap[sid] || 'Unknown',
                            email: emailMap[sid] || '—',
                            course: courseName,
                            attendance: rate,
                            riskLevel: rate < 60 ? 'High' : 'Moderate',
                        });
                    }
                });

                setAtRiskStudents(riskList.sort((a, b) => a.attendance - b.attendance));
                setStats({
                    totalStudents: uniqueStudents.size,
                    avgAttendance: count > 0 ? Math.round(totalAttendance / count) : 0,
                    atRiskCount: riskList.length,
                    totalCourses: courses.length,
                });
            } catch (err) {
                console.error("Error loading analytics:", err);
                toast.error("Failed to load analytics");
            } finally {
                setLoading(false);
            }
        };
        if (isLoaded) fetchData();
    }, [isLoaded, user]);

    const columns: ColumnDef<StudentRisk>[] = [
        { accessorKey: "name", header: "Student Name" },
        { accessorKey: "email", header: "Email" },
        { accessorKey: "course", header: "Course" },
        {
            accessorKey: "attendance",
            header: "Attendance %",
            cell: ({ row }) => {
                const val = row.getValue("attendance") as number;
                return <span className={`font-bold ${val < 60 ? 'text-red-600' : 'text-orange-500'}`}>{val}%</span>;
            }
        },
        {
            accessorKey: "riskLevel",
            header: "Risk Level",
            cell: ({ row }) => {
                const level = row.getValue("riskLevel") as string;
                return <Badge variant={level === "High" ? "destructive" : "secondary"} className="capitalize">{level}</Badge>;
            }
        },
    ];

    if (!isLoaded || loading) {
        return <PageWrapper><div className="p-8 text-center">Loading analytics...</div></PageWrapper>;
    }

    return (
        <PageWrapper>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">Class Analytics</h1>

                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                            <Users className="h-4 w-4 text-[#FF8020]" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{stats.totalStudents}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
                            <BarChart3 className="h-4 w-4 text-[#FF8020]" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{stats.avgAttendance}%</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Students At Risk</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-[#FF8020]" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{stats.atRiskCount}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">My Courses</CardTitle>
                            <TrendingUp className="h-4 w-4 text-[#FF8020]" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{stats.totalCourses}</div></CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Students At Risk (Below 80% Attendance)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {atRiskStudents.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                🎉 No students below 80% attendance threshold!
                            </div>
                        ) : (
                            <DataTable columns={columns} data={atRiskStudents} searchKey="name" filename="at_risk_students" />
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageWrapper>
    );
}
