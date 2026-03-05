"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
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
import { BookOpen, Calendar, Clock, UserX, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getStudentCourseCount, getEnrollmentsByStudent } from "@/lib/services/enrollments-service";
import { getStudentLectures, LectureWithDetails } from "@/lib/services/lectures-service";
import { getStudentAttendance, StudentAttendanceHistory } from "@/lib/services/lecture-attendance-service";
import { getUserByEmail } from "@/lib/services/users-service";
import { isSameDay, isSameWeek, isSameMonth, parseISO } from "date-fns";

export default function StudentDashboard() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [studentData, setStudentData] = useState<any>(null);
    const [activeDaysStr, setActiveDaysStr] = useState("Mon - Fri");

    // Stats
    const [courseCount, setCourseCount] = useState(0);
    const [missedCount, setMissedCount] = useState(0);
    const [cgpa, setCgpa] = useState(0);

    // Data lists
    const [allLectures, setAllLectures] = useState<LectureWithDetails[]>([]);
    const [absentLectures, setAbsentLectures] = useState<StudentAttendanceHistory[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendanceHistory[]>([]);

    // Filters
    const [lectureSearch, setLectureSearch] = useState("");
    const [dateFilterType, setDateFilterType] = useState<"day" | "week" | "month">("day");
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [attendanceFilter, setAttendanceFilter] = useState<"all" | "present" | "missed">("all");

    useEffect(() => {
        const fetchData = async () => {
            if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

            try {
                // Get full user profile
                const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
                if (userData && userData.role === 'student') {
                    setStudentData(userData);
                    setCgpa(userData.cgpa || 0);

                    const today = format(new Date(), 'yyyy-MM-dd');

                    // Parallel fetching
                    const [courses, lectures, attendance, enrollments] = await Promise.all([
                        getStudentCourseCount(userData.id),
                        getStudentLectures(userData.id), // Fetch all to allow date/week/month filtering
                        getStudentAttendance(userData.id),
                        getEnrollmentsByStudent(userData.id)
                    ]);

                    setCourseCount(courses);
                    setAllLectures(lectures);
                    setAttendanceRecords(attendance);

                    // Derive active days from enrolled courses
                    const activeDaysSet = new Set<string>();
                    enrollments.forEach(e => {
                        if (e.course?.active_days) {
                            const days = Array.isArray(e.course.active_days)
                                ? e.course.active_days
                                : (typeof e.course.active_days === 'string' ? e.course.active_days.split(',') : []);
                            days.forEach((day: string) => activeDaysSet.add(day.trim()));
                        }
                    });
                    const activeDays = activeDaysSet.size > 0
                        ? Array.from(activeDaysSet).sort().join(', ')
                        : "Mon - Fri";
                    setActiveDaysStr(activeDays);

                    // Filter absents
                    const absents = attendance.filter(a => a.status === 'absent' || a.status === 'leave');
                    setAbsentLectures(absents);
                    setMissedCount(absents.filter(a => a.status === 'absent').length);
                }
            } catch (error) {
                console.error("Error loading dashboard:", error);
                toast.error("Failed to load dashboard data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isLoaded, user]);

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    if (!studentData) {
        return <div className="p-8">Access denied. Student role required.</div>;
    }

    const filteredLectures = allLectures.filter(l => {
        // Search Filter
        const matchesSearch = l.course?.name.toLowerCase().includes(lectureSearch.toLowerCase()) ||
            l.course?.code.toLowerCase().includes(lectureSearch.toLowerCase());
        if (!matchesSearch) return false;

        // Date Filter
        if (!selectedDate) return false;
        try {
            const lectureDate = parseISO(l.date);
            const refDate = parseISO(selectedDate);
            let matchesDate = false;
            if (dateFilterType === "day") {
                matchesDate = isSameDay(lectureDate, refDate);
            } else if (dateFilterType === "week") {
                matchesDate = isSameWeek(lectureDate, refDate, { weekStartsOn: 1 });
            } else if (dateFilterType === "month") {
                matchesDate = isSameMonth(lectureDate, refDate);
            }
            if (!matchesDate) return false;
        } catch (e) {
            return false;
        }

        // Attendance Filter
        if (attendanceFilter !== "all") {
            const record = attendanceRecords.find(a => a.lecture_id === l.id);
            if (attendanceFilter === "present") {
                if (!record || (record.status !== "present" && record.status !== "late")) return false;
            } else if (attendanceFilter === "missed") {
                if (!record || (record.status !== "absent" && record.status !== "leave")) return false;
            }
        }

        return true;
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                    Welcome back, {studentData.full_name}
                </p>
            </div>

            {/* Component 1: Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => router.push('/student/courses')}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Courses</CardTitle>
                        <BookOpen className="h-4 w-4 text-[#FF8020]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{courseCount}</div>
                        <p className="text-xs text-muted-foreground">Enrolled courses</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Missed Classes</CardTitle>
                        <UserX className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{missedCount}</div>
                        <p className="text-xs text-muted-foreground">Total absences</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Days</CardTitle>
                        <Calendar className="h-4 w-4 text-[#FF8020]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeDaysStr}</div>
                        <p className="text-xs text-muted-foreground">Class schedule</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">CGPA</CardTitle>
                        <Clock className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{cgpa.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">Current CGPA</p>
                    </CardContent>
                </Card>
            </div>

            {/* Component 2: Lectures Table */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Lectures</h2>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search lectures..."
                            className="pl-8"
                            value={lectureSearch}
                            onChange={(e) => setLectureSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-lg border">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Period:</span>
                        <Select value={dateFilterType} onValueChange={(val: any) => setDateFilterType(val)}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Date Filter" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="day">Specific Day</SelectItem>
                                <SelectItem value="week">By Week</SelectItem>
                                <SelectItem value="month">By Month</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-auto"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Attendance:</span>
                        <Select value={attendanceFilter} onValueChange={(val: any) => setAttendanceFilter(val)}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Lectures</SelectItem>
                                <SelectItem value="present">Present</SelectItem>
                                <SelectItem value="missed">Missed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Active Days</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Room</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLectures.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                    No lectures scheduled for today
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLectures.map((lecture) => (
                                <TableRow key={lecture.id}>
                                    <TableCell className="font-medium">
                                        {lecture.course?.name} <span className="text-xs text-muted-foreground ml-1">({lecture.course?.code})</span>
                                    </TableCell>
                                    <TableCell>{format(new Date(lecture.date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{lecture.time_start} - {lecture.time_end}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {Array.isArray(lecture.course?.active_days)
                                            ? lecture.course?.active_days.join(', ')
                                            : (typeof lecture.course?.active_days === 'string'
                                                ? lecture.course.active_days
                                                : 'Mon, Fri')}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={lecture.status === 'cancelled' ? 'destructive' : 'secondary'}>
                                            {lecture.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{lecture.room || 'TBD'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Absents | Lectures</h2>
                </div>

                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Reason</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {absentLectures.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">
                                        No absences recorded
                                    </TableCell>
                                </TableRow>
                            ) : (
                                absentLectures.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium">
                                            {record.lecture?.course?.name || 'Unknown Course'}
                                        </TableCell>
                                        <TableCell>
                                            {record.lecture?.date ? format(new Date(record.lecture.date), 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell>{record.lecture?.time_start || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={record.status === 'absent' ? 'destructive' : 'secondary'}>
                                                {record.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {record.status === 'absent' ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => router.push('/student/leaves')}
                                                >
                                                    Request Leave
                                                </Button>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">Leave Requested</span>
                                            )}
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
