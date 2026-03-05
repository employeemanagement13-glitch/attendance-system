"use client";

import { useState, useEffect, Fragment } from "react";
import { useUser } from "@clerk/nextjs";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
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
import { Label } from "@/components/ui/label";
import { Plus, PenSquare, Loader2, Link as LinkIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Services
import { getUserByEmail } from "@/lib/services/users-service";
import {
    getAssignments,
    createAssignment,
    deleteAssignment,
    AssignmentWithDetails,
    getSubmissions,
    gradeSubmission,
    SubmissionWithDetails
} from "@/lib/services/assignments-service";
import { getCoursesByInstructor, CourseWithDetails } from "@/lib/services/courses-service";
import { format } from "date-fns";

export default function InstructorAssignmentsPage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
    const [courses, setCourses] = useState<CourseWithDetails[]>([]);
    const [userData, setUserData] = useState<any>(null);

    // Form State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form Inputs
    const [title, setTitle] = useState("");
    const [courseId, setCourseId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [totalMarks, setTotalMarks] = useState("10"); // Default 10
    const [description, setDescription] = useState("");

    // Grading State
    const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null);
    const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);
    const [gradingRow, setGradingRow] = useState<string | null>(null); // Submission ID
    const [gradeForm, setGradeForm] = useState({ marks: "", feedback: "" });

    const fetchData = async () => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

        try {
            const userDetails = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (userDetails && userDetails.role === 'instructor') {
                setUserData(userDetails);

                // Fetch Courses related to instructor
                const myCourses = await getCoursesByInstructor(userDetails.id);
                setCourses(myCourses);

                // Fetch Assignments created by instructor
                const myAssignments = await getAssignments({ createdBy: userDetails.id });
                setAssignments(myAssignments);
            }
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Failed to load assignments");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isLoaded, user]);

    const handleSubmit = async () => {
        if (!title || !courseId || !dueDate || !totalMarks) {
            toast.error("Please fill in all required fields");
            return;
        }

        const selectedCourse = courses.find(c => c.id === courseId);
        if (!selectedCourse) {
            toast.error("Invalid course selected");
            return;
        }

        try {
            setSubmitting(true);
            await createAssignment({
                title,
                course_id: courseId,
                due_date: new Date(dueDate).toISOString(),
                total_marks: parseInt(totalMarks),
                description,
                semester: selectedCourse.semester,
                section: selectedCourse.section || undefined,
                created_by: userData.id
            });

            toast.success("Assignment created");
            setIsDialogOpen(false);

            // Reset form
            setTitle("");
            setCourseId("");
            setDueDate("");
            setDescription("");
            setTotalMarks("10");

            // Refresh list
            const refresh = await getAssignments({ createdBy: userData.id });
            setAssignments(refresh);

        } catch (error) {
            console.error(error);
            toast.error("Failed to create assignment");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure? This will delete all student submissions as well.")) {
            await deleteAssignment(id);
            // Refresh
            const refresh = assignments.filter(a => a.id !== id);
            setAssignments(refresh);
        }
    };

    const handleOpenGradeDialog = async (assignment: AssignmentWithDetails) => {
        setSelectedAssignment(assignment);
        setIsGradeDialogOpen(true);
        setLoadingSubmissions(true);
        try {
            const data = await getSubmissions(assignment.id);
            setSubmissions(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingSubmissions(false);
        }
    };

    const handleStartGrading = (submission: SubmissionWithDetails) => {
        setGradingRow(submission.id);
        setGradeForm({
            marks: submission.obtained_marks?.toString() || "",
            feedback: submission.feedback || ""
        });
    };

    const handleSaveGrade = async (submissionId: string) => {
        if (!userData) return;

        try {
            const marks = parseFloat(gradeForm.marks);
            if (isNaN(marks) || marks < 0 || (selectedAssignment && marks > selectedAssignment.total_marks)) {
                toast.error("Invalid marks");
                return;
            }

            await gradeSubmission(submissionId, {
                obtained_marks: marks,
                feedback: gradeForm.feedback,
                graded_by: userData.id
            });

            // Update local state
            setSubmissions(prev => prev.map(s =>
                s.id === submissionId
                    ? { ...s, obtained_marks: marks, feedback: gradeForm.feedback, status: 'graded' }
                    : s
            ));
            setGradingRow(null);
            toast.success("Grade saved");
        } catch (error) {
            console.error(error);
        }
    };

    const columns: ColumnDef<AssignmentWithDetails>[] = [
        {
            accessorKey: "title",
            header: "Title",
            cell: ({ row }) => (
                <div className="font-medium">
                    {row.original.title}
                    {row.original.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{row.original.description}</p>
                    )}
                </div>
            )
        },
        {
            accessorKey: "course",
            header: "Course",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.course?.code}</span>
                    <span className="text-xs text-muted-foreground">{row.original.course?.name}</span>
                </div>
            )
        },
        {
            accessorKey: "due_date",
            header: "Due Date",
            cell: ({ row }) => (
                <div className={new Date(row.original.due_date) < new Date() ? "text-red-500 font-medium" : ""}>
                    {format(new Date(row.original.due_date), "MMM d, yyyy")}
                </div>
            )
        },
        {
            header: "Submissions",
            cell: ({ row }) => (
                <Badge variant="outline">
                    {row.original.submissions_count || 0} Submitted
                </Badge>
            )
        },
        {
            accessorKey: "total_marks",
            header: "Marks",
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenGradeDialog(row.original)}>
                        <PenSquare className="mr-2 h-4 w-4" /> Grade
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ];

    if (loading) return <div className="p-8">Loading assignments...</div>;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Assignments & Grading</h1>
                        <p className="text-muted-foreground">Manage coursework and grade submissions.</p>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#FF8020] hover:bg-[#E6721C] cursor-pointer text-white">
                                <Plus className="mr-2 h-4 w-4" /> Create Assignment
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Create New Assignment</DialogTitle>
                                <DialogDescription>
                                    Add a new task for your students.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="title">Assignment Title</Label>
                                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Project Proposal" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="course">Course</Label>
                                        <Select value={courseId} onValueChange={setCourseId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Course" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {courses.map(course => (
                                                    <SelectItem key={course.id} value={course.id}>
                                                        {course.code}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="marks">Total Marks</Label>
                                        <Input id="marks" type="number" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="due">Due Date</Label>
                                    <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="desc">Description / Instructions</Label>
                                    <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter details..." />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSubmit} disabled={submitting} className="bg-[#FF8020] hover:bg-[#E6721C] cursor-pointer text-white">
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Create Assignment
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <DataTable columns={columns} data={assignments} searchKey="title" filename="assignments_list" />

                {/* Grading Dialog */}
                <Dialog open={isGradeDialogOpen} onOpenChange={setIsGradeDialogOpen}>
                    <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>Grade Submissions: {selectedAssignment?.title}</DialogTitle>
                            <DialogDescription>
                                Review and grade student work for this assignment.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-auto py-4">
                            {loadingSubmissions ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : submissions.length === 0 ? (
                                <div className="text-center py-20 text-muted-foreground">
                                    No submissions yet for this assignment.
                                </div>
                            ) : (
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Student</TableHead>
                                                <TableHead>Submission</TableHead>
                                                <TableHead>Submitted At</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Marks</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {submissions.map((sub) => (
                                                <Fragment key={sub.id}>
                                                    <TableRow>
                                                        <TableCell>
                                                            <div className="font-medium">{sub.student?.full_name}</div>
                                                            <div className="text-xs text-muted-foreground">{sub.student?.email}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-2">
                                                                {sub.file_path && (
                                                                    <a href={sub.file_path} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600 flex items-center text-sm">
                                                                        <LinkIcon className="h-4 w-4 mr-1" /> View Link
                                                                    </a>
                                                                )}
                                                                {sub.submission_text && (
                                                                    <Dialog>
                                                                        <DialogTrigger asChild>
                                                                            <Button variant="outline" size="sm" className="w-fit">View Text</Button>
                                                                        </DialogTrigger>
                                                                        <DialogContent>
                                                                            <DialogHeader>
                                                                                <DialogTitle>Submission from {sub.student?.full_name}</DialogTitle>
                                                                            </DialogHeader>
                                                                            <div className="bg-muted p-4 rounded-md whitespace-pre-wrap text-sm max-h-[60vh] overflow-y-auto">
                                                                                {sub.submission_text}
                                                                            </div>
                                                                        </DialogContent>
                                                                    </Dialog>
                                                                )}
                                                                {!sub.file_path && !sub.submission_text && (
                                                                    <span className="text-muted-foreground text-sm">No content provided</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {sub.submitted_at ? format(new Date(sub.submitted_at), "MMM d, h:mm a") : "-"}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={sub.status === 'graded' ? 'default' : 'outline'}>
                                                                {sub.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            {sub.obtained_marks !== null ? `${sub.obtained_marks} / ${selectedAssignment?.total_marks}` : `- / ${selectedAssignment?.total_marks}`}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleStartGrading(sub)}
                                                            >
                                                                {sub.status === 'graded' ? "Edit Grade" : "Grade"}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                    {gradingRow === sub.id && (
                                                        <TableRow className="bg-muted/30">
                                                            <TableCell colSpan={6}>
                                                                <div className="p-4 grid gap-4">
                                                                    <div className="grid grid-cols-4 items-center gap-4">
                                                                        <Label className="text-right">Marks</Label>
                                                                        <Input
                                                                            type="number"
                                                                            className="col-span-3"
                                                                            value={gradeForm.marks}
                                                                            onChange={e => setGradeForm({ ...gradeForm, marks: e.target.value })}
                                                                            max={selectedAssignment?.total_marks}
                                                                        />
                                                                    </div>
                                                                    <div className="grid grid-cols-4 items-center gap-4">
                                                                        <Label className="text-right">Feedback</Label>
                                                                        <Textarea
                                                                            className="col-span-3"
                                                                            placeholder="Feedback for the student..."
                                                                            value={gradeForm.feedback}
                                                                            onChange={e => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                                                                        />
                                                                    </div>
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button variant="outline" size="sm" onClick={() => setGradingRow(null)}>Cancel</Button>
                                                                        <Button size="sm" onClick={() => handleSaveGrade(sub.id)}>Save Grade</Button>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </Fragment>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </PageWrapper>
    );
}
