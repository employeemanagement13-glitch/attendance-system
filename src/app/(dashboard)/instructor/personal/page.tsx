"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { BookOpen, Calendar, Clock, UserCheck, Search, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getUserByEmail } from "@/lib/services/users-service";
import { getCoursesByInstructor, CourseWithDetails } from "@/lib/services/courses-service";
import {
    getInstructorAttendanceHistory,
    getFacultyStats,
    FacultyAttendanceWithDetails
} from "@/lib/services/faculty-attendance-service";

export default function InstructorPersonalPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [instructorId, setInstructorId] = useState<string | null>(null);
    const [instructorName, setInstructorName] = useState("");

    // Data states
    const [courses, setCourses] = useState<CourseWithDetails[]>([]);
    const [attendanceHistory, setAttendanceHistory] = useState<FacultyAttendanceWithDetails[]>([]);
    const [stats, setStats] = useState({
        lates: 0,
        absents: 0,
        shortLeaves: 0,
        percentage: 100
    });

    // Filter states
    const [courseSearch, setCourseSearch] = useState("");
    const [absentDateFilter, setAbsentDateFilter] = useState("");
    const [activeDateFilter, setActiveDateFilter] = useState("");
    const [activeMonthFilter, setActiveMonthFilter] = useState<string>(new Date().getMonth().toString());
    const [activeYearFilter, setActiveYearFilter] = useState<string>(new Date().getFullYear().toString());

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1].map(String);

    // Setup instructor data
    useEffect(() => {
        const fetchInstructorData = async () => {
            if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

            try {
                const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
                if (userData && userData.role === 'instructor') {
                    setInstructorId(userData.id);
                    setInstructorName(userData.full_name || "Instructor");

                    // Fetch all data in parallel
                    const [coursesData, historyData, statsData] = await Promise.all([
                        getCoursesByInstructor(userData.id),
                        getInstructorAttendanceHistory(userData.id, 100), // Get last 100 records
                        getFacultyStats(userData.id)
                    ]);

                    setCourses(coursesData);
                    setAttendanceHistory(historyData);
                    setStats(statsData);
                }
            } catch (error) {
                console.error("Error loading instructor data:", error);
                toast.error("Failed to load profile data");
            } finally {
                setLoading(false);
            }
        };

        fetchInstructorData();
    }, [isLoaded, user]);

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    if (!instructorId) {
        return <div className="p-8">Access denied. Instructor role required.</div>;
    }

    // Filtered lists
    const filteredCourses = courses.filter(c =>
        c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
        c.code.toLowerCase().includes(courseSearch.toLowerCase())
    );

    const absentDays = attendanceHistory.filter((record: FacultyAttendanceWithDetails) =>
        (record.status === 'absent' || record.status === 'short_leave') &&
        (absentDateFilter ? record.date === absentDateFilter : true)
    );

    const displayActiveDays = attendanceHistory.filter((record: FacultyAttendanceWithDetails) => {
        const d = new Date(record.date);
        const matchesDate = activeDateFilter ? record.date === activeDateFilter : true;
        const matchesMonth = activeMonthFilter !== "all" ? d.getMonth().toString() === activeMonthFilter : true;
        const matchesYear = activeYearFilter !== "all" ? d.getFullYear().toString() === activeYearFilter : true;
        return matchesDate && matchesMonth && matchesYear;
    });

    // Scroll handlers
    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Personal Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your courses, attendance, and schedule
                </p>
            </div>

            {/* Component 1: 4 Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => scrollToSection('courses-section')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Courses</CardTitle>
                        <BookOpen className="h-4 w-4 text-[#FF8020]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{courses.length}</div>
                        <p className="text-xs text-muted-foreground">Active courses</p>
                    </CardContent>
                </Card>

                <Card
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => scrollToSection('absents-section')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Absents</CardTitle>
                        <UserCheck className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.absents}</div>
                        <p className="text-xs text-muted-foreground">Total absences</p>
                    </CardContent>
                </Card>

                <Card
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => scrollToSection('active-days-section')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Days</CardTitle>
                        <Calendar className="h-4 w-4 text-[#FF8020]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Mon - Fri</div>
                        <p className="text-xs text-muted-foreground">Standard schedule</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Attendance %</CardTitle>
                        <Clock className="h-4 w-4 text-[#FF8020]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.percentage}%</div>
                        <p className="text-xs text-muted-foreground">Overall attendance</p>
                    </CardContent>
                </Card>
            </div>

            {/* Component 2: Courses Table */}
            <div id="courses-section" className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Courses</h2>
                    <div className="relative w-72">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search courses..."
                            className="pl-8"
                            value={courseSearch}
                            onChange={(e) => setCourseSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="border rounded-md bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Discipline</TableHead>
                                <TableHead>Semester</TableHead>
                                <TableHead>Section</TableHead>
                                <TableHead>Active Days</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCourses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        No courses found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCourses.map((course) => (
                                    <TableRow
                                        key={course.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => router.push(`/instructor/lectures?courseId=${course.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {course.name} <span className="text-muted-foreground text-xs ml-1">({course.code})</span>
                                        </TableCell>
                                        <TableCell>{course.discipline?.name || 'N/A'}</TableCell>
                                        <TableCell>{course.semester}</TableCell>
                                        <TableCell>
                                            {(() => {
                                                const count = course.students_count || 0;
                                                const sectionCount = Math.max(1, Math.ceil(count / 100));
                                                const letters = [];
                                                for (let i = 0; i < sectionCount; i++) {
                                                    letters.push(course.code + String.fromCharCode(65 + i));
                                                }
                                                return letters.join(', ');
                                            })()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {course.active_days && course.active_days.length > 0
                                                    ? course.active_days.slice(0, 3).join(', ') + (course.active_days.length > 3 ? '...' : '')
                                                    : 'Mon, Wed, Fri'}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Component 3: Absents Table */}
            <div id="absents-section" className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Absents | {instructorName}</h2>
                    <div className="flex items-center gap-2">
                        <Input
                            type="date"
                            className="w-48"
                            value={absentDateFilter}
                            onChange={(e) => setAbsentDateFilter(e.target.value)}
                        />
                    </div>
                </div>

                <div className="border rounded-md bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Lectures Missed</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {absentDays.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">
                                        No absences recorded
                                    </TableCell>
                                </TableRow>
                            ) : (
                                absentDays.map((record) => (
                                    <TableRow
                                        key={record.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => router.push(`/instructor/absent-lectures?date=${record.date}`)}
                                    >
                                        <TableCell>{format(new Date(record.date), 'dd MMMM, yyyy')}</TableCell>
                                        <TableCell>-</TableCell>
                                        <TableCell>
                                            <Badge variant={record.status === 'absent' ? 'destructive' : 'outline'} className={record.status === 'short_leave' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' : ''}>
                                                {record.status === 'short_leave' ? 'Short Leave' : 'Absent'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-muted-foreground text-sm font-medium">View details</span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Component 4: Active Days Table */}
            <div id="active-days-section" className="space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold">Active Days | {instructorName}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={activeMonthFilter} onValueChange={setActiveMonthFilter}>
                            <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Months</SelectItem>
                                {months.map((m, i) => (
                                    <SelectItem key={m} value={i.toString()}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={activeYearFilter} onValueChange={setActiveYearFilter}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(y => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="relative">
                            <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="date"
                                className="w-40 pl-8"
                                value={activeDateFilter}
                                onChange={(e) => setActiveDateFilter(e.target.value)}
                            />
                        </div>

                        {(activeDateFilter || activeMonthFilter !== "all") && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-9 hover:text-orange-600"
                                onClick={() => {
                                    setActiveDateFilter("");
                                    setActiveMonthFilter(new Date().getMonth().toString());
                                    setActiveYearFilter(new Date().getFullYear().toString());
                                }}
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                </div>

                <div className="border rounded-md bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>On Campus</TableHead>
                                <TableHead>Left</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayActiveDays.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">
                                        No active days found for this period
                                    </TableCell>
                                </TableRow>
                            ) : (
                                displayActiveDays.map((record) => (
                                    <TableRow
                                        key={record.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => router.push(`/instructor/personal/${record.date}`)}
                                    >
                                        <TableCell>{format(new Date(record.date), 'dd MMMM, yyyy')}</TableCell>
                                        <TableCell>{record.on_campus ? format(new Date(`2000-01-01T${record.on_campus}`), 'h:mm a') : '-'}</TableCell>
                                        <TableCell>{record.left_campus ? format(new Date(`2000-01-01T${record.left_campus}`), 'h:mm a') : '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={record.status === 'present' ? 'default' : 'secondary'} className={record.status === 'present' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                                                {record.status === 'present' ? 'Present' : record.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
