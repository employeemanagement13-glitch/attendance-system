"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { getLowAttendanceStudents } from "@/lib/services/users-service";

// Types
type LowAttendanceStudent = {
    id: string;
    name: string;
    course: string;
    facultyPerson: string;
    presents: number;
    absents: number;
    percentage: number;
    leaves: number;
};

export default function LowAttendanceStudentsPage() {
    const [students, setStudents] = useState<LowAttendanceStudent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const data = await getLowAttendanceStudents(75);
            // Map the RPC response to our type
            const mapped: LowAttendanceStudent[] = (data || []).map((s: any) => ({
                id: s.student_id || s.id || "",
                name: s.student_name || s.full_name || s.name || "Unknown",
                course: s.course_name || s.course || "N/A",
                facultyPerson: s.instructor_name || s.faculty || "N/A",
                presents: s.present_count || s.presents || 0,
                absents: s.absent_count || s.absents || 0,
                percentage: s.attendance_percentage || s.percentage || 0,
                leaves: s.leave_count || s.leaves || 0,
            }));
            setStudents(mapped);
        } catch (error) {
            console.error("Error fetching low attendance students:", error);
            toast.error("Failed to load low attendance data");
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveFromLowAttendance = (id: string) => {
        setStudents(prev => prev.filter(s => s.id !== id));
        toast.success("Student removed from warning list");
    };

    // Columns
    const columns: ColumnDef<LowAttendanceStudent>[] = [
        {
            accessorKey: "id",
            header: "ID",
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.id.slice(0, 8)}</span>
        },
        { accessorKey: "name", header: "Name" },
        { accessorKey: "course", header: "Course" },
        { accessorKey: "facultyPerson", header: "Faculty Person" },
        {
            accessorKey: "presents",
            header: "Presents",
            cell: ({ row }) => <span className="text-green-600 font-medium">{row.getValue("presents")}</span>
        },
        {
            accessorKey: "absents",
            header: "Absents",
            cell: ({ row }) => <span className="text-red-600 font-medium">{row.getValue("absents")}</span>
        },
        {
            accessorKey: "percentage",
            header: "Percentage",
            cell: ({ row }) => {
                const percentage = row.getValue("percentage") as number;
                return (
                    <Badge
                        variant={percentage < 75 ? "destructive" : "default"}
                        className={percentage < 75 ? "bg-red-500" : "bg-green-500"}
                    >
                        {percentage}%
                    </Badge>
                );
            }
        },
        {
            accessorKey: "leaves",
            header: "Leaves",
            cell: ({ row }) => <span className="font-medium">{row.getValue("leaves")}</span>
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemoveFromLowAttendance(row.original.id)}
                >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                </Button>
            ),
        },
    ];

    return (
        <PageWrapper>
            <div className="space-y-6 p-1">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Low Attendance Students</h1>
                    <p className="text-muted-foreground mt-1">
                        Students with attendance below the threshold (75%)
                    </p>
                </div>

                <Card className="bg-white/50 border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Students Requiring Attention</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            columns={columns}
                            data={students}
                            searchKey="name"
                            filename="low_attendance_students"
                        />
                    </CardContent>
                </Card>

                {students.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No students with low attendance found.</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            All students are meeting the attendance requirements.
                        </p>
                    </div>
                )}
            </div>
        </PageWrapper>
    );
}
