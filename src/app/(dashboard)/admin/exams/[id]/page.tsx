"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock, MapPin, Users, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Services
import { getExamdById, getExamResults, updateExamResults, ExamWithDetails } from "@/lib/services/exams-service";

export default function ExamDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [exam, setExam] = useState<ExamWithDetails | null>(null);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editedResults, setEditedResults] = useState<Record<string, { obtained_marks: number, status: string, remarks: string }>>({});

    useEffect(() => {
        fetchDetails();
    }, [params.id, router]);

    const fetchDetails = async () => {
        if (!params.id) return;
        setLoading(true);
        const eId = params.id as string;

        const [eData, rData] = await Promise.all([
            getExamdById(eId),
            getExamResults(eId)
        ]);

        if (!eData) {
            toast.error("Exam not found");
            router.push("/admin/exams");
            return;
        }

        setExam(eData);

        let finalResults = rData;
        if (!rData || rData.length === 0) {
            // Fallback: load enrolled students for this course
            const { getCourseStudents } = await import("@/lib/services/enrollments-service");
            const students = await getCourseStudents(eData.course_id);
            finalResults = students.map(s => ({
                student_id: s.id,
                student: s,
                status: 'absent',
                obtained_marks: 0,
                remarks: ""
            }));
        }

        setResults(finalResults);

        // Initialize edited state
        const initialEdits: any = {};
        finalResults.forEach((r: any) => {
            initialEdits[r.student_id] = {
                obtained_marks: r.obtained_marks || 0,
                status: r.status,
                remarks: r.remarks || ""
            };
        });
        setEditedResults(initialEdits);

        setLoading(false);
    };

    const handleResultChange = (studentId: string, field: string, value: any) => {
        setEditedResults(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        if (!exam) return;

        const updates = Object.keys(editedResults).map(studentId => ({
            student_id: studentId,
            obtained_marks: Number(editedResults[studentId].obtained_marks),
            status: editedResults[studentId].status as 'present' | 'absent',
            // remarks: editedResults[studentId].remarks // Service needs update to handle remarks if added later
        }));

        await updateExamResults(exam.id, updates);
        fetchDetails(); // Refresh to recalculate stats
    };

    const columns: ColumnDef<any>[] = [
        {
            id: "student_name",
            accessorKey: "student.full_name",
            header: "Student Name",
        },
        {
            accessorKey: "date",
            header: "Status",
            cell: ({ row }) => (
                <Select
                    value={editedResults[row.original.student_id]?.status || row.original.status}
                    onValueChange={(val) => handleResultChange(row.original.student_id, 'status', val)}
                >
                    <SelectTrigger className="w-[110px] h-8">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                    </SelectContent>
                </Select>
            )
        },
        {
            accessorKey: "obtained_marks",
            header: `Marks (/${exam?.total_marks || 100})`,
            cell: ({ row }) => (
                <Input
                    type="number"
                    className="h-8 w-24"
                    value={editedResults[row.original.student_id]?.obtained_marks}
                    onChange={(e) => handleResultChange(row.original.student_id, 'obtained_marks', e.target.value)}
                    max={exam?.total_marks}
                />
            )
        },
        {
            id: "percentage",
            header: "Percentage",
            cell: ({ row }) => {
                const marks = editedResults[row.original.student_id]?.obtained_marks || 0;
                const total = exam?.total_marks || 100;
                const percentage = ((marks / total) * 100).toFixed(1);
                return (
                    <Badge variant={Number(percentage) < 50 ? "destructive" : "secondary"}>
                        {percentage}%
                    </Badge>
                );
            }
        }
    ];

    if (loading) return <div>Loading...</div>;
    if (!exam) return <div>Not found</div>;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => router.back()} className="pl-0 hover:pl-2">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams
                </Button>

                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{exam.course?.code} | {exam.name}</h1>
                        <p className="text-muted-foreground">{exam.discipline?.name} - {exam.course?.name}</p>
                    </div>
                    <Button onClick={handleSave} className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white">
                        <Save className="mr-2 h-4 w-4" /> Save Results
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Date</CardTitle>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <CalendarIcon /> {new Date(exam.date).toLocaleDateString()}
                            </div>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Time</CardTitle>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <Clock className="h-4 w-4" /> {exam.time_start} - {exam.time_end}
                            </div>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Venue</CardTitle>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <MapPin className="h-4 w-4" /> {exam.room || "TBD"}
                            </div>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <Users className="h-4 w-4" /> {results.length}
                            </div>
                        </CardHeader>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Attendance & Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable columns={columns} data={results} searchKey="student_name" filename={`exam_results_${exam.id}`} />
                    </CardContent>
                </Card>
            </div>
        </PageWrapper>
    );
}

function CalendarIcon() {
    return (
        <svg
            className=" h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )
}
