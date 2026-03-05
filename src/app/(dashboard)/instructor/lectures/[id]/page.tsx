"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

// Services
import { getLecture, completeLecture, LectureWithDetails } from "@/lib/services/lectures-service";
import { getLectureAttendance, bulkMarkAttendance, initializeLectureAttendance, StudentAttendanceRecord } from "@/lib/services/lecture-attendance-service";

export default function LectureAttendancePage() {
    const params = useParams();
    const router = useRouter();
    const [lecture, setLecture] = useState<LectureWithDetails | null>(null);
    const [attendance, setAttendance] = useState<StudentAttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!params.id) return;
            setLoading(true);
            const lId = params.id as string;

            // 1. Fetch Lecture Details
            const lData = await getLecture(lId);
            if (!lData) {
                toast.error("Lecture not found");
                router.push("/instructor/lectures");
                return;
            }
            setLecture(lData);

            // 2. Initialize Attendance if needed (first time open)
            // This ensures all students appear in the list even if no record exists yet
            if (lData.status === 'scheduled') {
                await initializeLectureAttendance(lId, lData.course_id, lData.semester, lData.section || undefined);
            }

            // 3. Fetch Attendance Records
            const attData = await getLectureAttendance(lId);
            setAttendance(attData);
            setLoading(false);
        };

        fetchDetails();
    }, [params.id, router]);

    const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'leave') => {
        setAttendance(prev => prev.map(record =>
            record.student_id === studentId ? { ...record, status } : record
        ));
    };

    const handleSave = async () => {
        if (!lecture) return;
        setSaving(true);

        // Save all records
        const success = await bulkMarkAttendance(
            lecture.id,
            attendance.map(a => ({ student_id: a.student_id, status: a.status }))
        );

        if (success) {
            // If it was scheduled, mark as completed
            if (lecture.status === 'scheduled') {
                await completeLecture(lecture.id);
                // Refresh status locally
                setLecture({ ...lecture, status: 'completed' });
            }
        }
        setSaving(false);
    };

    if (loading) return <div>Loading...</div>;
    if (!lecture) return <div>Not found</div>;

    // Calculate live stats
    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="cursor-pointer pl-0 hover:pl-2 transition-all"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lectures
                    </Button>
                    <div className="flex gap-2">
                        <Badge variant="outline" className="text-lg px-4 py-1">
                            Present: {present}/{total}
                        </Badge>
                        <Button onClick={handleSave} disabled={saving} className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer min-w-[120px]">
                            {saving ? 'Saving...' : (
                                <>
                                    <Save className="mr-2 h-4 w-4" /> Save Attendance
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader className="bg-muted/30 pb-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <Badge className="mb-2">{lecture.status.toUpperCase()}</Badge>
                                    <CardTitle className="text-2xl">{lecture.course?.code} - {lecture.course?.name}</CardTitle>
                                    <p className="text-muted-foreground mt-1">
                                        {new Date(lecture.date).toLocaleDateString()} • {lecture.time_start} - {lecture.time_end} • {lecture.room}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    <Card>
                        <CardContent className="p-0">
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm">
                                    <thead className="[&_tr]:border-b">
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Student Name</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Roll No / Email</th>
                                            <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground w-[400px]">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {attendance.map((record) => (
                                            <tr key={record.student_id} className="border-b transition-colors hover:bg-muted/50">
                                                <td className="p-4 align-middle font-medium">{record.student?.full_name}</td>
                                                <td className="p-4 align-middle text-muted-foreground">{record.student?.email}</td>
                                                <td className="p-4 align-middle">
                                                    <div className="flex justify-center">
                                                        <RadioGroup
                                                            value={record.status}
                                                            onValueChange={(val: any) => handleStatusChange(record.student_id, val)}
                                                            className="flex gap-4"
                                                        >
                                                            <div className="flex items-center space-x-2 bg-green-50 p-2 rounded-md border border-green-100 cursor-pointer hover:bg-green-100 transition-colors">
                                                                <RadioGroupItem value="present" id={`p-${record.student_id}`} className="text-green-600 border-green-600" />
                                                                <Label htmlFor={`p-${record.student_id}`} className="text-green-700 cursor-pointer font-medium">Present</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2 bg-red-50 p-2 rounded-md border border-red-100 cursor-pointer hover:bg-red-100 transition-colors">
                                                                <RadioGroupItem value="absent" id={`a-${record.student_id}`} className="text-red-600 border-red-600" />
                                                                <Label htmlFor={`a-${record.student_id}`} className="text-red-700 cursor-pointer font-medium">Absent</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2 bg-yellow-50 p-2 rounded-md border border-yellow-100 cursor-pointer hover:bg-yellow-100 transition-colors">
                                                                <RadioGroupItem value="late" id={`l-${record.student_id}`} className="text-yellow-600 border-yellow-600" />
                                                                <Label htmlFor={`l-${record.student_id}`} className="text-yellow-700 cursor-pointer font-medium">Late</Label>
                                                            </div>
                                                        </RadioGroup>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageWrapper>
    );
}
