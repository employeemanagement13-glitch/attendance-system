"use client";

import React, { useState, useEffect } from "react";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Check, X, Search, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { getUserByEmail } from "@/lib/services/users-service";
import {
    getLeaveRequests,
    updateLeaveStatus,
    LeaveRequest
} from "@/lib/services/leaves-service";
import { getCoursesByInstructor } from "@/lib/services/courses-service";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function InstructorLeavesPage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Rejection state
    const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);
    const [rejectionComments, setRejectionComments] = useState("");
    const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
    const [submittingRejection, setSubmittingRejection] = useState(false);

    const fetchData = async () => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

        try {
            const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (!userData || userData.role !== 'instructor') return;

            // 1. Fetch instructor's courses to filter leaves
            const instructorCourses = await getCoursesByInstructor(userData.id);
            const courseIds = instructorCourses.map(c => c.id);

            const leavesData = await getLeaveRequests({
                userType: 'student',
                courseId: courseIds.length > 0 ? undefined : 'none',
                status: statusFilter !== 'all' ? statusFilter as any : undefined,
            });

            // Filter leaves by instructor's courses on client side if necessary, 
            // or better yet, the service should support Array of courseIds.
            // Since I just updated the service to support courseId, I'll filter by the specific course if selected,
            // or filter the whole list by instructor's course IDs.
            const instructorLeaves = leavesData.filter(leave =>
                !leave.course_id || courseIds.includes(leave.course_id)
            );

            setLeaves(instructorLeaves);
            setLeaves(instructorLeaves);
        } catch (error) {
            console.error("Error loading leaves:", error);
            toast.error("Failed to load leave requests");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isLoaded, user, statusFilter]);

    const handleStatusUpdate = async (id: string, status: 'approved' | 'reject', comments?: string) => {
        if (!user?.primaryEmailAddress?.emailAddress) return;

        try {
            if (status === 'reject') setSubmittingRejection(true);
            const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (!userData) return;

            const success = await updateLeaveStatus(id, status, userData.id, comments);
            if (success) {
                fetchData();
                if (status === 'reject') {
                    setIsRejectionDialogOpen(false);
                    setRejectionComments("");
                    setSelectedLeaveId(null);
                }
            }
        } catch (error) {
            console.error("Error updating leave:", error);
        } finally {
            if (status === 'reject') setSubmittingRejection(false);
        }
    };

    const toggleReason = (id: string) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    // Filter by search query (client side)
    const filteredLeaves = leaves.filter(leave =>
        leave.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        leave.student?.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Leaves</h1>
                <p className="text-muted-foreground">Manage student leave requests</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search student..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Semester</TableHead>
                            <TableHead>Times</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLeaves.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">
                                    No leave requests found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLeaves.map((leave) => (
                                <React.Fragment key={leave.id}>
                                    <TableRow>
                                        <TableCell className="font-medium">
                                            {leave.student?.full_name}
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(leave.date), 'MMM d, yyyy')}
                                        </TableCell>
                                        <TableCell>{leave.semester}</TableCell>
                                        <TableCell>
                                            {leave.time_start && leave.time_end
                                                ? `${leave.time_start} - ${leave.time_end}`
                                                : "Full Day"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                leave.status === 'approved' ? 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200' :
                                                    leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200' :
                                                        leave.status === 'reject' ? 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200' :
                                                            'bg-slate-100 text-slate-800'
                                            }>
                                                {(leave.status || 'UNKNOWN').toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleReason(leave.id)}
                                                className="h-8 gap-1"
                                            >
                                                Details {expandedRow === leave.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {leave.status === 'pending' && (
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => handleStatusUpdate(leave.id, 'approved')}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => {
                                                            setSelectedLeaveId(leave.id);
                                                            setIsRejectionDialogOpen(true);
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    {expandedRow === leave.id && (
                                        <TableRow className="bg-muted/30">
                                            <TableCell colSpan={7}>
                                                <div className="p-4 space-y-4">
                                                    <div>
                                                        <h4 className="font-semibold text-sm mb-1">Reason for Leave:</h4>
                                                        <p className="text-sm text-muted-foreground bg-background p-3 rounded-md border">
                                                            {leave.reason}
                                                        </p>
                                                    </div>
                                                    {leave.review_comments && (
                                                        <div>
                                                            <h4 className="font-semibold text-sm mb-1">Instructor Comments:</h4>
                                                            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100">
                                                                {leave.review_comments}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Rejection Dialog */}
            <Dialog open={isRejectionDialogOpen} onOpenChange={setIsRejectionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Leave Request</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting this leave request. This will be visible to the student.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="comments">Comments / Reason for Rejection</Label>
                        <Textarea
                            id="comments"
                            placeholder="e.g., Not enough documentation provided, or mandatory class day."
                            value={rejectionComments}
                            onChange={(e) => setRejectionComments(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectionDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={!rejectionComments || submittingRejection}
                            onClick={() => handleStatusUpdate(selectedLeaveId!, 'reject', rejectionComments)}
                        >
                            {submittingRejection ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Reject Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
