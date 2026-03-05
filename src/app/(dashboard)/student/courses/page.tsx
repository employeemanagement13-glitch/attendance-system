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
import { Search, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getUserByEmail } from "@/lib/services/users-service";
import { getEnrollmentsWithComputedSections, EnrollmentWithDetails } from "@/lib/services/enrollments-service";

type EnrollmentWithSection = EnrollmentWithDetails & { computed_section: string };

export default function StudentCoursesPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [enrollments, setEnrollments] = useState<EnrollmentWithSection[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

            try {
                const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
                if (userData && userData.role === 'student') {
                    const data = await getEnrollmentsWithComputedSections(userData.id);
                    setEnrollments(data);
                }
            } catch (error) {
                console.error("Error loading courses:", error);
                toast.error("Failed to load courses");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isLoaded, user]);

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    const filteredEnrollments = enrollments.filter(e =>
        e.course?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.course?.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
                <p className="text-muted-foreground">Manage your enrolled courses</p>
            </div>

            <div className="flex items-center justify-between">
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

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course Code</TableHead>
                            <TableHead>Course Name</TableHead>
                            <TableHead>Credit Hours</TableHead>
                            <TableHead>Semester</TableHead>
                            <TableHead>Section</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEnrollments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">
                                    No courses found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredEnrollments.map((enrollment) => (
                                <TableRow
                                    key={enrollment.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => router.push(`/student/courses/${enrollment.course_id}`)}
                                >
                                    <TableCell className="font-medium">{enrollment.course?.code}</TableCell>
                                    <TableCell>{enrollment.course?.name}</TableCell>
                                    <TableCell>{enrollment.course?.credit_hours}</TableCell>
                                    <TableCell>{enrollment.semester}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono">
                                            {enrollment.computed_section}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={enrollment.status === 'enrolled' ? 'default' : 'secondary'}>
                                            {enrollment.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
