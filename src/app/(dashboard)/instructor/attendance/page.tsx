"use client";

import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { getLectures, LectureWithDetails } from "@/lib/services/lectures-service";
import { getUserByEmail } from "@/lib/services/users-service";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";

export default function InstructorAttendancePage() {
    const { user, isLoaded } = useUser();
    const [lectures, setLectures] = useState<LectureWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

            setLoading(true);
            try {
                const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
                if (userData) {
                    const data = await getLectures({ instructorId: userData.id });
                    setLectures(data);
                }
            } catch (error) {
                console.error("Error fetching lectures:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [isLoaded, user]);

    // Filter into categories
    const today = new Date().toISOString().split('T')[0];
    const todaysLectures = lectures.filter(l => l.date === today);
    const pastPendingLectures = lectures.filter(l => l.date < today && l.status === 'scheduled');
    const completedLectures = lectures.filter(l => l.status === 'completed');

    if (loading) return <div className="p-8">Loading attendance modules...</div>;

    return (
        <PageWrapper>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Attendance Management</h1>
                    <p className="text-muted-foreground">Mark and review attendance for your classes.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Today's Classes */}
                    <Card className="md:col-span-2 border-orange-200 bg-orange-50/30">
                        <CardHeader>
                            <CardTitle className="flex items-center text-orange-700">
                                <Calendar className="mr-2 h-5 w-5" /> Today's Classes
                            </CardTitle>
                            <CardDescription>Lectures scheduled for today ({format(new Date(), 'MMMM d, yyyy')})</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {todaysLectures.length === 0 ? (
                                <div className="text-sm text-muted-foreground italic">No classes scheduled for today.</div>
                            ) : (
                                <div className="space-y-4">
                                    {todaysLectures.map(lecture => (
                                        <div key={lecture.id} className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
                                            <div className="flex flex-col gap-1">
                                                <div className="font-semibold text-lg">{lecture.course?.code} - {lecture.course?.name}</div>
                                                <div className="flex items-center text-sm text-muted-foreground">
                                                    <Clock className="mr-1 h-3 w-3" /> {lecture.time_start} - {lecture.time_end}
                                                    <span className="mx-2">•</span>
                                                    <span>{lecture.room}</span>
                                                </div>
                                            </div>
                                            <Link href={`/instructor/lectures/${lecture.id}`}>
                                                <Button className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white">
                                                    Mark Attendance <ArrowRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Past Pending */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-red-600 flex items-center">
                                <XCircle className="mr-2 h-5 w-5" /> Pending Attendance
                            </CardTitle>
                            <CardDescription>Past lectures that haven't been marked yet.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {pastPendingLectures.length === 0 ? (
                                <div className="text-sm font-medium flex items-center text-green-600">
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> All caught up!
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pastPendingLectures.map(lecture => (
                                        <div key={lecture.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                            <div>
                                                <div className="font-medium">{lecture.course?.code}</div>
                                                <div className="text-xs text-muted-foreground">{format(new Date(lecture.date), 'MMM d')} • {lecture.time_start}</div>
                                            </div>
                                            <Link href={`/instructor/lectures/${lecture.id}`}>
                                                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                                                    Mark Now
                                                </Button>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recently Completed */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <CheckCircle2 className="mr-2 h-5 w-5 text-green-600" /> Recently Completed
                            </CardTitle>
                            <CardDescription>Review attendance records.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {completedLectures.slice(0, 5).length === 0 ? (
                                <div className="text-sm text-muted-foreground">No completed lectures yet.</div>
                            ) : (
                                <div className="space-y-3">
                                    {completedLectures.slice(0, 5).map(lecture => (
                                        <div key={lecture.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                            <div>
                                                <div className="font-medium">{lecture.course?.code}</div>
                                                <div className="text-xs text-muted-foreground">{format(new Date(lecture.date), 'MMM d')} • {lecture.status}</div>
                                            </div>
                                            <Link href={`/instructor/lectures/${lecture.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    View
                                                </Button>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageWrapper>
    );
}
