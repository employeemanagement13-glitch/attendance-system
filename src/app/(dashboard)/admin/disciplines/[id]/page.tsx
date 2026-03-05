"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Users, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

// Services
import { getDiscipline, DisciplineWithDetails } from "@/lib/services/disciplines-service";
import { getCourses, CourseWithDetails } from "@/lib/services/courses-service";

type AbstractCourse = {
    code: string;
    name: string;
    credit_hours: number;
    total_students: number;
    total_sections: number;
    total_faculty: number;
    semester: number;
    courseIds: string[]; // Track all course IDs for this code
};

export default function DisciplineDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [discipline, setDiscipline] = useState<DisciplineWithDetails | null>(null);
    const [abstractCourses, setAbstractCourses] = useState<AbstractCourse[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!params.id) return;
            setLoading(true);
            const dId = params.id as string;

            const [dData, cData] = await Promise.all([
                getDiscipline(dId),
                getCourses()
            ]);

            if (!dData) {
                toast.error("Discipline not found");
                router.push("/admin/disciplines");
                return;
            }

            setDiscipline(dData);

            // Filter courses by discipline
            const disciplineCourses = cData.filter(c => c.discipline_id === dId);

            // Group by Code to create Abstract Courses
            const grouped = disciplineCourses.reduce((acc, course) => {
                if (!acc[course.code]) {
                    acc[course.code] = {
                        code: course.code,
                        name: course.name,
                        credit_hours: course.credit_hours,
                        total_students: 0,
                        total_sections: 0,
                        instructors: new Set<string>(),
                        semester: course.semester,
                        courseIds: []
                    };
                }
                acc[course.code].total_students += course.students_count || 0;
                acc[course.code].total_sections += 1;
                acc[course.code].courseIds.push(course.id);
                if (course.instructor_id) {
                    acc[course.code].instructors.add(course.instructor_id);
                }
                return acc;
            }, {} as Record<string, any>);

            const formatted: AbstractCourse[] = Object.values(grouped).map((g: any) => ({
                code: g.code,
                name: g.name,
                credit_hours: g.credit_hours,
                total_students: g.total_students,
                total_sections: g.total_sections,
                total_faculty: g.instructors.size,
                semester: g.semester,
                courseIds: g.courseIds
            }));

            setAbstractCourses(formatted);
            setLoading(false);
        };

        fetchDetails();
    }, [params.id, router]);

    const columns: ColumnDef<AbstractCourse>[] = [
        {
            accessorKey: "name",
            header: "Course Name",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.code}</span>
                    <span className="text-xs text-muted-foreground">{row.original.name}</span>
                </div>
            )
        },
        {
            accessorKey: "semester",
            header: "Sem",
            cell: ({ row }) => <Badge variant="outline">{row.original.semester}</Badge>
        },
        {
            accessorKey: "total_sections",
            header: "Sections",
            cell: ({ row }) => <Badge variant="secondary">{row.original.total_sections}</Badge>
        },
        {
            accessorKey: "total_faculty",
            header: "Faculty",
            cell: ({ row }) => <div className="flex items-center gap-1"><Users className="h-3 w-3" /> {row.original.total_faculty}</div>
        },
        {
            accessorKey: "total_students",
            header: "Students",
            cell: ({ row }) => <div className="flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {row.original.total_students}</div>
        },
        {
            accessorKey: "credit_hours",
            header: "Credits",
        },
        {
            id: "actions",
            cell: ({ row }) => {
                // If single section, go directly to course detail page
                // If multiple sections, go to faculty breakdown page
                const href = row.original.total_sections === 1
                    ? `/admin/courses/${row.original.courseIds[0]}`
                    : `/admin/disciplines/${params.id}/courses/${row.original.code}`;
                return (
                    <Link href={href}>
                        <Button variant="ghost" size="sm" className="cursor-pointer text-[#FF8020]">
                            View Breakdown
                        </Button>
                    </Link>
                );
            }
        }
    ];

    if (loading) return <div>Loading...</div>;
    if (!discipline) return <div>Not found</div>;

    return (
        <PageWrapper>
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="cursor-pointer pl-0 hover:pl-2 transition-all"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Disciplines
                </Button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{discipline.name}</h1>
                        <p className="text-muted-foreground">{discipline.department?.name}</p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{abstractCourses.length}</div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Unique Courses</CardTitle>
                        <CardDescription>All unique courses offered in {discipline.name} (Grouped by Code)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DataTable columns={columns} data={abstractCourses} searchKey="name" filename={`${discipline.name}_courses_abstract`} />
                    </CardContent>
                </Card>
            </div>
        </PageWrapper>
    );
}
