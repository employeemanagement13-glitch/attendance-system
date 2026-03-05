"use client";

import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Services
import { getExams, ExamWithDetails } from "@/lib/services/exams-service";
import { getCourses } from "@/lib/services/courses-service";

export default function ExamsPage() {
    const [allExams, setAllExams] = useState<ExamWithDetails[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [disciplines, setDisciplines] = useState<any[]>([]);

    // Filters
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");
    const [selectedSemester, setSelectedSemester] = useState<string>("all");
    const [selectedCourse, setSelectedCourse] = useState<string>("all");

    const fetchData = async () => {
        const [examsData, coursesData, disciplinesData] = await Promise.all([
            getExams(),
            getCourses(),
            // @ts-ignore
            import("@/lib/services/disciplines-service").then(m => m.getDisciplines())
        ]);

        setCourses(coursesData);
        setDisciplines(disciplinesData);
        setAllExams(examsData);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Apply filters
    const filteredExams = allExams.filter(e => {
        if (selectedDiscipline !== "all" && e.discipline_id !== selectedDiscipline) return false;
        if (selectedSemester !== "all" && e.semester.toString() !== selectedSemester) return false;
        if (selectedCourse !== "all" && e.course_id !== selectedCourse) return false;
        return true;
    });

    const mids = filteredExams.filter(e => e.type === 'mids');
    const finals = filteredExams.filter(e => e.type === 'finals');
    const quizzes = filteredExams.filter(e => e.type === 'quiz');

    const columns: ColumnDef<ExamWithDetails>[] = [
        {
            accessorKey: "name",
            header: "Exam Name",
        },
        {
            accessorKey: "course.code",
            header: "Course",
            cell: ({ row }) => (
                <div>
                    <span className="font-bold">{row.original.course?.code}</span>
                    <p className="text-xs text-muted-foreground">{row.original.course?.name}</p>
                </div>
            )
        },
        {
            id: "discipline",
            header: "Discipline",
            cell: ({ row }) => row.original.discipline?.name || "—"
        },
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => new Date(row.getValue("date")).toLocaleDateString()
        },
        {
            accessorKey: "semester",
            header: "Sem",
            cell: ({ row }) => <Badge variant="outline">{row.getValue("semester")}</Badge>
        },
        {
            accessorKey: "students_count",
            header: "Students",
        },
        {
            accessorKey: "average_percentage",
            header: "Avg %",
            cell: ({ row }) => `${row.getValue("average_percentage") ?? 0}%`
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <Link href={`/admin/exams/${row.original.id}`}>
                    <Button variant="ghost" size="icon" className="cursor-pointer">
                        <Eye className="h-4 w-4" />
                    </Button>
                </Link>
            )
        }
    ];

    return (
        <PageWrapper>
            <div className="space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h1 className="text-3xl font-bold tracking-tight">Exams Overview</h1>
                    <div className="flex gap-2 items-center flex-wrap">
                        <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter Discipline" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Disciplines</SelectItem>
                                {disciplines.map((d: any) => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Semester" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Semesters</SelectItem>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                    <SelectItem key={s} value={s.toString()}>Sem {s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Filter Course" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Courses</SelectItem>
                                {courses.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Tabs defaultValue="mids" className="w-full">
                    <TabsList>
                        <TabsTrigger value="mids" className="cursor-pointer">Mids ({mids.length})</TabsTrigger>
                        <TabsTrigger value="finals" className="cursor-pointer">Finals ({finals.length})</TabsTrigger>
                        <TabsTrigger value="quiz" className="cursor-pointer">Quizzes ({quizzes.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="mids">
                        <Card>
                            <CardHeader>
                                <CardTitle>Mid Term Examinations</CardTitle>
                                <CardDescription>All mid term exams across the system</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DataTable columns={columns} data={mids} searchKey="name" filename="mids_exams" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="finals">
                        <Card>
                            <CardHeader>
                                <CardTitle>Final Examinations</CardTitle>
                                <CardDescription>All final exams across the system</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DataTable columns={columns} data={finals} searchKey="name" filename="finals_exams" />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="quiz">
                        <Card>
                            <CardHeader>
                                <CardTitle>Quizzes</CardTitle>
                                <CardDescription>All quizzes across the system</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DataTable columns={columns} data={quizzes} searchKey="name" filename="quizzes" />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </PageWrapper>
    );
}
