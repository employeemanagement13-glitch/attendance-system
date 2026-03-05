"use client";

import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";

// Services
import {
    getPendingCorrectionRequests,
    approveCorrectionRequest,
    rejectCorrectionRequest,
    CorrectionWithDetails
} from "@/lib/services/attendance-correction-service";
import { getUserByEmail } from "@/lib/services/users-service";

export default function AttendanceRequestsPage() {
    const { user } = useUser();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<CorrectionWithDetails[]>([]);
    const [dbUserId, setDbUserId] = useState<string | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        const data = await getPendingCorrectionRequests();
        setRequests(data);
        setLoading(false);
    };

    useEffect(() => {
        async function init() {
            if (!user) return;
            const email = user.emailAddresses[0]?.emailAddress;
            const dbUser = await getUserByEmail(email);
            if (dbUser) setDbUserId(dbUser.id);
            fetchRequests();
        }
        init();
    }, [user]);

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        if (!dbUserId) return;

        const success = action === 'approve'
            ? await approveCorrectionRequest(id, { reviewed_by: dbUserId, review_comments: "Approved via dashboard" })
            : await rejectCorrectionRequest(id, { reviewed_by: dbUserId, review_comments: "Rejected via dashboard" });

        if (success) {
            fetchRequests();
        }
    };

    const columns: ColumnDef<CorrectionWithDetails>[] = [
        {
            accessorKey: "student",
            header: "Student",
            cell: ({ row }) => row.original.student?.full_name || "Unknown"
        },
        {
            accessorKey: "lecture.course.code",
            header: "Course",
            cell: ({ row }) => row.original.lecture?.course?.code || "N/A"
        },
        {
            accessorKey: "lecture.date",
            header: "Date",
            cell: ({ row }) => row.original.lecture?.date || "N/A"
        },
        { accessorKey: "current_status", header: "Current" },
        { accessorKey: "requested_status", header: "Requested" },
        { accessorKey: "reason", header: "Reason" },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                let color = "secondary";
                if (status === "approved") color = "default";
                if (status === "rejected") color = "destructive";
                return <Badge variant={color as any} className="capitalize">{status}</Badge>
            }
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                row.original.status === "pending" ? (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700 cursor-pointer"
                            onClick={() => handleAction(row.original.id, 'approve')}
                        >
                            Approve
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs cursor-pointer"
                            onClick={() => handleAction(row.original.id, 'reject')}
                        >
                            Reject
                        </Button>
                    </div>
                ) : <span className="text-muted-foreground text-xs">Processed</span>
            )
        }
    ];

    return (
        <PageWrapper>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">Attendance Correction Requests</h1>
                <DataTable
                    columns={columns}
                    data={requests}
                    searchKey="student"
                    filename="correction_requests"
                    isLoading={loading}
                />
            </div>
        </PageWrapper>
    );
}
