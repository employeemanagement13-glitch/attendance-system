"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, CalendarClock, CalendarOff, Trash2 } from "lucide-react";

// Services
import { getLectures, cancelLecture, rescheduleLecture, deleteLecture, LectureWithDetails } from "@/lib/services/lectures-service";
import { getUserByEmail } from "@/lib/services/users-service";

export default function LecturesPage() {
    const { user, isLoaded } = useUser();
    const [lectures, setLectures] = useState<LectureWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [instructorId, setInstructorId] = useState<string | null>(null);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [selectedLecture, setSelectedLecture] = useState<LectureWithDetails | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState("");
    const [rescheduleTime, setRescheduleTime] = useState("");
    const [rescheduleRoom, setRescheduleRoom] = useState("");
    const [saving, setSaving] = useState(false);

    // Fetch instructor ID from Clerk user
    useEffect(() => {
        const fetchUser = async () => {
            if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;
            const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (userData?.role === 'instructor') {
                setInstructorId(userData.id);
            }
        };
        fetchUser();
    }, [isLoaded, user]);

    const fetchData = async () => {
        if (!instructorId) return;
        setLoading(true);
        const data = await getLectures({ instructorId });
        setLectures(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [instructorId]);

    const handleCancel = async (id: string) => {
        if (confirm("Are you sure you want to cancel this lecture? Students will be notified.")) {
            const success = await cancelLecture(id, "Cancelled by instructor");
            if (success) fetchData();
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this rescheduled history entry?")) {
            const success = await deleteLecture(id);
            if (success) fetchData();
        }
    };

    const openReschedule = (lec: LectureWithDetails) => {
        setSelectedLecture(lec);
        setRescheduleDate(lec.date);
        setRescheduleTime(lec.time_start);
        setRescheduleRoom(lec.room || "");
        setRescheduleOpen(true);
    };

    const handleRescheduleSubmit = async () => {
        if (!selectedLecture || !rescheduleDate || !rescheduleTime) {
            toast.error("Please fill in all fields");
            return;
        }

        setSaving(true);
        const success = await rescheduleLecture(selectedLecture.id, {
            rescheduled_to_date: rescheduleDate,
            rescheduled_to_time: rescheduleTime,
            room: rescheduleRoom
        });

        if (success) {
            setRescheduleOpen(false);
            fetchData();
        }
        setSaving(false);
    };

    const columns: ColumnDef<LectureWithDetails>[] = [
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => new Date(row.getValue("date")).toLocaleDateString()
        },
        {
            accessorKey: "time_start",
            header: "Time",
            cell: ({ row }) => `${row.original.time_start} - ${row.original.time_end}`
        },
        {
            id: "course_code",
            accessorFn: (row) => row.course?.code,
            header: "Course",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.course?.code}</span>
                    <span className="text-xs text-muted-foreground">{row.original.course?.name}</span>
                </div>
            )
        },
        {
            accessorKey: "room",
            header: "Room",
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                return (
                    <Badge variant={
                        status === 'completed' ? 'default' :
                            status === 'cancelled' ? 'destructive' :
                                status === 'rescheduled' ? 'outline' :
                                    'secondary'
                    }>
                        {status.toUpperCase()}
                    </Badge>
                );
            }
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Link href={`/instructor/lectures/${row.original.id}`}>
                        <Button variant="ghost" size="icon" className="cursor-pointer" title="View Details">
                            <Eye className="h-4 w-4 text-black" />
                        </Button>
                    </Link>
                    {/* Active Lectures (Scheduled or Rescheduled but not yet moved to history) */}
                    {(row.original.status === 'scheduled' || (row.original.status === 'rescheduled' && !row.original.rescheduled_to_date)) && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-black cursor-pointer"
                                onClick={() => openReschedule(row.original)}
                                title="Reschedule"
                            >
                                <CalendarClock className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600 cursor-pointer"
                                onClick={() => handleCancel(row.original.id)}
                                title="Cancel Lecture"
                            >
                                <CalendarOff className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                    {/* History Lectures (Rescheduled and moved to history) */}
                    {row.original.status === 'rescheduled' && row.original.rescheduled_to_date && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600 cursor-pointer"
                            onClick={() => handleDelete(row.original.id)}
                            title="Delete Record"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )
        }
    ];

    const activeLectures = lectures.filter(l => !(l.status === 'rescheduled' && l.rescheduled_to_date));
    const rescheduledHistory = lectures.filter(l => l.status === 'rescheduled' && l.rescheduled_to_date);

    if (!isLoaded || loading) return <div className="p-8">Loading lectures...</div>;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">My Lectures</h1>
                </div>

                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle>My Lectures</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable columns={columns} data={activeLectures} searchKey="course_code" filename="my_lectures" />
                    </CardContent>
                </Card>

                {rescheduledHistory.length > 0 && (
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-muted-foreground">Rescheduled Lectures (History)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable columns={columns} data={rescheduledHistory} searchKey="course_code" filename="rescheduled_history" />
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reschedule Lecture</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>New Date</Label>
                            <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>New Start Time</Label>
                            <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Room (Optional)</Label>
                            <Input value={rescheduleRoom} onChange={(e) => setRescheduleRoom(e.target.value)} placeholder="e.g. SST-301" />
                        </div>
                    </div>
                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Cancel</Button>
                        <Button className="bg-[#FF8020] hover:bg-[#E6721C]" onClick={handleRescheduleSubmit} disabled={saving}>
                            {saving ? "Processing..." : "Confirm Reschedule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageWrapper>
    );
}
