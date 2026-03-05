"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { ArrowLeft, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getUserByEmail } from "@/lib/services/users-service";
import { getCourse, CourseWithDetails } from "@/lib/services/courses-service";
import { getStudentCourseExams, StudentExamWithResult } from "@/lib/services/exams-service";

export default function StudentCourseDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isLoaded } = useUser();

    const [loading, setLoading] = useState(true);
    const [course, setCourse] = useState<CourseWithDetails | null>(null);
    const [exams, setExams] = useState<StudentExamWithResult[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!isLoaded || !user?.primaryEmailAddress?.emailAddress || !params.id) return;

            try {
                const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
                if (userData && userData.role === 'student') {
                    // Fetch course info and exams in parallel
                    const [courseData, examsData] = await Promise.all([
                        getCourse(params.id as string),
                        getStudentCourseExams(params.id as string, userData.id)
                    ]);

                    setCourse(courseData);
                    setExams(examsData);
                }
            } catch (error) {
                console.error("Error loading course details page : ", error);
                toast.error("Failed to load details");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isLoaded, user, params.id]);

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    if (!course) {
        return <div className="p-8">Course not found.</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{course.name}</h1>
                    <div className="flex gap-2 text-muted-foreground mt-1 text-sm">
                        <span>{course.code}</span>
                        <span>•</span>
                        <span>{course.discipline?.name}</span>
                        <span>•</span>
                        <span>{course.instructor?.full_name || 'No Instructor'}</span>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Exams & Results</h2>

                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Exam Name</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Total Marks</TableHead>
                                <TableHead>Obtained Marks</TableHead>
                                <TableHead>Percentage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {exams.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        No exams scheduled yet
                                    </TableCell>
                                </TableRow>
                            ) : (
                                exams.map((exam) => (
                                    <TableRow key={exam.id}>
                                        <TableCell className="font-medium">{exam.name}</TableCell>
                                        <TableCell>{format(new Date(exam.date), 'MMM d, yyyy')}</TableCell>
                                        <TableCell className="capitalize">{exam.type}</TableCell>
                                        <TableCell>
                                            {exam.result ? (
                                                <Badge variant={exam.result.status === 'present' ? 'default' : 'destructive'}>
                                                    {exam.result.status}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">Upcoming</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>{exam.total_marks}</TableCell>
                                        <TableCell>
                                            {exam.result?.obtained_marks !== null && exam.result?.obtained_marks !== undefined
                                                ? exam.result.obtained_marks
                                                : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {exam.result?.percentage !== null && exam.result?.percentage !== undefined
                                                ? <span className="font-bold">{exam.result.percentage}%</span>
                                                : '-'}
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
