"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { format, addDays, startOfWeek } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Calendar as CalendarIcon, Clock, BookOpen, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getStudentLectures, LectureWithDetails } from "@/lib/services/lectures-service";
import { getEnrollmentsByStudent, createEnrollment } from "@/lib/services/enrollments-service";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { getUserByEmail } from "@/lib/services/users-service";
import { cn } from "@/lib/utils";

export default function StudentSchedulePage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [studentData, setStudentData] = useState<any>(null);
    const [schedule, setSchedule] = useState<Record<string, LectureWithDetails[]>>({});
    const [availableCourses, setAvailableCourses] = useState<any[]>([]);
    const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
    const [enrolling, setEnrolling] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchStudentData = async () => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

        try {
            // Get student profile with full details
            const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (!userData || userData.role !== 'student') return;

            setStudentData(userData);

            // Get enrolled course IDs
            const enrollments = await getEnrollmentsByStudent(userData.id);
            const enrolledIds = new Set(enrollments.map((e: any) => e.course_id));
            setEnrolledCourseIds(enrolledIds);

            // Build weekly schedule from enrolled lectures
            const start = startOfWeek(new Date(), { weekStartsOn: 1 });
            const days = Array.from({ length: 6 }).map((_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
            const weekLectures: Record<string, LectureWithDetails[]> = {};
            await Promise.all(days.map(async (date) => {
                const lectures = await getStudentLectures(userData.id, { date });
                weekLectures[date] = lectures;
            }));
            setSchedule(weekLectures);

            // Get courses available for this student
            let coursesQuery = supabase
                .from('courses')
                .select(`
                    *,
                    instructor:users!instructor_id(id, full_name, email),
                    discipline:disciplines(id, name)
                `)
                .order('semester')
                .order('code');

            if (userData.discipline_id) {
                coursesQuery = coursesQuery.eq('discipline_id', userData.discipline_id);
            } else if (userData.department_id) {
                // Fallback: If student has no discipline, show all courses in their department
                const { data: disciplines } = await supabase
                    .from('disciplines')
                    .select('id')
                    .eq('department_id', userData.department_id);

                if (disciplines && disciplines.length > 0) {
                    coursesQuery = coursesQuery.in('discipline_id', disciplines.map(d => d.id));
                }
            }

            const { data: courses, error } = await coursesQuery;

            if (!error && courses) {
                setAvailableCourses(courses.map(c => ({
                    ...c,
                    active_days: typeof c.active_days === 'string'
                        ? (c.active_days ? c.active_days.split(',').map((d: string) => d.trim()) : [])
                        : (c.active_days || [])
                })));
            }
        } catch (error) {
            console.error("Error loading schedule:", error);
            toast.error("Failed to load schedule");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudentData();
    }, [isLoaded, user]);

    const handleEnroll = async (courseId: string, semester: number) => {
        if (!studentData) return;
        setEnrolling(courseId);
        try {
            const result = await createEnrollment({
                student_id: studentData.id,
                course_id: courseId,
                semester: semester
            });
            if (result) {
                setEnrolledCourseIds(prev => new Set([...prev, courseId]));
                toast.success("Successfully enrolled in course!");
                // Refresh schedule
                fetchStudentData();
            }
        } catch (error) {
            console.error("Enrollment error:", error);
            toast.error("Failed to enroll");
        } finally {
            setEnrolling(null);
        }
    };

    if (!isLoaded || loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#FF8020]" />
            </div>
        );
    }

    const sortedDates = Object.keys(schedule).sort();

    const filteredCourses = availableCourses.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.instructor?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group courses by semester
    const coursesBySemester = filteredCourses.reduce((acc, course) => {
        const sem = course.semester;
        if (!acc[sem]) acc[sem] = [];
        acc[sem].push(course);
        return acc;
    }, {} as Record<number, any[]>);

    return (
        <PageWrapper>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Schedule & Enrollment</h1>
                    <p className="text-muted-foreground">
                        View your weekly schedule and enroll in available courses
                        {studentData?.discipline_id && (
                            <span className="ml-1 text-[#FF8020] font-medium">
                                {/* We'll show discipline name from courseData */}
                                {availableCourses[0]?.discipline?.name ? ` — ${availableCourses[0].discipline.name}` : ''}
                            </span>
                        )}
                    </p>
                </div>

                <Tabs defaultValue="weekly" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="weekly">
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            Weekly Schedule
                        </TabsTrigger>
                        <TabsTrigger value="courses">
                            <BookOpen className="h-4 w-4 mr-2" />
                            Available Courses
                            {availableCourses.length > 0 && (
                                <Badge variant="secondary" className="ml-2">{availableCourses.length}</Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* Weekly Schedule Tab */}
                    <TabsContent value="weekly">
                        {sortedDates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-xl">
                                <CalendarIcon className="h-12 w-12 mb-4 opacity-30" />
                                <p className="text-lg font-medium">No lectures scheduled this week</p>
                                <p className="text-sm mt-1">Enroll in courses to see your schedule here</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                                {sortedDates.map((date) => {
                                    const dateObj = new Date(date + 'T12:00:00');
                                    const dayName = format(dateObj, 'EEEE');
                                    const isToday = format(new Date(), 'yyyy-MM-dd') === date;
                                    const lectures = schedule[date] || [];

                                    return (
                                        <Card
                                            key={date}
                                            className={cn(
                                                "h-full border-none shadow-sm transition-all duration-300",
                                                isToday ? "ring-2 ring-[#FF8020] bg-orange-50/20" : "bg-white/50"
                                            )}
                                        >
                                            <CardHeader className={cn(
                                                "pb-3 text-center border-b rounded-t-xl",
                                                isToday ? "bg-orange-100/50" : "bg-muted/30"
                                            )}>
                                                <CardTitle className="text-lg font-bold">{dayName}</CardTitle>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    {format(dateObj, 'MMM d')}
                                                </p>
                                                {isToday && (
                                                    <Badge className="mx-auto text-[9px] bg-[#FF8020] text-white border-none">TODAY</Badge>
                                                )}
                                            </CardHeader>
                                            <CardContent className="p-3 space-y-3">
                                                {lectures.length === 0 ? (
                                                    <div className="text-center py-10 text-muted-foreground/50 text-xs italic">
                                                        No classes
                                                    </div>
                                                ) : (
                                                    lectures.map((lecture) => (
                                                        <div
                                                            key={lecture.id}
                                                            className="p-3 rounded-xl bg-white border border-slate-100 shadow-xs hover:shadow-md transition-shadow duration-200 space-y-2 group"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <Badge variant="outline" className="text-[10px] font-bold border-[#FF8020] text-[#FF8020] bg-orange-50">
                                                                    {lecture.course?.code}
                                                                </Badge>
                                                                <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-slate-100 text-slate-500 font-bold uppercase">
                                                                    {lecture.room || 'TBD'}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-[#FF8020] transition-colors" title={lecture.course?.name}>
                                                                {lecture.course?.name}
                                                            </div>
                                                            <div className="flex items-center text-[10px] font-medium text-muted-foreground gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {lecture.time_start} - {lecture.time_end}
                                                            </div>
                                                            {lecture.status === 'cancelled' && (
                                                                <Badge className="w-full justify-center text-[9px] h-4 bg-red-500 text-white border-none font-black uppercase">
                                                                    Cancelled
                                                                </Badge>
                                                            )}
                                                            {lecture.status === 'rescheduled' && (
                                                                <Badge className="w-full justify-center text-[9px] h-4 bg-blue-500 text-white border-none font-black uppercase">
                                                                    Rescheduled
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>

                    {/* Available Courses Tab */}
                    <TabsContent value="courses">
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="relative flex-1 max-w-sm">
                                    <Input
                                        placeholder="Search courses by name, code, or instructor..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-4"
                                    />
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    <span className="font-semibold text-foreground">{enrolledCourseIds.size}</span> enrolled
                                    {' / '}
                                    <span className="font-semibold text-foreground">{availableCourses.length}</span> available
                                </div>
                            </div>

                            {availableCourses.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-xl">
                                    <BookOpen className="h-12 w-12 mb-4 opacity-30" />
                                    <p className="text-lg font-medium">No courses available</p>
                                    <p className="text-sm mt-1">
                                        {studentData?.discipline_id
                                            ? "No courses found for your discipline. Contact your administrator."
                                            : "Your discipline is not set. Please contact admin to update your profile."
                                        }
                                    </p>
                                </div>
                            ) : (
                                Object.keys(coursesBySemester).sort((a, b) => Number(a) - Number(b)).map(sem => (
                                    <div key={sem} className="space-y-2">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-[#FF8020] text-white text-[10px] flex items-center justify-center font-black">{sem}</span>
                                            Semester {sem}
                                        </h3>
                                        <div className="border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Code</TableHead>
                                                        <TableHead>Course Name</TableHead>
                                                        <TableHead>Instructor</TableHead>
                                                        <TableHead>Schedule</TableHead>
                                                        <TableHead>Room</TableHead>
                                                        <TableHead>Credits</TableHead>
                                                        <TableHead className="text-right">Action</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {coursesBySemester[Number(sem)].map((course: any) => {
                                                        const isEnrolled = enrolledCourseIds.has(course.id);
                                                        return (
                                                            <TableRow key={course.id} className={cn(isEnrolled && "bg-green-50/50")}>
                                                                <TableCell className="font-medium font-mono text-sm">
                                                                    {course.code}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="font-medium">{course.name}</div>
                                                                    <div className="text-xs text-muted-foreground">Section {course.code + 'A'}</div>
                                                                </TableCell>
                                                                <TableCell className="text-sm">
                                                                    {course.instructor?.full_name || <span className="text-muted-foreground italic">TBA</span>}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {course.time_start && course.time_end ? (
                                                                        <div className="text-sm">
                                                                            <div className="flex items-center gap-1 text-muted-foreground text-xs">
                                                                                <Clock className="h-3 w-3" />
                                                                                {course.time_start} – {course.time_end}
                                                                            </div>
                                                                            {course.active_days?.length > 0 && (
                                                                                <div className="flex gap-1 mt-1 flex-wrap">
                                                                                    {course.active_days.map((day: string) => (
                                                                                        <Badge key={day} variant="outline" className="text-[9px] h-4 px-1">
                                                                                            {day.substring(0, 3)}
                                                                                        </Badge>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground italic">TBA</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-sm">
                                                                    {course.room || <span className="text-muted-foreground">TBA</span>}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="secondary">{course.credit_hours} cr</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {isEnrolled ? (
                                                                        <div className="flex items-center justify-end gap-1 text-green-600 text-sm font-medium">
                                                                            <CheckCircle2 className="h-4 w-4" />
                                                                            Enrolled
                                                                        </div>
                                                                    ) : (
                                                                        <Button
                                                                            size="sm"
                                                                            className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white"
                                                                            disabled={enrolling === course.id}
                                                                            onClick={() => handleEnroll(course.id, course.semester)}
                                                                        >
                                                                            {enrolling === course.id ? (
                                                                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                                            ) : (
                                                                                <Plus className="h-3 w-3 mr-1" />
                                                                            )}
                                                                            Enroll
                                                                        </Button>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </PageWrapper>
    );
}
