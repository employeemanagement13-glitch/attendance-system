"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// Services
import { getDepartment, Department } from "@/lib/services/departments-service";
import { getUsers, UserWithDepartment } from "@/lib/services/users-service";
import { getDisciplines, DisciplineWithDetails, deleteDiscipline } from "@/lib/services/disciplines-service";

export default function DepartmentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [department, setDepartment] = useState<Department | null>(null);
    const [members, setMembers] = useState<UserWithDepartment[]>([]);
    const [disciplines, setDisciplines] = useState<DisciplineWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDetails = async () => {
        if (!params.id) return;
        setLoading(true);
        const dId = params.id as string;

        const [dData, uData, disData] = await Promise.all([
            getDepartment(dId),
            getUsers(), // Could filter by dept in service
            getDisciplines()
        ]);

        if (!dData) {
            toast.error("Department not found")
            router.push("/admin/departments");
            return;
        }

        setDepartment(dData);
        // Filter users by this department
        setMembers(uData.filter(u => u.department_id === dId));

        // Filter disciplines by this department
        setDisciplines(disData.filter(d => d.department_id === dId));

        setLoading(false);
    };

    useEffect(() => {
        fetchDetails();
    }, [params.id, router]);

    const columns: ColumnDef<DisciplineWithDetails>[] = [
        { accessorKey: "name", header: "Discipline" },
        { accessorKey: "courses_count", header: "Courses" },
        { accessorKey: "students_count", header: "Students" },
        { accessorKey: "total_credit_hours", header: "Credit Hours" },
        {
            accessorKey: "department",
            header: "Department",
            cell: ({ row }) => row.original.department?.name || ""
        },
        {
            accessorKey: "attendance",
            header: "Attendance %",
            cell: ({ row }) => {
                const val = (row.original as any).attendance || 0;
                return <span className={val < 75 ? "text-red-500 font-bold" : "text-foreground font-medium"}>{val}%</span>;
            }
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Link href={`/admin/disciplines`}>
                        <Button variant="ghost" size="sm" className="text-[#FF8020] cursor-pointer">Edit</Button>
                    </Link>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 cursor-pointer"
                        onClick={() => {
                            if (confirm("Are you sure you want to delete this discipline?")) {
                                deleteDiscipline(row.original.id).then(fetchDetails);
                            }
                        }}
                    >
                        Delete
                    </Button>
                    <Link href={`/admin/disciplines/${row.original.id}`}>
                        <Button variant="ghost" size="sm" className="text-[#FF8020] cursor-pointer">View</Button>
                    </Link>
                </div>
            )
        }
    ];

    if (loading) return <div className="p-8">Loading department details...</div>;
    if (!department) return <div className="p-8 text-red-500 text-center">Department not found</div>;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="cursor-pointer pl-0 hover:pl-2 transition-all"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Departments
                </Button>

                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight">{department.name}</h1>
                    <p className="text-muted-foreground">Head of Department: {department.hod}</p>
                    {department.description && <p className="mt-2">{department.description}</p>}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Faculty Members</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{members.filter(m => m.role === "instructor").length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{members.filter(m => m.role === "student").length}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <h2 className="text-xl font-semibold">Disciplines</h2>
                    </div>
                    <DataTable columns={columns} data={disciplines} searchKey="name" filename={`${department.name}_disciplines`} />
                </div>
            </div>
        </PageWrapper>
    );
}
