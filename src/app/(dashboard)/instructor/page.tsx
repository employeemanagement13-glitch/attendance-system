"use client";

import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { StatsCard } from "@/components/shared/stats-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Calendar, Clock, MapPin, Users, AlertCircle } from "lucide-react";
import { useUser } from "@clerk/nextjs";

// Services
import { getTodayLectures, getLecturesCount, LectureWithDetails } from "@/lib/services/lectures-service";
import { getFacultyStats } from "@/lib/services/faculty-attendance-service";

export default function InstructorDashboard() {
    const { user } = useUser();
    const [loading, setLoading] = useState(true);
    const [todayLectures, setTodayLectures] = useState<LectureWithDetails[]>([]);
    const [stats, setStats] = useState({
        totalClasses: 0,
        presentDays: 0,
        attendanceRate: 0,
        upcomingExams: 0
    });

    useEffect(() => {
        async function fetchData() {
            if (!user) return;

            // Map Clerk ID to our DB User ID via email
            const userEmail = user.emailAddresses[0]?.emailAddress;
            if (!userEmail) return;

            const { getUserByEmail } = await import("@/lib/services/users-service");
            const { getInstructorDashboardStats } = await import("@/lib/services/lectures-service");

            const dbUser = await getUserByEmail(userEmail);
            if (!dbUser) {
                console.warn("Instructor not found in database.");
                setLoading(false);
                return;
            }

            const [lectures, instructorStats] = await Promise.all([
                getTodayLectures(dbUser.id),
                getInstructorDashboardStats(dbUser.id)
            ]);

            setTodayLectures(lectures);
            setStats({
                totalClasses: instructorStats.total_classes,
                presentDays: instructorStats.active_days,
                attendanceRate: instructorStats.persona_attendance_rate,
                upcomingExams: instructorStats.upcoming_exams
            });

            setLoading(false);
        }

        if (user) fetchData();
    }, [user]);

    return (
        <PageWrapper>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.firstName}</h1>
                    <p className="text-muted-foreground">Here's what's happening today.</p>
                </div>

                {/* Stats Row */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatsCard label="Total Classes" value={stats.totalClasses} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
                    <StatsCard label="My Attendance" value={`${stats.attendanceRate}%`} icon={<Calendar className="h-4 w-4 text-muted-foreground" />} />
                    <StatsCard label="Active Days" value={stats.presentDays} icon={<Clock className="h-4 w-4 text-muted-foreground" />} />
                    <StatsCard label="Upcoming Exams" value={stats.upcomingExams} icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />} />
                </div>

                {/* Today's Schedule */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold tracking-tight">Today's Schedule</h2>
                        <Link href="/instructor/lectures">
                            <Button variant="outline" className="cursor-pointer">View All Lectures</Button>
                        </Link>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {todayLectures.length === 0 ? (
                            <Card className="col-span-full border-dashed bg-muted/50">
                                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                                    <Calendar className="h-10 w-10 text-muted-foreground mb-4" />
                                    <p className="text-lg font-semibold">No classes scheduled for today</p>
                                    <p className="text-sm text-muted-foreground">Enjoy your free time!</p>
                                </CardContent>
                            </Card>
                        ) : (
                            todayLectures.map((lecture) => (
                                <Card key={lecture.id} className="border-l-4 border-l-[#FF8020] hover:shadow-md transition-all">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <Badge variant="outline" className="mb-2 bg-blue-50 text-blue-700 border-blue-200">
                                                    {lecture.time_start} - {lecture.time_end}
                                                </Badge>
                                                <CardTitle className="text-lg">{lecture.course?.code}</CardTitle>
                                                <CardDescription>{lecture.course?.name}</CardDescription>
                                            </div>
                                            <Badge variant={lecture.status === 'completed' ? "default" : "secondary"}>
                                                {lecture.status === 'completed' ? 'Done' : 'Pending'}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <MapPin className="h-4 w-4" />
                                                <span>{lecture.room || "Room TBD"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Users className="h-4 w-4" />
                                                <span>{lecture.course?.code ? lecture.course.code + 'A' : 'Sec A'} • Sem {lecture.semester}</span>
                                            </div>
                                            <Link href={`/instructor/lectures/${lecture.id}`} className="block mt-4">
                                                <Button className="w-full bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer mt-2">
                                                    {lecture.status === 'completed' ? 'View Attendance' : 'Mark Attendance'}
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Notices / Low Attendance Alerts (Placeholder) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Needs Attention</CardTitle>
                        <CardDescription>Courses with low attendance trends</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground italic">No immediate alerts. Keep up the good work!</div>
                    </CardContent>
                </Card>
            </div>
        </PageWrapper>
    );
}
