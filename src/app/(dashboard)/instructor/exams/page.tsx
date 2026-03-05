"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Calendar, UserCheck, ArrowRight, Edit, Trash2, GraduationCap, BarChart3, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getUserByEmail } from "@/lib/services/users-service";
import { getCoursesByInstructor, CourseWithDetails } from "@/lib/services/courses-service";
import { getExams, createExam, updateExam, deleteExam, ExamWithDetails, ExamType } from "@/lib/services/exams-service";
import { Badge } from "@/components/ui/badge";

export default function InstructorExamsPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [exams, setExams] = useState<ExamWithDetails[]>([]);
    const [courses, setCourses] = useState<CourseWithDetails[]>([]);
    const [instructorId, setInstructorId] = useState<string | null>(null);

    // Create/Edit form state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingExam, setEditingExam] = useState<ExamWithDetails | null>(null);

    const defaultExamForm = {
        name: "",
        course_id: "",
        type: "mids" as ExamType,
        date: format(new Date(), 'yyyy-MM-dd'),
        time_start: "09:00",
        time_end: "12:00",
        total_marks: 100,
        room: ""
    };

    const [newExam, setNewExam] = useState(defaultExamForm);
    const [editForm, setEditForm] = useState(defaultExamForm);

    const fetchData = async () => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

        try {
            const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (userData && userData.role === 'instructor') {
                setInstructorId(userData.id);

                const [coursesData, examsData] = await Promise.all([
                    getCoursesByInstructor(userData.id),
                    getExams()
                ]);

                setCourses(coursesData);

                const courseIds = coursesData.map(c => c.id);
                const instructorExams = examsData.filter(e => courseIds.includes(e.course_id));

                setExams(instructorExams);
            }
        } catch (error) {
            console.error("Error fetching exams:", error);
            toast.error("Failed to load exams");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isLoaded, user]);

    const handleCreateExam = async () => {
        if (!newExam.course_id || !newExam.name) {
            toast.error("Please fill required fields");
            return;
        }

        const selectedCourse = courses.find(c => c.id === newExam.course_id);
        if (!selectedCourse) return;

        setIsSubmitting(true);
        try {
            const result = await createExam({
                ...newExam,
                semester: selectedCourse.semester,
                section: selectedCourse.section || undefined,
                discipline_id: selectedCourse.discipline_id,
            });

            if (result) {
                setIsCreateOpen(false);
                setNewExam(defaultExamForm);
                fetchData();
            }
        } catch (error) {
            console.error("Error creating exam:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenEdit = (exam: ExamWithDetails) => {
        setEditingExam(exam);
        setEditForm({
            name: exam.name,
            course_id: exam.course_id,
            type: exam.type,
            date: exam.date,
            time_start: exam.time_start,
            time_end: exam.time_end,
            total_marks: exam.total_marks,
            room: exam.room || ""
        });
        setIsEditOpen(true);
    };

    const handleUpdateExam = async () => {
        if (!editingExam) return;
        if (!editForm.name) {
            toast.error("Please fill required fields");
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await updateExam(editingExam.id, {
                name: editForm.name,
                type: editForm.type,
                date: editForm.date,
                time_start: editForm.time_start,
                time_end: editForm.time_end,
                total_marks: editForm.total_marks,
                room: editForm.room || undefined,
            });

            if (success) {
                setIsEditOpen(false);
                setEditingExam(null);
                fetchData();
            }
        } catch (error) {
            console.error("Error updating exam:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteExam = async (examId: string) => {
        if (!confirm("Are you sure? This will delete all exam results as well.")) return;

        const success = await deleteExam(examId);
        if (success) {
            setExams(prev => prev.filter(e => e.id !== examId));
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading exams...</div>;

    // Reusable exam form used for both create and edit
    const renderExamForm = (form: typeof defaultExamForm, setForm: (f: typeof defaultExamForm) => void, disableCourse?: boolean) => (
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Exam Name</label>
                <Input
                    placeholder="e.g. Mid Term Fall 2024"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Course</label>
                    <Select
                        value={form.course_id}
                        onValueChange={val => setForm({ ...form, course_id: val })}
                        disabled={disableCourse}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                        <SelectContent>
                            {courses.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select
                        value={form.type}
                        onValueChange={(val: ExamType) => setForm({ ...form, type: val })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="mids">Mid Term</SelectItem>
                            <SelectItem value="finals">Final Exam</SelectItem>
                            <SelectItem value="quiz">Quiz</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Date</label>
                    <Input
                        type="date"
                        value={form.date}
                        onChange={e => setForm({ ...form, date: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Total Marks</label>
                    <Input
                        type="number"
                        value={form.total_marks || 0}
                        onChange={e => setForm({ ...form, total_marks: parseInt(e.target.value) || 0 })}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Start Time</label>
                    <Input
                        type="time"
                        value={form.time_start}
                        onChange={e => setForm({ ...form, time_start: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">End Time</label>
                    <Input
                        type="time"
                        value={form.time_end}
                        onChange={e => setForm({ ...form, time_end: e.target.value })}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">Room (Optional)</label>
                <Input
                    placeholder="e.g. Hall A"
                    value={form.room}
                    onChange={e => setForm({ ...form, room: e.target.value })}
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Exams Management</h1>
                    <p className="text-muted-foreground">Schedule exams and manage results</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-[#FF8020] hover:bg-[#E6721C] text-white">
                            <Plus className="mr-2 h-4 w-4" /> Create Exam
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Create New Exam</DialogTitle>
                            <DialogDescription>
                                Set up a mid-term, final, or quiz for your students.
                            </DialogDescription>
                        </DialogHeader>
                        {renderExamForm(newExam, setNewExam)}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button disabled={isSubmitting} onClick={handleCreateExam} className="bg-[#FF8020] hover:bg-[#E6721C] text-white">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Create Exam
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-black shadow-sm hover:bg-accent/50 transition-colors cursor-default">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
                        <GraduationCap className="h-4 w-4 text-[#FF8020]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{exams.length}</div>
                        <p className="text-xs text-muted-foreground">Exams created this semester</p>
                    </CardContent>
                </Card>

                <Card className="border-black shadow-sm hover:bg-accent/50 transition-colors cursor-default">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overall Average</CardTitle>
                        <BarChart3 className="h-4 w-4 text-[#FF8020]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {exams.length > 0
                                ? (exams.reduce((acc, e) => acc + (e.average_percentage || 0), 0) / exams.length).toFixed(1)
                                : "0"}%
                        </div>
                        <p className="text-xs text-muted-foreground">Class average across all exams</p>
                    </CardContent>
                </Card>

                <Card className="border-black shadow-sm hover:bg-accent/50 transition-colors cursor-default">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Upcoming Exams</CardTitle>
                        <Clock className="h-4 w-4 text-[#FF8020]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {exams.filter(e => new Date(e.date) > new Date()).length}
                        </div>
                        <p className="text-xs text-muted-foreground">Scheduled for future dates</p>
                    </CardContent>
                </Card>
            </div>

            <div className="border rounded-md bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course</TableHead>
                            <TableHead>Exam Name</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Students</TableHead>
                            <TableHead>Avg. %</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {exams.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                    No exams found. Create your first exam to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            exams.map((exam) => (
                                <TableRow key={exam.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell>
                                        <div className="font-medium text-foreground">{exam.course?.name}</div>
                                        <div className="text-xs text-muted-foreground">{exam.course?.code}</div>
                                    </TableCell>
                                    <TableCell className="font-medium">{exam.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            {format(new Date(exam.date), 'MMM d, yyyy')}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                            {exam.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                                            {exam.students_count || 0}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-bold text-foreground">
                                            {exam.average_percentage ? `${exam.average_percentage}%` : '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 text-black hover:bg-gray-100 cursor-pointer"
                                                onClick={() => handleOpenEdit(exam)}
                                                title="Edit Exam"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDeleteExam(exam.id)}
                                                title="Delete Exam"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-[#FF8020] hover:text-[#FF8020] hover:bg-[#FF8020]/10"
                                                onClick={() => router.push(`/instructor/exams/${exam.id}`)}
                                            >
                                                View Results <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Exam Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Edit Exam</DialogTitle>
                        <DialogDescription>
                            Update exam details. Course cannot be changed.
                        </DialogDescription>
                    </DialogHeader>
                    {renderExamForm(editForm, setEditForm, true)}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button disabled={isSubmitting} onClick={handleUpdateExam} className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
