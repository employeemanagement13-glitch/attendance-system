"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getWeeklySchedule } from "@/lib/services/lectures-service";
import { getUserByEmail } from "@/lib/services/users-service";
import { toast } from "sonner";

export default function InstructorSchedulePage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [schedule, setSchedule] = useState<any[]>([]);

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

            try {
                const userDetails = await getUserByEmail(user.primaryEmailAddress.emailAddress);
                if (userDetails) {
                    const data = await getWeeklySchedule(userDetails.id);
                    setSchedule(data);
                }
            } catch (error) {
                console.error("Error loading schedule:", error);
                toast.error("Failed to load weekly schedule");
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [isLoaded, user]);

    if (loading) {
        return (
            <PageWrapper>
                <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground animate-pulse">Loading schedule...</p>
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">Weekly Schedule</h1>

                <div className="grid gap-6 md:grid-cols-5">
                    {schedule.map((dayCol) => (
                        <Card key={dayCol.day} className="md:col-span-1 h-full min-h-[400px]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-medium text-center border-b pb-2">{dayCol.day}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-4">
                                {dayCol.events.length > 0 ? dayCol.events.map((event: any) => (
                                    <div key={event.id} className={`p-3 rounded-lg border text-sm space-y-2 ${event.type === 'class' ? 'bg-blue-50 border-blue-200' : event.type === 'office' ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                                        <div className="font-semibold flex items-center justify-between">
                                            {event.title}
                                            <Badge variant="outline" className="text-[10px] h-5 px-1 uppercase">{event.type}</Badge>
                                        </div>
                                        <div className="flex items-center text-muted-foreground text-xs">
                                            <Clock className="mr-1 h-3 w-3" /> {event.time}
                                        </div>
                                        <div className="flex items-center text-muted-foreground text-xs">
                                            <MapPin className="mr-1 h-3 w-3" /> {event.room}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center text-xs text-muted-foreground py-10">No events scheduled</div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </PageWrapper>
    );
}
