"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar as CalendarIcon, Clock } from "lucide-react";
import { toast } from "sonner";
import { getUserByEmail } from "@/lib/services/users-service";
import {
    getLectures,
    rescheduleLecture,
    LectureWithDetails
} from "@/lib/services/lectures-service";

export default function AbsentLecturesPage() {
    const searchParams = useSearchParams();
    const dateParam = searchParams.get('date');
    const { user, isLoaded } = useUser();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [lectures, setLectures] = useState<LectureWithDetails[]>([]);
    const [selectedLecture, setSelectedLecture] = useState<LectureWithDetails | null>(null);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);

    // Reschedule form state
    const [newDate, setNewDate] = useState("");
    const [newTime, setNewTime] = useState("");
    const [newRoom, setNewRoom] = useState("");

    const refreshData = async () => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

        try {
            const userData = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (userData && userData.role === 'instructor') {
                const data = await getLectures({
                    instructorId: userData.id,
                    status: 'cancelled',
                    date: dateParam || undefined
                });
                setLectures(data);
            }
        } catch (error) {
            console.error("Error loading absent lectures:", error);
            toast.error("Failed to load lectures");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, [isLoaded, user, dateParam]);

    const handleRescheduleSubmit = async () => {
        if (!selectedLecture || !newDate || !newTime) {
            toast.error("Please select detailed date and time");
            return;
        }

        try {
            await rescheduleLecture(selectedLecture.id, {
                rescheduled_to_date: newDate,
                rescheduled_to_time: newTime,
                room: newRoom
            });

            setRescheduleOpen(false);
            setNewDate("");
            setNewTime("");
            setNewRoom("");
            setSelectedLecture(null);

            // Refresh list
            refreshData();
        } catch (error) {
            console.error("Reschedule failed:", error);
        }
    };

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    const titleDate = dateParam ? format(new Date(dateParam), 'dd MMMM, yyyy') : 'All History';

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="h-8 w-8"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Absent Lectures | {titleDate}</h1>
                    <p className="text-muted-foreground">
                        Manage and reschedule missed classes
                    </p>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Originally Scheduled</TableHead>
                            <TableHead>Rescheduled To</TableHead>
                            <TableHead>Discipline</TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead>Students</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lectures.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">
                                    No absent/cancelled lectures found
                                </TableCell>
                            </TableRow>
                        ) : (
                            lectures.map((lecture) => (
                                <TableRow key={lecture.id}>
                                    <TableCell className="font-medium">
                                        {lecture.course?.name}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(lecture.date), 'MMM d, yyyy')}
                                            </span>
                                            <span>{lecture.time_start}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {lecture.rescheduled_to_date ? (
                                            <div className="flex flex-col text-blue-600">
                                                <span className="text-xs">
                                                    {format(new Date(lecture.rescheduled_to_date), 'MMM d, yyyy')}
                                                </span>
                                                <span>{lecture.rescheduled_to_time}</span>
                                            </div>
                                        ) : (
                                            <Badge variant="outline">Not Rescheduled</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>{'-'}</TableCell>
                                    <TableCell>
                                        Semester {lecture.semester} ({lecture.course?.code ? lecture.course.code + 'A' : '-'})
                                    </TableCell>
                                    <TableCell>{lecture.students_count}</TableCell>
                                    <TableCell>
                                        {!lecture.rescheduled_to_date && (
                                            <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setSelectedLecture(lecture)}
                                                    >
                                                        Reschedule
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Reschedule Lecture</DialogTitle>
                                                        <DialogDescription>
                                                            Set a new time for {lecture.course?.name}
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="grid gap-4 py-4">
                                                        <div className="grid grid-cols-4 items-center gap-4">
                                                            <Label htmlFor="date" className="text-right">
                                                                New Date
                                                            </Label>
                                                            <Input
                                                                id="date"
                                                                type="date"
                                                                className="col-span-3"
                                                                value={newDate}
                                                                onChange={(e) => setNewDate(e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-4 items-center gap-4">
                                                            <Label htmlFor="time" className="text-right">
                                                                New Time
                                                            </Label>
                                                            <Input
                                                                id="time"
                                                                type="time"
                                                                className="col-span-3"
                                                                value={newTime}
                                                                onChange={(e) => setNewTime(e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-4 items-center gap-4">
                                                            <Label htmlFor="room" className="text-right">
                                                                New Room
                                                            </Label>
                                                            <Input
                                                                id="room"
                                                                className="col-span-3"
                                                                value={newRoom}
                                                                onChange={(e) => setNewRoom(e.target.value)}
                                                                placeholder={lecture.room || "e.g. 101"}
                                                            />
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <Button type="submit" onClick={handleRescheduleSubmit}>
                                                            Confirm Reschedule
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        )}
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
