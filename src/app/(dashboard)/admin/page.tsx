"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/shared/stats-card";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Services
import { getDepartmentsCount } from "@/lib/services/departments-service";
import { getUsersCount, getLowAttendanceStudents, getLowAttendanceFaculty, getInstructors } from "@/lib/services/users-service";
import { getFacultyStats } from "@/lib/services/faculty-attendance-service";
import { getCourses, CourseWithDetails } from "@/lib/services/courses-service";
import { getDisciplines, DisciplineWithDetails } from "@/lib/services/disciplines-service";

// Types
type Discipline = {
    id: string;
    name: string;
    coursesCount: number;
    studentsCount: number;
    department: string;
    attendance: number;
    creditHours: number;
};

type FacultyAttendance = {
    id: string;
    name: string;
    department: string;
    courses: string;
    shortLeaves: number;
    attendance: number;
};

// Columns
const disciplineColumns: ColumnDef<Discipline>[] = [
    { accessorKey: "name", header: "Discipline" },
    { accessorKey: "coursesCount", header: "Courses" },
    { accessorKey: "studentsCount", header: "Students" },
    { accessorKey: "creditHours", header: "Credit Hours" },
    { accessorKey: "department", header: "Department" },
    {
        accessorKey: "attendance",
        header: "Attendance %",
        cell: ({ row }) => {
            const val = row.getValue("attendance") as number;
            return <span className={val < 75 ? "text-red-500 font-bold" : "text-foreground font-medium"}>{val}%</span>;
        }
    },
    {
        id: "actions",
        cell: ({ row }) => (
            <Link href={`/admin/disciplines/${row.original.id}`}>
                <Button variant="outline" size="sm" className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white border-[#FF8020] cursor-pointer">View</Button>
            </Link>
        )
    }
];

const courseColumns: ColumnDef<CourseWithDetails>[] = [
    { accessorKey: "name", header: "Course Name" },
    {
        accessorKey: "discipline",
        header: "Discipline",
        cell: ({ row }) => row.original.discipline?.name || "N/A"
    },
    {
        accessorKey: "instructor",
        header: "Faculty",
        cell: ({ row }) => row.original.instructor?.full_name || "Unassigned"
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
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Link href={`/admin/courses/${row.original.id}`}>
                    <Button variant="outline" size="sm" className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white border-[#FF8020] cursor-pointer">View</Button>
                </Link>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#FF8020] cursor-pointer gap-1"
                    onClick={async () => {
                        const { generateCourseReport } = await import("@/lib/services/reports-service");
                        await generateCourseReport(row.original.id, row.original.name);
                    }}
                >
                    <FileText className="h-4 w-4" /> Generate Report
                </Button>
            </div>
        )
    }
];

const facultyColumns: ColumnDef<FacultyAttendance>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "courses", header: "Courses" },
    { accessorKey: "shortLeaves", header: "Short Leaves" },
    {
        accessorKey: "attendance",
        header: "Att %",
        cell: ({ row }) => <Badge variant="default" className="bg-gray-100">{row.getValue("attendance")}%</Badge>
    },
    {
        id: "actions",
        cell: ({ row }) => (
            <Link href={`/admin/faculty/${row.original.id}`}>
                <Button variant="outline" size="sm" className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white border-[#FF8020] cursor-pointer">View</Button>
            </Link>
        )
    },
];

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalStudents: 0,
        departments: 0,
        lowAttStudents: 0,
        lowAttFaculty: 0
    });
    const [coursesData, setCoursesData] = useState<CourseWithDetails[]>([]);
    const [facultyData, setFacultyData] = useState<FacultyAttendance[]>([]);
    const [disciplinesData, setDisciplinesData] = useState<Discipline[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                const [totalStudents, departments, lowStudents, lowFaculty, courses, disciplines] = await Promise.all([
                    getUsersCount('student'),
                    getDepartmentsCount(),
                    getLowAttendanceStudents(75),
                    getLowAttendanceFaculty(),
                    getCourses(),
                    getDisciplines()
                ]);

                setStats({
                    totalStudents,
                    departments,
                    lowAttStudents: lowStudents.length,
                    lowAttFaculty: lowFaculty.length
                });

                setCoursesData(courses);

                const formattedDisciplines: Discipline[] = disciplines.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    coursesCount: d.courses_count || 0,
                    studentsCount: d.students_count || 0,
                    department: d.department?.name || d.department_name || "N/A",
                    attendance: d.attendance || 0,
                    creditHours: d.total_credit_hours || 0
                }));
                setDisciplinesData(formattedDisciplines);

                // Fetch all instructors and their stats
                const allInstructors = await getInstructors();
                const formattedFaculty: FacultyAttendance[] = await Promise.all(allInstructors.map(async (f: any) => {
                    const stats = await getFacultyStats(f.id);
                    return {
                        id: f.id,
                        name: f.full_name || "Unknown",
                        department: f.department?.name || "N/A",
                        courses: "Multiple",
                        shortLeaves: stats.shortLeaves,
                        attendance: stats.percentage
                    };
                }));

                setFacultyData(formattedFaculty);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const chartData = disciplinesData.map(d => ({
        name: d.name,
        department: d.department,
        label: d.department ? `${d.name} (${d.department})` : d.name,
        attendance: d.attendance
    })).sort((a, b) => a.attendance - b.attendance);

    return (
        <div className="space-y-8 p-1">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/admin/users?tab=students" className="cursor-pointer">
                    <StatsCard label="Total Students" value={stats.totalStudents} />
                </Link>
                <Link href="/admin/departments" className="cursor-pointer">
                    <StatsCard label="Departments" value={stats.departments} />
                </Link>
                <Link href="/admin/lowattstudents" className="cursor-pointer">
                    <StatsCard label="Low Att Students" value={stats.lowAttStudents} />
                </Link>
                <Link href="/admin/faculty?filter=low" className="cursor-pointer">
                    <StatsCard label="Low Att Faculty" value={stats.lowAttFaculty} />
                </Link>
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-bold tracking-tight">Disciplines Overview</h2>
                    <Card className="bg-white/50 border-none shadow-sm">
                        <CardContent className="p-4">
                            <DataTable
                                columns={disciplineColumns}
                                data={disciplinesData}
                                searchKey="name"
                                filename="disciplines_overview"
                                action={
                                    <Link href="/admin/disciplines">
                                        <Button size="sm" className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white shadow-md cursor-pointer">
                                            <Plus className="h-4 w-4 mr-1" /> Add Discipline
                                        </Button>
                                    </Link>
                                }
                            />
                        </CardContent>
                    </Card>

                    {/* Lowest Attendance Chart */}
                    <Card className="bg-white/50 border-none shadow-sm overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-semibold">Discipline's Lowest Attendance Chart</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        angle={-45}
                                        textAnchor="end"
                                        interval={0}
                                        height={100}
                                        fontSize={10}
                                    />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip
                                        cursor={{ fill: '#f3f4f6' }}
                                        formatter={(value: any) => [`${value}%`, 'Attendance']}
                                    />
                                    <Bar dataKey="attendance" radius={[4, 4, 0, 0]} barSize={40}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.attendance < 75 ? '#ef4444' : '#FF8020'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-bold tracking-tight">Courses</h2>
                    <Card className="bg-white/50 border-none shadow-sm">
                        <CardContent className="p-4">
                            <DataTable
                                columns={courseColumns}
                                data={coursesData}
                                searchKey="name"
                                filename="courses_list"
                                action={
                                    <Link href="/admin/courses">
                                        <Button size="sm" className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white shadow-md cursor-pointer">
                                            <Plus className="h-4 w-4 mr-1" /> Add Course
                                        </Button>
                                    </Link>
                                }
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-bold tracking-tight">Faculty Attendance</h2>
                    <Card className="bg-white/50 border-none shadow-sm">
                        <CardContent className="p-4">
                            <DataTable
                                columns={facultyColumns}
                                data={facultyData}
                                searchKey="name"
                                filename="faculty_attendance"
                                action={
                                    <Link href="/admin/faculty">
                                        <Button size="sm" variant="outline" className="border-[#FF8020] text-[#FF8020] hover:bg-[#FF8020]/10 cursor-pointer">
                                            View All Faculty
                                        </Button>
                                    </Link>
                                }
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
