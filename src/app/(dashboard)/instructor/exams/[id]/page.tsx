"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
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
    SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Edit, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
    getExamdById,
    getExamResultsWithAllStudents,
    getExamDayLectureAttendance,
    updateExamResults,
    ExamWithDetails,
    ExamResult
} from "@/lib/services/exams-service";

type ExtendedExamResult = ExamResult & {
    student?: { id: string; full_name: string; email: string };
    _isPlaceholder?: boolean;
    _lectureStatus?: string; // synced from lecture attendance
};

export default function ExamDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isLoaded } = useUser();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exam, setExam] = useState<ExamWithDetails | null>(null);
    const [results, setResults] = useState<ExtendedExamResult[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{
        obtained_marks: string;
        status: 'present' | 'absent';
    }>({ obtained_marks: "", status: 'present' });

    const fetchData = async () => {
        if (!params.id) return;

        try {
            const examData = await getExamdById(params.id as string);
            setExam(examData);

            if (!examData) {
                setLoading(false);
                return;
            }

            // Fetch all enrolled students merged with exam results
            const allStudentResults = await getExamResultsWithAllStudents(params.id as string);

            // Fetch lecture attendance for the exam date to sync status
            const lectureAttendance = await getExamDayLectureAttendance(
                examData.course_id,
                examData.date
            );

            // Merge lecture attendance into the results
            const enrichedResults = allStudentResults.map((result: any) => {
                const lectureStatus = lectureAttendance.get(result.student_id);

                // If student has a placeholder (no exam result row) and lecture attendance exists,
                // sync the status from lecture attendance
                if (result._isPlaceholder && lectureStatus) {
                    return {
                        ...result,
                        status: lectureStatus === 'present' || lectureStatus === 'late' ? 'present' : 'absent',
                        _lectureStatus: lectureStatus
                    };
                }

                return {
                    ...result,
                    _lectureStatus: lectureStatus || undefined
                };
            });

            setResults(enrichedResults as ExtendedExamResult[]);
        } catch (error) {
            console.error("Error loading exam details:", error);
            toast.error("Failed to load exam details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isLoaded && user) fetchData();
    }, [isLoaded, user, params.id]);

    const handleEdit = (result: ExtendedExamResult) => {
        // Don't allow editing marks for absent students
        setEditingId(result.id);
        setEditForm({
            obtained_marks: result.obtained_marks?.toString() || "",
            status: result.status as 'present' | 'absent'
        });
    };

    const handleSaveRow = async (studentId: string) => {
        try {
            setSaving(true);
            const marks = parseFloat(editForm.obtained_marks) || 0;

            if (editForm.status === 'present' && editForm.obtained_marks && (isNaN(marks) || marks < 0 || (exam && marks > exam.total_marks))) {
                toast.error("Invalid marks entered");
                setSaving(false);
                return;
            }

            await updateExamResults(exam!.id, [{
                student_id: studentId,
                obtained_marks: editForm.status === 'absent' ? 0 : (editForm.obtained_marks ? marks : 0),
                status: editForm.status
            }]);

            // Re-fetch data to ensures everything (Lecture Attendance, Total Marks, etc.) is synced from DB
            await fetchData();

            setEditingId(null);
            toast.success("Saved");
        } catch (error) {
            console.error("Error saving result:", error);
            toast.error("Failed to save result");
        } finally {
            setSaving(false);
        }
    };

    // Filter results
    const filteredResults = results.filter(r =>
        r.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.student?.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Stats
    const totalStudents = results.length;
    const presentStudents = results.filter(r => r.status === 'present').length;
    const absentStudents = results.filter(r => r.status === 'absent').length;

    if (loading) return <div className="p-8">Loading...</div>;
    if (!exam) return <div className="p-8">Exam not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {exam.course?.name} | {exam.type === 'mids' ? 'Mid Term' : exam.type === 'finals' ? 'Final Exam' : 'Quiz'}
                    </h1>
                    <p className="text-muted-foreground">
                        {format(new Date(exam.date), 'MMMM d, yyyy')} • Total Marks: {exam.total_marks}
                    </p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="flex gap-4">
                <Badge variant="outline" className="text-base px-4 py-1.5 border-orange-200 text-orange-700 bg-orange-50">
                    Total Enrolled: {totalStudents}
                </Badge>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-base px-4 py-1.5 border border-green-200">
                    Present: {presentStudents}
                </Badge>
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-base px-4 py-1.5 border border-red-200">
                    Absent: {absentStudents}
                </Badge>
            </div>

            <div className="flex items-center justify-between">
                <div className="relative w-72">
                    <Input
                        placeholder="Search student..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button onClick={() => fetchData()} variant="outline">
                    Refresh List
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student Name</TableHead>
                            <TableHead>ID</TableHead>
                            <TableHead>Lecture Attendance</TableHead>
                            <TableHead>Exam Status</TableHead>
                            <TableHead>Total Marks</TableHead>
                            <TableHead>Obtained Marks</TableHead>
                            <TableHead>Percentage</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredResults.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8">
                                    No students found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredResults.map((result) => {
                                const isEditing = editingId === result.id;
                                const isAbsent = isEditing ? editForm.status === 'absent' : result.status === 'absent';

                                return (
                                    <TableRow key={result.id} className={result._isPlaceholder ? "bg-muted/20" : ""}>
                                        <TableCell className="font-medium">
                                            {result.student?.full_name}
                                            {result._isPlaceholder && (
                                                <span className="ml-2 text-xs text-amber-600" title="No exam result record exists yet">
                                                    <AlertCircle className="h-3 w-3 inline" />
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {result.student?.email?.split('@')[0]}
                                        </TableCell>
                                        <TableCell>
                                            {result._lectureStatus ? (
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        result._lectureStatus === 'present'
                                                            ? 'border-green-200 text-green-700 bg-green-50'
                                                            : result._lectureStatus === 'late'
                                                                ? 'border-yellow-200 text-yellow-700 bg-yellow-50'
                                                                : 'border-red-200 text-red-700 bg-red-50'
                                                    }
                                                >
                                                    {result._lectureStatus}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">No lecture</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <Select
                                                    value={editForm.status}
                                                    onValueChange={(val: 'present' | 'absent') =>
                                                        setEditForm({ ...editForm, status: val, obtained_marks: val === 'absent' ? '' : editForm.obtained_marks })
                                                    }
                                                >
                                                    <SelectTrigger className="w-28">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="present">Present</SelectItem>
                                                        <SelectItem value="absent">Absent</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Badge variant={result.status === 'present' ? 'default' : 'destructive'}>
                                                    {result.status}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>{result.total_marks}</TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    className="w-24 border-orange-200 focus-visible:ring-[#FF8020]"
                                                    value={editForm.obtained_marks}
                                                    onChange={(e) => setEditForm({ ...editForm, obtained_marks: e.target.value })}
                                                    disabled={editForm.status === 'absent'}
                                                    placeholder={editForm.status === 'absent' ? '-' : '0'}
                                                />
                                            ) : (
                                                <span className={isAbsent ? "text-muted-foreground italic" : ""}>
                                                    {isAbsent ? "-" : (result.obtained_marks ?? "-")}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {result.status === 'absent'
                                                ? '-'
                                                : result.percentage !== null ? `${result.percentage}%` : '-'
                                            }
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isEditing ? (
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSaveRow(result.student_id)}
                                                        disabled={saving}
                                                        className="bg-orange-500 hover:bg-orange-600 text-white"
                                                    >
                                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-black hover:bg-gray-100 cursor-pointer"
                                                    onClick={() => handleEdit(result)}
                                                >
                                                    <Edit className="h-4 w-4" />
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
        </div>
    );
}
