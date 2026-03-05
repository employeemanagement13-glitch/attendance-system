"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
    ArrowLeft, Plus, Mail, MapPin, GraduationCap, UserCircle,
    CalendarPlus, BookOpen, Edit, Trash2, X, RefreshCcw, Eye, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// Services
import { getCourse, CourseWithDetails } from "@/lib/services/courses-service";
import { getLecturesByCourse, LectureWithDetails } from "@/lib/services/lectures-service";
import { getExamsByCourse, Exam } from "@/lib/services/exams-service";
import { getUser, User } from "@/lib/services/users-service";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, addWeeks, parseISO, isBefore, isSameDay } from "date-fns";

type LectureForm = {
    date: string;
    time_start: string;
    time_end: string;
    room: string;
};

type AttendanceRecord = {
    id: string;
    student_id: string;
    status: string;
    student: { full_name: string; email: string } | null;
};

const emptyForm: LectureForm = { date: "", time_start: "", time_end: "", room: "" };

export default function CourseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [course, setCourse] = useState<CourseWithDetails | null>(null);
    const [faculty, setFaculty] = useState<User | null>(null);
    const [lectures, setLectures] = useState<LectureWithDetails[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [missedClasses, setMissedClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog state
    const [addOpen, setAddOpen] = useState(false);
    const [editLecture, setEditLecture] = useState<LectureWithDetails | null>(null);
    const [form, setForm] = useState<LectureForm>(emptyForm);
    const [saving, setSaving] = useState(false);

    // Attendance view dialog
    const [attendanceOpen, setAttendanceOpen] = useState(false);
    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
    const [attendanceLecture, setAttendanceLecture] = useState<LectureWithDetails | null>(null);
    const [loadingAttendance, setLoadingAttendance] = useState(false);

    // Bulk state
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkForm, setBulkForm] = useState({
        startDate: "",
        endDate: "",
        days: [] as string[],
        timeStart: "09:00",
        timeEnd: "11:00",
        room: ""
    });

    const courseId = params.id as string;

    const fetchDetails = async () => {
        if (!courseId) return;
        setLoading(true);
        try {
            const [cData, lData, eData] = await Promise.all([
                getCourse(courseId),
                getLecturesByCourse(courseId),
                getExamsByCourse(courseId)
            ]);

            if (!cData) {
                toast.error("Course not found");
                router.push("/admin/courses");
                return;
            }

            setCourse(cData);
            setLectures(lData.filter(l => l.status !== 'cancelled'));
            setExams(eData);
            setMissedClasses(lData.filter(l => l.status === 'cancelled'));

            if (cData.instructor_id) {
                const fData = await getUser(cData.instructor_id);
                setFaculty(fData);
            }
        } catch (error) {
            console.error("Error fetching course details:", error);
            toast.error("Failed to load details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDetails(); }, [courseId]);

    const openAdd = () => { setForm(emptyForm); setEditLecture(null); setAddOpen(true); };
    const openEdit = (lec: LectureWithDetails) => {
        setEditLecture(lec);
        setForm({
            date: lec.date || "",
            time_start: lec.time_start || "",
            time_end: lec.time_end || "",
            room: (lec as any).room || ""
        });
        setAddOpen(true);
    };

    const viewAttendance = async (lec: LectureWithDetails) => {
        setAttendanceLecture(lec);
        setLoadingAttendance(true);
        setAttendanceOpen(true);

        try {
            const { data, error } = await supabase
                .from('lecture_attendance')
                .select('id, student_id, status, student:users!student_id(full_name, email)')
                .eq('lecture_id', lec.id)
                .order('status');

            if (error) throw error;
            setAttendanceData((data || []) as unknown as AttendanceRecord[]);
        } catch (error) {
            console.error("Error fetching attendance:", error);
            toast.error("Failed to load attendance");
            setAttendanceData([]);
        } finally {
            setLoadingAttendance(false);
        }
    };

    const handleSave = async () => {
        if (!form.date || !form.time_start || !form.time_end) {
            toast.error("Please fill in all required fields");
            return;
        }
        setSaving(true);
        try {
            if (editLecture) {
                // Update existing lecture
                const { error, data } = await supabase
                    .from('lectures')
                    .update({
                        date: form.date,
                        time_start: form.time_start,
                        time_end: form.time_end,
                        room: form.room,
                        semester: course?.semester || 1,
                        section: course?.section || 'A'
                    })
                    .eq('id', editLecture.id)
                    .select();
                if (error) {
                    console.error("Update lecture error:", error);
                    throw error;
                }
                toast.success("Lecture updated");
            } else {
                // Create new lecture
                const payload = {
                    course_id: courseId,
                    instructor_id: course?.instructor_id || null,
                    date: form.date,
                    time_start: form.time_start,
                    time_end: form.time_end,
                    room: form.room,
                    semester: course?.semester || 1,
                    section: course?.section || 'A',
                    status: 'scheduled'
                };
                console.log("Creating lecture single payload:", payload);
                const { error, data } = await supabase
                    .from('lectures')
                    .insert(payload)
                    .select();
                if (error) {
                    console.error("Create lecture error:", error);
                    throw error;
                }
                toast.success("Lecture scheduled successfully");
            }
            setAddOpen(false);
            fetchDetails();
        } catch (err: any) {
            console.error("handleSave Error:", err);
            toast.error(err?.message || "Failed to save lecture");
        } finally {
            setSaving(false);
        }
    };

    const handleBulkSave = async () => {
        if (!bulkForm.startDate || !bulkForm.endDate || bulkForm.days.length === 0) {
            toast.error("Please fill in all fields and select at least one day");
            return;
        }

        if (!course?.instructor_id) {
            toast.error("This course has no assigned instructor. Please assign one first.");
            return;
        }

        setSaving(true);
        try {
            const start = parseISO(bulkForm.startDate);
            const end = parseISO(bulkForm.endDate);
            const lecturesToCreate = [];
            const conflictedDates: string[] = [];

            let current = start;
            while (isBefore(current, end) || isSameDay(current, end)) {
                const dayName = format(current, 'EEEE');
                if (bulkForm.days.includes(dayName)) {
                    // Check for conflicts
                    const { data: conflicts } = await supabase
                        .from('lectures')
                        .select('id')
                        .eq('instructor_id', course?.instructor_id)
                        .eq('date', format(current, 'yyyy-MM-dd'))
                        .lt('time_start', bulkForm.timeEnd)
                        .gt('time_end', bulkForm.timeStart);

                    if (conflicts && conflicts.length > 0) {
                        conflictedDates.push(format(current, 'dd/MM/yyyy'));
                    } else {
                        lecturesToCreate.push({
                            course_id: courseId,
                            instructor_id: course?.instructor_id,
                            date: format(current, 'yyyy-MM-dd'),
                            time_start: bulkForm.timeStart,
                            time_end: bulkForm.timeEnd,
                            room: bulkForm.room,
                            semester: course?.semester,
                            section: course?.section || 'A',
                            status: 'scheduled'
                        });
                    }
                }
                current = addDays(current, 1);
            }

            if (lecturesToCreate.length === 0) {
                toast.error("No lectures to schedule (Check date range and days)");
                return;
            }

            console.log("Creating bulk lectures payload:", lecturesToCreate);
            const { error, data } = await supabase.from('lectures').insert(lecturesToCreate).select();
            if (error) {
                console.error("Bulk create lecture error:", error);
                throw error;
            }

            let successMsg = `Successfully scheduled ${lecturesToCreate.length} lectures.`;
            if (conflictedDates.length > 0) {
                successMsg += ` ${conflictedDates.length} days skipped due to conflicts.`;
            }
            toast.success(successMsg);
            setBulkOpen(false);
            fetchDetails();
        } catch (error: any) {
            console.error("handleBulkSave Error:", error);
            toast.error(error?.message || "Bulk scheduling failed");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this lecture?")) return;
        const { error } = await supabase.from('lectures').delete().eq('id', id);
        if (error) {
            toast.error("Failed to delete lecture");
        } else {
            toast.success("Lecture deleted");
            fetchDetails();
        }
    };

    const statusBadge = (status: string) => {
        const colorMap: Record<string, string> = {
            scheduled: "bg-blue-100 text-blue-700",
            completed: "bg-green-100 text-green-700",
            cancelled: "bg-red-100 text-red-700",
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colorMap[status] || "bg-gray-100 text-gray-600"}`}>
                {status}
            </span>
        );
    };

    const attendanceColumns: ColumnDef<AttendanceRecord>[] = [
        { id: "sr", header: "#", cell: ({ row }) => row.index + 1, size: 50 },
        {
            id: "student_name",
            header: "Student Name",
            cell: ({ row }) => row.original.student?.full_name || "Unknown"
        },
        {
            id: "student_email",
            header: "Email",
            cell: ({ row }) => row.original.student?.email || "—"
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status;
                const colorMap: Record<string, string> = {
                    present: "bg-green-100 text-green-700",
                    absent: "bg-red-100 text-red-700",
                    late: "bg-yellow-100 text-yellow-700",
                    excused: "bg-blue-100 text-blue-700",
                    leave: "bg-purple-100 text-purple-700",
                };
                return (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colorMap[status] || "bg-gray-100 text-gray-600"}`}>
                        {status}
                    </span>
                );
            }
        }
    ];

    const lectureColumns: ColumnDef<LectureWithDetails>[] = [
        { id: "sr", header: "#", cell: ({ row }) => row.index + 1, size: 50 },
        { accessorKey: "date", header: "Date" },
        { accessorKey: "time_start", header: "Start" },
        { accessorKey: "time_end", header: "End" },
        { id: "room", header: "Room", cell: ({ row }) => (row.original as any).room || "—" },
        { id: "status", header: "Status", cell: ({ row }) => statusBadge(row.original.status) },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const isCompleted = row.original.status === 'completed';
                return (
                    <div className="flex gap-2">
                        {/* Eye button — only for completed lectures */}
                        {isCompleted && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="cursor-pointer text-black"
                                onClick={() => viewAttendance(row.original)}
                                title="View Attendance"
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        )}
                        {/* Edit button — disabled for completed lectures */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-black hover:bg-gray-100 cursor-pointer"
                            onClick={() => openEdit(row.original)}
                            disabled={isCompleted}
                            title={isCompleted ? "Cannot edit completed lecture" : "Edit Lecture"}
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        {/* Delete button — disabled for completed lectures  */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 cursor-pointer"
                            onClick={() => handleDelete(row.original.id)}
                            disabled={isCompleted}
                            title={isCompleted ? "Cannot delete completed lecture" : "Delete Lecture"}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                );
            }
        }
    ];

    const missedColumns: ColumnDef<any>[] = [
        { id: "sr", header: "#", cell: ({ row }) => row.index + 1, size: 50 },
        { accessorKey: "date", header: "Date" },
        { accessorKey: "time_start", header: "Time" },
        { id: "reason", header: "Reason", cell: ({ row }) => row.original.cancelled_reason || "Not specified" }
    ];

    const examColumns: ColumnDef<Exam>[] = [
        { id: "sr", header: "#", cell: ({ row }) => row.index + 1, size: 50 },
        { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge className="capitalize bg-[#FF8020]">{row.original.type}</Badge> },
        { accessorKey: "date", header: "Date" },
        { accessorKey: "room", header: "Venue" },
        { accessorKey: "time_start", header: "Time" },
        {
            id: "actions",
            cell: ({ row }) => (
                <Button variant="ghost" size="sm" className="text-[#FF8020] cursor-pointer" onClick={() => router.push(`/admin/exams/${row.original.id}`)}>
                    View
                </Button>
            )
        }
    ];

    if (loading) return <div className="p-8 text-center">Loading course details...</div>;
    if (!course) return <div className="p-8 text-red-500 text-center">Course not found</div>;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => router.back()} className="cursor-pointer pl-0 hover:pl-2">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Courses
                </Button>

                {/* Course Info + Faculty */}
                <div className="grid gap-6 md:grid-cols-3">
                    <Card className="md:col-span-2 border-none shadow-sm bg-linear-to-br from-[#FF8020]/5 to-white">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <Badge className="bg-[#FF8020]">{course.code}</Badge>
                                <CardTitle className="text-2xl font-bold">{course.name}</CardTitle>
                            </div>
                            <CardDescription className="flex gap-4 flex-wrap text-sm pt-1">
                                <span><BookOpen className="inline h-3.5 w-3.5 mr-1" />{course.discipline?.name}</span>
                                <span>Semester {course.semester}</span>
                                <span>Section {course.code + 'A'}</span>
                                <span>Credits: {course.credit_hours}</span>
                                <span>Days: {Array.isArray(course.active_days) ? course.active_days.join(', ') : course.active_days || '—'}</span>
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    <Card className="border-none shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <UserCircle className="h-5 w-5 text-[#FF8020]" />
                                Faculty
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-[#FF8020]/10 flex items-center justify-center text-[#FF8020] font-bold text-lg">
                                    {course.instructor?.full_name?.[0] || "?"}
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">{course.instructor?.full_name || "Unassigned"}</div>
                                    <div className="text-xs text-muted-foreground">{faculty?.designation || "Faculty Member"}</div>
                                </div>
                            </div>
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2"><Mail className="h-3 w-3" />{course.instructor?.email || "—"}</div>
                                <div className="flex items-center gap-2"><MapPin className="h-3 w-3" />{faculty?.office_location || "—"}</div>
                                <div className="flex items-center gap-2"><GraduationCap className="h-3 w-3" />{faculty?.education || "—"}</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Lectures — Admin can add/edit/delete */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">Lectures | {course.code}</h2>
                        <div className="flex gap-2">
                            <Button variant="outline" className="border-[#FF8020] text-[#FF8020] hover:bg-orange-50 cursor-pointer" onClick={() => setBulkOpen(true)}>
                                <CalendarPlus className="mr-2 h-4 w-4" /> Bulk Week
                            </Button>
                            <Button className="bg-[#FF8020] hover:bg-[#E6721C] cursor-pointer" onClick={openAdd}>
                                <Plus className="mr-2 h-4 w-4" /> One-off
                            </Button>
                        </div>
                    </div>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-4">
                            <DataTable columns={lectureColumns} data={lectures} searchKey="date" filename={`${course.code}_lectures`} />
                        </CardContent>
                    </Card>
                </div>

                {/* Missed/Cancelled Classes */}
                {missedClasses.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-red-600">Cancelled Classes</h2>
                        <Card className="border-none shadow-sm">
                            <CardContent className="p-4">
                                <DataTable columns={missedColumns} data={missedClasses} searchKey="date" filename={`${course.code}_cancelled`} />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Exams */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold">Exams | {course.code}</h2>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-4">
                            <DataTable columns={examColumns} data={exams} searchKey="type" filename={`${course.code}_exams`} />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Add / Edit Lecture Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarPlus className="h-5 w-5 text-[#FF8020]" />
                            {editLecture ? "Edit Lecture" : "Schedule New Lecture"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Date *</Label>
                            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Time *</Label>
                                <Input type="time" value={form.time_start} onChange={e => setForm(f => ({ ...f, time_start: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Time *</Label>
                                <Input type="time" value={form.time_end} onChange={e => setForm(f => ({ ...f, time_end: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Room</Label>
                            <Input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. SST-301" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button className="bg-[#FF8020] hover:bg-[#E6721C]" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {saving ? "Saving..." : editLecture ? "Update Lecture" : "Schedule Lecture"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Schedule Dialog */}
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarPlus className="h-5 w-5 text-[#FF8020]" />
                            Schedule Weekly Lectures
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input type="date" value={bulkForm.startDate} onChange={e => setBulkForm(f => ({ ...f, startDate: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input type="date" value={bulkForm.endDate} onChange={e => setBulkForm(f => ({ ...f, endDate: e.target.value }))} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Repeat on Days</Label>
                            <div className="flex flex-wrap gap-3 p-3 bg-muted/30 rounded-lg">
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                                    <div key={day} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`day-${day}`}
                                            checked={bulkForm.days.includes(day)}
                                            onCheckedChange={(checked) => {
                                                setBulkForm(f => ({
                                                    ...f,
                                                    days: checked
                                                        ? [...f.days, day]
                                                        : f.days.filter(d => d !== day)
                                                }));
                                            }}
                                        />
                                        <label htmlFor={`day-${day}`} className="text-sm font-medium leading-none cursor-pointer">
                                            {day.substring(0, 3)}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Time</Label>
                                <Input type="time" value={bulkForm.timeStart} onChange={e => setBulkForm(f => ({ ...f, timeStart: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Time</Label>
                                <Input type="time" value={bulkForm.timeEnd} onChange={e => setBulkForm(f => ({ ...f, timeEnd: e.target.value }))} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Room</Label>
                            <Input value={bulkForm.room} onChange={e => setBulkForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Lab 1" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                        <Button className="bg-[#FF8020] hover:bg-[#E6721C]" onClick={handleBulkSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {saving ? "Scheduling..." : "Create Lectures"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Attendance View Dialog */}
            <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5 text-black" />
                            Lecture Attendance — {attendanceLecture?.date}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        {loadingAttendance ? (
                            <div className="text-center py-8 text-muted-foreground">Loading attendance...</div>
                        ) : attendanceData.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No attendance records found for this lecture.</div>
                        ) : (
                            <>
                                <div className="flex gap-4 mb-4 text-sm">
                                    <Badge variant="default" className="bg-green-600">
                                        Present: {attendanceData.filter(a => a.status === 'present').length}
                                    </Badge>
                                    <Badge variant="destructive">
                                        Absent: {attendanceData.filter(a => a.status === 'absent').length}
                                    </Badge>
                                    <Badge variant="outline">
                                        Late: {attendanceData.filter(a => a.status === 'late').length}
                                    </Badge>
                                    <Badge variant="secondary">
                                        Total: {attendanceData.length}
                                    </Badge>
                                </div>
                                <DataTable
                                    columns={attendanceColumns}
                                    data={attendanceData}
                                    searchKey="student_name"
                                    filename={`attendance_${attendanceLecture?.date}`}
                                />
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </PageWrapper>
    );
}
