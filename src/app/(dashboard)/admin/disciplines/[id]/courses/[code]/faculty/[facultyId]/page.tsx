"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// Services
import { getCourses, CourseWithDetails } from "@/lib/services/courses-service";
import { getUser } from "@/lib/services/users-service";

type SectionData = {
    id: string; // Course ID (since course = section in this DB schema)
    name: string; // Section Name (e.g. "A")
    students_count: number;
    presents: number; // Mocked
    absents: number; // Mocked
    discipline: string;
    attendance_percentage: number; // Mocked
};

export default function FacultySectionsPage() {
    const params = useParams();
    const router = useRouter();
    const [sections, setSections] = useState<SectionData[]>([]);
    const [facultyName, setFacultyName] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!params.facultyId || !params.code) return;
            setLoading(true);
            const fId = params.facultyId as string;
            const code = decodeURIComponent(params.code as string);
            const dId = params.id as string;

            // 1. Get Faculty Name
            const user = await getUser(fId);
            setFacultyName(user?.full_name || "Unknown Faculty");

            // 2. Get Sections
            const allCourses = await getCourses();
            const facultySections = allCourses.filter(c =>
                c.code === code &&
                c.discipline_id === dId &&
                c.instructor_id === fId &&
                (c.students_count || 0) > 0
            );

            const { getInstructorCourseStats } = await import("@/lib/services/lectures-service");

            const formatted: SectionData[] = await Promise.all(facultySections.map(async (sec) => {
                const stats = await getInstructorCourseStats(sec.id, fId);
                return {
                    id: sec.id,
                    name: sec.section || "No Section Assigned",
                    students_count: sec.students_count || 0,
                    presents: stats.presents,
                    absents: stats.absents,
                    discipline: sec.discipline?.name || "N/A",
                    attendance_percentage: stats.percentage
                };
            }));

            setSections(formatted);
            setLoading(false);
        };

        fetchData();
    }, [params]);

    const columns: ColumnDef<SectionData>[] = [
        { accessorKey: "name", header: "Section Name" },
        { accessorKey: "students_count", header: "Students" },
        { accessorKey: "presents", header: "Presents" },
        { accessorKey: "absents", header: "Absents" },
        { accessorKey: "discipline", header: "Discipline" },
        {
            accessorKey: "attendance_percentage",
            header: "Att %",
            cell: ({ row }) => <Badge variant={row.original.attendance_percentage < 75 ? "destructive" : "default"}>{row.original.attendance_percentage}%</Badge>
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <Button variant="ghost" size="sm" className="cursor-pointer text-[#FF8020]" onClick={() => toast.info("View Students implementation would go here (reuse student list)")}>
                    View Students
                </Button>
            )
        }
    ];

    if (loading) return <div>Loading...</div>;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="cursor-pointer pl-0 hover:pl-2 transition-all"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Faculty List
                </Button>

                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">{facultyName}</h1>
                    <p className="text-muted-foreground">Sections for Course: {decodeURIComponent(params.code as string)}</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Sections</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable columns={columns} data={sections} searchKey="name" filename={`${params.code}_${facultyName}_sections`} isLoading={loading} />
                    </CardContent>
                </Card>
            </div>
        </PageWrapper>
    );
}
