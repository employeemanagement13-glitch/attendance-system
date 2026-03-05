"use client"
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, UserPlus, Filter, Edit, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Services
import {
    getInstructors,
    createUser,
    updateUser,
    deleteUser,
    UserWithDepartment,
    CreateUserInput
} from "@/lib/services/users-service";
import { getDepartments } from "@/lib/services/departments-service";
import { getDisciplines, DisciplineWithDetails } from "@/lib/services/disciplines-service";
import { getFacultyAttendance, markFacultyAttendance, FacultyAttendanceStatus, getFacultyStats } from "@/lib/services/faculty-attendance-service";

export default function FacultyManagementPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const filterLowAttendance = searchParams?.get('filter') === 'low';

    const [faculty, setFaculty] = useState<any[]>([]);
    const [filteredFaculty, setFilteredFaculty] = useState<any[]>([]);
    const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [disciplines, setDisciplines] = useState<DisciplineWithDetails[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingFaculty, setEditingFaculty] = useState<UserWithDepartment | null>(null);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState<CreateUserInput>({
        email: "",
        full_name: "",
        role: "instructor",
        department_id: "",
        discipline_id: "",
        phone: "",
        address: "",
        office_location: ""
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [instructors, depts, discl, attendance] = await Promise.all([
                getInstructors(),
                getDepartments(),
                getDisciplines(),
                getFacultyAttendance()
            ]);

            // Combine instructors with their stats
            const instructorsWithStats = await Promise.all(instructors.map(async (f) => {
                const stats = await getFacultyStats(f.id);
                return {
                    ...f,
                    ...stats,
                    discipline: discl.find(d => d.id === f.discipline_id)?.name || "N/A",
                    course: "Computer Science" // Placeholder
                };
            }));

            // Prepare today's attendance data
            const todayData = instructors.map(f => {
                const att = attendance.find(a => a.instructor_id === f.id);
                return {
                    id: f.id,
                    name: f.full_name,
                    discipline: discl.find(d => d.id === f.discipline_id)?.name || "N/A",
                    date: new Date().toLocaleDateString(),
                    on_campus: att?.on_campus || "-",
                    left: att?.left_campus || "-",
                    course: "ICT", // Placeholder
                    status: att?.status || 'absent'
                };
            });

            setFaculty(instructorsWithStats);
            setTodayAttendance(todayData);
            setDepartments(depts);
            setDisciplines(discl);
        } catch (error) {
            toast.error("Failed to load faculty data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter faculty based on URL parameter
    useEffect(() => {
        if (filterLowAttendance) {
            // Filter faculty with attendance below 85%
            const lowAttFaculty = faculty.filter(f => f.percentage < 85);
            setFilteredFaculty(lowAttFaculty);
        } else {
            setFilteredFaculty(faculty);
        }
    }, [faculty, filterLowAttendance]);

    const [selectedFacultyForAttendance, setSelectedFacultyForAttendance] = useState<any>(null);
    const [attendanceFormData, setAttendanceFormData] = useState({
        status: "present",
        on_campus: "",
        left_campus: ""
    });

    const handleMarkStatus = async () => {
        if (!selectedFacultyForAttendance) return;

        const today = new Date().toISOString().split('T')[0];

        await markFacultyAttendance({
            instructor_id: selectedFacultyForAttendance.id,
            date: today,
            status: attendanceFormData.status as FacultyAttendanceStatus,
            on_campus: attendanceFormData.on_campus,
            left_campus: attendanceFormData.left_campus
        });

        // Update local state
        setTodayAttendance(prev => prev.map(item =>
            item.id === selectedFacultyForAttendance.id ? {
                ...item,
                status: attendanceFormData.status,
                on_campus: attendanceFormData.on_campus || "-",
                left: attendanceFormData.left_campus || "-"
            } : item
        ));

        toast.success("Attendance marked");
        setSelectedFacultyForAttendance(null);
    };

    const todayColumns: ColumnDef<any>[] = useMemo(() => [
        { accessorKey: "name", header: "Name" },
        { accessorKey: "id", header: "ID", cell: ({ row }) => row.original.id.slice(0, 8) },
        { accessorKey: "discipline", header: "Discipline" },
        { accessorKey: "date", header: "Date" },
        { accessorKey: "on_campus", header: "Time In" },
        { accessorKey: "left", header: "Time Out" },
        { accessorKey: "course", header: "Course" },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <Button
                    variant="outline"
                    size="sm"
                    className={`w-[140px] justify-start shadow-none ${row.original.status === 'present' ? 'border-green-500 text-green-600 bg-green-50' : row.original.status === 'absent' ? 'border-red-500 text-red-600 bg-red-50' : 'border-yellow-500 text-yellow-600 bg-yellow-50'}`}
                    onClick={() => {
                        setSelectedFacultyForAttendance(row.original);
                        setAttendanceFormData({
                            status: row.original.status === 'absent' ? 'present' : row.original.status,
                            on_campus: row.original.on_campus !== '-' ? row.original.on_campus : '',
                            left_campus: row.original.left !== '-' ? row.original.left : ''
                        });
                    }}
                >
                    <span className="capitalize">{row.original.status}</span>
                    <span className="ml-auto text-xs opacity-50">Edit</span>
                </Button>
            )
        }
    ], []);

    const facultyStatsColumns: ColumnDef<any>[] = useMemo(() => [
        { accessorKey: "full_name", header: "Name" },
        { accessorKey: "id", header: "ID", cell: ({ row }) => row.original.id.slice(0, 8) },
        { accessorKey: "discipline", header: "Discipline" },
        { accessorKey: "course", header: "Course" },
        { accessorKey: "lates", header: "Late" },
        { accessorKey: "absents", header: "Absents" },
        { accessorKey: "shortLeaves", header: "Short Leaves" },
        {
            accessorKey: "percentage",
            header: "Percentage",
            cell: ({ row }) => <span className={row.original.percentage < 75 ? "text-red-500 font-bold" : ""}>{row.original.percentage}%</span>
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/admin/faculty/${row.original.id}`)}>View Profile</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500" onClick={() => deleteUser(row.original.id).then(fetchData)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-black hover:bg-gray-100 cursor-pointer"
                        title="Edit"
                        onClick={() => {
                            setEditingFaculty(row.original);
                            setFormData({
                                email: row.original.email,
                                full_name: row.original.full_name,
                                role: "instructor",
                                department_id: row.original.department_id,
                                discipline_id: row.original.discipline_id || "",
                                phone: row.original.phone,
                                address: row.original.address,
                                office_location: row.original.office_location || ""
                            });
                            setDialogOpen(true);
                        }}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ], [router, disciplines]);

    const handleSubmit = async () => {
        try {
            if (editingFaculty) {
                const res = await updateUser(editingFaculty.id, formData);
                if (res) toast.success("Faculty updated");
            } else {
                const res = await createUser({ ...formData, role: "instructor" });
                if (res) toast.success("Faculty added");
            }
            setDialogOpen(false);
            fetchData();
        } catch (e) {
            toast.error("Operation failed");
        }
    };

    const chartData = faculty.map(f => ({
        name: f.full_name,
        attendance: f.percentage || 0
    })).sort((a, b) => a.attendance - b.attendance);

    return (
        <PageWrapper>
            <div className="space-y-8">
                {/* 1st Component: Today Attendance */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold tracking-tight">Today Attendance</h2>
                    <Card className="bg-white/50 border-none shadow-sm">
                        <CardContent className="p-4">
                            <DataTable
                                columns={todayColumns}
                                data={todayAttendance}
                                searchKey="name"
                                filename="faculty_today_att"
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* 2nd Component: Faculty Attendance Stats */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold tracking-tight">Faculty Attendance</h2>
                        {filterLowAttendance && (
                            <Badge variant="secondary" className="bg-red-100 text-red-700">
                                <Filter className="h-3 w-3 mr-1" />
                                Low Attendance Filter Active
                            </Badge>
                        )}
                    </div>
                    <Card className="bg-white/50 border-none shadow-sm">
                        <CardContent className="p-4">
                            <DataTable
                                columns={facultyStatsColumns}
                                data={filteredFaculty}
                                searchKey="full_name"
                                filename="faculty_list_stats"
                                action={
                                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer" onClick={() => setEditingFaculty(null)}>
                                                <UserPlus className="mr-2 h-4 w-4" /> Add Instructor
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader><DialogTitle>{editingFaculty ? "Edit Faculty" : "Add Faculty"}</DialogTitle></DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label>Full Name</Label>
                                                    <Input value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Email</Label>
                                                    <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled={!!editingFaculty} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Department</Label>
                                                    <Select
                                                        value={formData.department_id}
                                                        onValueChange={v => {
                                                            setFormData({ ...formData, department_id: v, discipline_id: "" });
                                                        }}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                                                        <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Discipline</Label>
                                                    <Select
                                                        value={formData.discipline_id}
                                                        onValueChange={v => setFormData({ ...formData, discipline_id: v })}
                                                        disabled={!formData.department_id}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Select Discipline" /></SelectTrigger>
                                                        <SelectContent>
                                                            {disciplines
                                                                .filter(d => d.department_id === formData.department_id)
                                                                .map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)
                                                            }
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Office Location</Label>
                                                    <Input value={formData.office_location} onChange={e => setFormData({ ...formData, office_location: e.target.value })} placeholder="e.g. Room 302" />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleSubmit} className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer" disabled={loading}>
                                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                    {editingFaculty ? "Update" : "Create"}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                }
                            />
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Bar dataKey="attendance" radius={[4, 4, 0, 0]} barSize={40}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.attendance < 75 ? '#ef4444' : '#FF8020'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
            {/* Mark Attendance Dialog (External to table for stability) */}
            <Dialog open={!!selectedFacultyForAttendance} onOpenChange={(open) => !open && setSelectedFacultyForAttendance(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mark Attendance: {selectedFacultyForAttendance?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={attendanceFormData.status} onValueChange={(v) => setAttendanceFormData({ ...attendanceFormData, status: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="present">Present</SelectItem>
                                    <SelectItem value="late">Late</SelectItem>
                                    <SelectItem value="absent">Absent</SelectItem>
                                    <SelectItem value="short_leave">Short Leave</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Time In</Label>
                                <Input type="time" value={attendanceFormData.on_campus} onChange={(e) => setAttendanceFormData({ ...attendanceFormData, on_campus: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Time Out</Label>
                                <Input type="time" value={attendanceFormData.left_campus} onChange={(e) => setAttendanceFormData({ ...attendanceFormData, left_campus: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleMarkStatus} className="bg-[#FF8020] text-white hover:bg-[#FF8020]/90">Save Attendance</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageWrapper >
    );
}
