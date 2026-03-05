"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getUserByEmail } from "@/lib/services/users-service";
import { getLeaveRequests, createLeaveRequest, LeaveRequest } from "@/lib/services/leaves-service";
export default function StudentLeavesPage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [userData, setUserData] = useState<any>(null);

    // Form State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formDate, setFormDate] = useState("");
    const [formReason, setFormReason] = useState("");

    const fetchData = async () => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

        try {
            const userDetails = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (userDetails && userDetails.role === 'student') {
                setUserData(userDetails);
                const leavesData = await getLeaveRequests({ userId: userDetails.id });
                setRequests(leavesData);
            }
        } catch (error) {
            console.error("Error loading leaves:", error);
            toast.error("Failed to load leaves");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isLoaded, user]);

    const handleSubmit = async () => {
        if (!formDate || !formReason) {
            toast.error("Date and Reason are required");
            return;
        }

        try {
            setSubmitting(true);

            await createLeaveRequest({
                user_id: userData.id,
                user_type: userData.role as any,
                date: formDate,
                reason: formReason,
                status: 'pending',
                discipline_id: userData.discipline_id,
            });

            toast.success("Leave request submitted");
            setIsDialogOpen(false);
            setFormDate("");
            setFormReason("");

            // Refresh list
            const leavesData = await getLeaveRequests({ userId: userData.id });
            setRequests(leavesData);

        } catch (error) {
            console.error("Error submitting leave:", error);
            toast.error("Failed to submit request");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Leave Requests</h1>
                    <p className="text-muted-foreground">Request and track your leaves</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-[#FF8020] hover:bg-[#E6721C] text-white cursor-pointer">
                            <Plus className="mr-2 h-4 w-4" /> New Request
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Request Leave</DialogTitle>
                            <DialogDescription>
                                Submit a request for absence.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="reason">Reason</Label>
                                <Textarea
                                    id="reason"
                                    placeholder="Briefly explain why you need leave..."
                                    value={formReason}
                                    onChange={(e) => setFormReason(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSubmit} disabled={submitting}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Submit Request
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Created At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">
                                    No leave requests found
                                </TableCell>
                            </TableRow>
                        ) : (
                            requests.map((request) => (
                                <TableRow key={request.id}>
                                    <TableCell className="font-medium">
                                        {format(new Date(request.date), 'MMMM d, yyyy')}
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate" title={request.reason}>
                                        {request.reason}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                request.status === 'approved' ? 'default' :
                                                    request.status === 'reject' ? 'destructive' : 'secondary'
                                            }
                                            className={request.status === 'approved' ? 'bg-green-600' : ''}
                                        >
                                            {request.status.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {format(new Date(request.created_at), 'MMM d, h:mm a')}
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
