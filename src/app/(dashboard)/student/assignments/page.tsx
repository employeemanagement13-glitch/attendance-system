"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Label } from "@/components/ui/label";
import { FileText, Upload, Link as LinkIcon, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { getUserByEmail } from "@/lib/services/users-service";
import {
    getStudentAssignments,
    createSubmission,
    StudentAssignmentWithStatus
} from "@/lib/services/assignments-service";

export default function StudentAssignmentsPage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [assignments, setAssignments] = useState<StudentAssignmentWithStatus[]>([]);
    const [userData, setUserData] = useState<any>(null);

    // Submission form
    const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignmentWithStatus | null>(null);
    const [submissionType, setSubmissionType] = useState<'text' | 'link'>('link');
    const [submissionContent, setSubmissionContent] = useState("");
    const [isSubmitOpen, setIsSubmitOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

        try {
            const userDetails = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (userDetails && userDetails.role === 'student') {
                setUserData(userDetails);
                const data = await getStudentAssignments(userDetails.id);
                setAssignments(data);
            }
        } catch (error) {
            console.error("Error loading assignments:", error);
            toast.error("Failed to load assignments");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isLoaded, user]);

    const handleSubmit = async () => {
        if (!selectedAssignment || !submissionContent) {
            toast.error("Please provide submission content");
            return;
        }

        try {
            setSubmitting(true);

            await createSubmission({
                assignment_id: selectedAssignment.id,
                student_id: userData.id,
                file_path: submissionType === 'link' ? submissionContent : undefined,
                submission_text: submissionType === 'text' ? submissionContent : undefined
            });

            setIsSubmitOpen(false);
            setSubmissionContent("");
            setSelectedAssignment(null);

            // Refresh
            fetchData();
        } catch (error) {
            console.error("Submission error:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
            'pending': 'outline',
            'submitted': 'secondary',
            'late': 'outline',
            'graded': 'default',
            'missed': 'destructive'
        };

        const className = status === 'submitted' ? 'bg-green-100 text-green-800' :
            status === 'late' ? 'border-amber-500 text-amber-700' : '';

        return <Badge variant={variants[status] || 'secondary'} className={className}>{status}</Badge>;
    };

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    const pendingAssignments = assignments.filter(a => a.status === 'pending' || a.status === 'missed');
    const submittedAssignments = assignments.filter(a => a.status === 'submitted' || a.status === 'late');
    const gradedAssignments = assignments.filter(a => a.status === 'graded');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
                <p className="text-muted-foreground">View and submit your course work</p>
            </div>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList>
                    <TabsTrigger value="pending">Pending ({pendingAssignments.length})</TabsTrigger>
                    <TabsTrigger value="submitted">Submitted ({submittedAssignments.length})</TabsTrigger>
                    <TabsTrigger value="graded">Graded ({gradedAssignments.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-4">
                    <AssignmentTable
                        assignments={pendingAssignments}
                        showAction={true}
                        onAction={(a: StudentAssignmentWithStatus) => {
                            setSelectedAssignment(a);
                            setIsSubmitOpen(true);
                        }}
                    />
                </TabsContent>

                <TabsContent value="submitted" className="mt-4">
                    <AssignmentTable assignments={submittedAssignments} showAction={false} />
                </TabsContent>

                <TabsContent value="graded" className="mt-4">
                    <AssignmentTable assignments={gradedAssignments} showGrade={true} />
                </TabsContent>
            </Tabs>

            <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Submit Assignment</DialogTitle>
                        <DialogDescription>
                            {selectedAssignment?.title} - Due {selectedAssignment && format(new Date(selectedAssignment.due_date), 'MMM d, yyyy')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="flex gap-4">
                            <Button
                                variant={submissionType === 'link' ? 'default' : 'outline'}
                                onClick={() => setSubmissionType('link')}
                                className="flex-1"
                            >
                                <LinkIcon className="mr-2 h-4 w-4" /> Link/URL
                            </Button>
                            <Button
                                variant={submissionType === 'text' ? 'default' : 'outline'}
                                onClick={() => setSubmissionType('text')}
                                className="flex-1"
                            >
                                <FileText className="mr-2 h-4 w-4" /> Text
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label>{submissionType === 'link' ? 'File URL / Link' : 'Submission Text'}</Label>
                            {submissionType === 'link' ? (
                                <Input
                                    placeholder="https://drive.google.com/..."
                                    value={submissionContent}
                                    onChange={(e) => setSubmissionContent(e.target.value)}
                                />
                            ) : (
                                <Textarea
                                    placeholder="Type your submission..."
                                    className="min-h-[100px]"
                                    value={submissionContent}
                                    onChange={(e) => setSubmissionContent(e.target.value)}
                                />
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting && <Clock className="mr-2 h-4 w-4 animate-spin" />}
                            Submit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

    function AssignmentTable({ assignments, showAction, showGrade, onAction }: {
        assignments: StudentAssignmentWithStatus[],
        showAction?: boolean,
        showGrade?: boolean,
        onAction?: (a: StudentAssignmentWithStatus) => void
    }) {
        return (
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course</TableHead>
                            <TableHead>Assignment</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            {showGrade && <TableHead>Marks</TableHead>}
                            {showGrade && <TableHead>Feedback</TableHead>}
                            {showAction && <TableHead className="text-right">Action</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assignments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={showGrade ? 6 : 5} className="text-center py-8">
                                    No assignments found
                                </TableCell>
                            </TableRow>
                        ) : (
                            assignments.map((assignment: StudentAssignmentWithStatus) => (
                                <TableRow key={assignment.id}>
                                    <TableCell className="font-medium">
                                        {assignment.course?.name} <span className="text-xs text-muted-foreground ml-1">({assignment.course?.code})</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{assignment.title}</span>
                                            {assignment.file_path && (
                                                <a href={assignment.file_path} target="_blank" className="text-xs text-blue-500 hover:underline">
                                                    View Resource
                                                </a>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{format(new Date(assignment.due_date), 'MMM d, h:mm a')}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={assignment.status} />
                                    </TableCell>
                                    {showGrade && (
                                        <TableCell>
                                            <span className="font-bold">
                                                {assignment.submission?.obtained_marks}/{assignment.total_marks}
                                            </span>
                                        </TableCell>
                                    )}
                                    {showGrade && (
                                        <TableCell className="max-w-[200px] truncate" title={assignment.submission?.feedback || ""}>
                                            {assignment.submission?.feedback || "-"}
                                        </TableCell>
                                    )}
                                    {showAction && (
                                        <TableCell className="text-right">
                                            {assignment.status !== 'missed' && (
                                                <Button size="sm" onClick={() => onAction && onAction(assignment)}>
                                                    Submit
                                                </Button>
                                            )}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        );
    }
}
