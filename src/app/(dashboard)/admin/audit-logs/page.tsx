"use client";

import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { ShieldAlert, Activity, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Services
import { getAuditLogs, getAuditLogCounts, AuditLogWithUser } from "@/lib/services/audit-service";

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLogWithUser[]>([]);
    const [counts, setCounts] = useState({ security: 0, system: 0, user: 0, total: 0 });

    const fetchData = async () => {
        const [logsData, countsData] = await Promise.all([
            getAuditLogs(100),
            getAuditLogCounts()
        ]);
        setLogs(logsData);
        setCounts(countsData);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const columns: ColumnDef<AuditLogWithUser>[] = [
        {
            accessorKey: "created_at",
            header: "Timestamp",
            cell: ({ row }) => new Date(row.getValue("created_at")).toLocaleString()
        },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.getValue("type")}</Badge>
        },
        {
            accessorKey: "user_email",
            header: "User",
            cell: ({ row }) => row.getValue("user_email") || "System"
        },
        { accessorKey: "action", header: "Action" },
        {
            accessorKey: "details",
            header: "Details",
            cell: ({ row }) => {
                const details = row.getValue("details") as string;
                return <span className="truncate max-w-[300px] block">{details || "-"}</span>;
            }
        },
        { accessorKey: "ip_address", header: "IP Address" },
    ];

    return (
        <PageWrapper>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>

                {/* Summary Widgets */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{counts.security}</div>
                            <p className="text-xs text-muted-foreground">Total security events</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">System Changes</CardTitle>
                            <Activity className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{counts.system}</div>
                            <p className="text-xs text-muted-foreground">System-level events</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">User Actions</CardTitle>
                            <UserCog className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{counts.user}</div>
                            <p className="text-xs text-muted-foreground">User-generated events</p>
                        </CardContent>
                    </Card>
                </div>

                <DataTable columns={columns} data={logs} searchKey="user_email" filename="audit_logs" />
            </div>
        </PageWrapper>
    );
}
