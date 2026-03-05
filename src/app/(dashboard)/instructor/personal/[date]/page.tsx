"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getUserByEmail } from "@/lib/services/users-service";
import { getLectures, LectureWithDetails } from "@/lib/services/lectures-service";

export default function ActiveDayPage() {
    const params = useParams();
    const date = params.date as string;
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [lectures, setLectures] = useState<LectureWithDetails[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

            try {
                const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
                if (userData && userData.role === 'instructor') {
                    // Fetch lectures for this date
                    const lecturesData = await getLectures({
                        instructorId: userData.id,
                        date: date
                    });
                    setLectures(lecturesData);
                }
            } catch (error) {
                console.error("Error loading day details:", error);
                toast.error("Failed to load details");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isLoaded, user, date]);

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    const formattedDate = date ? format(new Date(date), 'dd MMMM, yyyy') : 'Loading...';

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="h-8 w-8"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Lectures | {formattedDate}</h1>
                    <p className="text-muted-foreground">
                        Detailed view of activity for this day
                    </p>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Discipline</TableHead>
                            <TableHead>Semester</TableHead>
                            <TableHead>Section</TableHead>
                            <TableHead>Students</TableHead>
                            <TableHead>Present</TableHead>
                            <TableHead>Percentage</TableHead>
                            <TableHead>Room</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lectures.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-8">
                                    No lectures found for this date
                                </TableCell>
                            </TableRow>
                        ) : (
                            lectures.map((lecture) => (
                                <TableRow
                                    key={lecture.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => router.push(`/instructor/lectures/${lecture.id}`)}
                                >
                                    <TableCell className="font-medium">
                                        {lecture.course?.name || 'Unknown Course'}
                                    </TableCell>
                                    <TableCell>
                                        {lecture.time_start} - {lecture.time_end}
                                    </TableCell>
                                    <TableCell>{'-'}</TableCell>
                                    <TableCell>{lecture.semester}</TableCell>
                                    <TableCell>{lecture.course?.code ? lecture.course.code + 'A' : '-'}</TableCell>
                                    <TableCell>{lecture.students_count}</TableCell>
                                    <TableCell>{lecture.present_count}</TableCell>
                                    <TableCell>
                                        <Badge variant={
                                            (lecture.attendance_percentage || 0) < 75 ? 'destructive' : 'default'
                                        }>
                                            {lecture.attendance_percentage}%
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{lecture.room || 'TBD'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
