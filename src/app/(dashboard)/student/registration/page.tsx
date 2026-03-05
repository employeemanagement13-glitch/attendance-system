"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getUserByEmail } from "@/lib/services/users-service";
import { getCourses, CourseWithDetails } from "@/lib/services/courses-service";
import {
    getEnrollmentsByStudent,
    createEnrollment,
    EnrollmentWithDetails
} from "@/lib/services/enrollments-service";

export default function CourseRegistrationPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<CourseWithDetails[]>([]);
    const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
    const [userData, setUserData] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [enrollingId, setEnrollingId] = useState<string | null>(null);

    const fetchData = async () => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

        try {
            const userDetails = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (userDetails && userDetails.role === 'student') {
                setUserData(userDetails);

                // Fetch all courses and existing enrollments
                const [allCourses, myEnrollments] = await Promise.all([
                    getCourses(),
                    getEnrollmentsByStudent(userDetails.id)
                ]);

                setCourses(allCourses);
                setEnrolledCourseIds(new Set(myEnrollments.map(e => e.course_id)));
            }
        } catch (error) {
            console.error("Error loading registration:", error);
            toast.error("Failed to load available courses");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isLoaded, user]);

    const handleEnroll = async (course: CourseWithDetails) => {
        if (!userData) return;

        // Basic validation
        if (course.discipline_id !== userData.discipline_id) {
            // Allow but warn? Or strict? 
            // Spec implies selecting faculty, maybe strict discipline not required for electives?
            // For now, let's allow but maybe show a note if needed.
        }

        try {
            setEnrollingId(course.id);
            if (enrolledCourseIds.size >= 8) {
                toast.error("You cannot enroll in more than 8 courses");
                return;
            }

            const result = await createEnrollment({
                student_id: userData.id,
                course_id: course.id,
                semester: userData.semester || course.semester,
                section: userData.section
            });

            if (result) {
                setEnrolledCourseIds(prev => new Set(prev).add(course.id));
                // Update local seat count to reflect change immediately?
                setCourses(prev => prev.map(c =>
                    c.id === course.id
                        ? { ...c, students_count: (c.students_count || 0) + 1 }
                        : c
                ));
            }
        } catch (error) {
            console.error("Enrollment error:", error);
        } finally {
            setEnrollingId(null);
        }
    };

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    // Filter Logic:
    // 1. Search query
    // 2. Discipline match (optional, but good UX to show relevant first)
    // 3. Not already enrolled? Or show as "Enrolled" disabled button. 
    //    Current logic: Show all, button state changes.

    const filteredCourses = courses.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort: Enrolled last, then by matching discipline, then name
    filteredCourses.sort((a, b) => {
        const aEnrolled = enrolledCourseIds.has(a.id);
        const bEnrolled = enrolledCourseIds.has(b.id);
        if (aEnrolled && !bEnrolled) return 1;
        if (!aEnrolled && bEnrolled) return -1;

        // Prioritize student's discipline
        if (userData?.discipline_id) {
            if (a.discipline_id === userData.discipline_id && b.discipline_id !== userData.discipline_id) return -1;
            if (a.discipline_id !== userData.discipline_id && b.discipline_id === userData.discipline_id) return 1;
        }

        return a.name.localeCompare(b.name);
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Course Registration</h1>
                <p className="text-muted-foreground">Browse and enroll in available courses</p>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative w-72">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search courses..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-100 rounded-lg">
                    <span className="text-sm font-medium text-orange-800">Courses Selected:</span>
                    <Badge variant={enrolledCourseIds.size === 8 ? "destructive" : "secondary"} className="font-bold">
                        {enrolledCourseIds.size} / 8
                    </Badge>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course Code</TableHead>
                            <TableHead>Course Name</TableHead>
                            <TableHead>Discipline</TableHead>
                            <TableHead>Instructor</TableHead>
                            <TableHead>Seats Filled</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCourses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                    No courses found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCourses.map((course) => {
                                const isEnrolled = enrolledCourseIds.has(course.id);
                                const isFull = (course.students_count || 0) >= 500;
                                const isProcessing = enrollingId === course.id;

                                return (
                                    <TableRow key={course.id}>
                                        <TableCell className="font-medium">{course.code}</TableCell>
                                        <TableCell>{course.name}</TableCell>
                                        <TableCell>{course.discipline?.name}</TableCell>
                                        <TableCell>{course.instructor?.full_name || 'TBD'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={isFull ? "destructive" : "secondary"}>
                                                    {course.students_count || 0} / 500
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isEnrolled ? (
                                                <Button size="sm" variant="secondary" disabled>
                                                    Enrolled
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleEnroll(course)}
                                                    disabled={isFull || isProcessing}
                                                >
                                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enroll"}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div >
    );
}
