"use client";

import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { DataTable } from "@/components/shared/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Eye, Edit, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

// Services
import { getDisciplines, createDiscipline, updateDiscipline, deleteDiscipline, DisciplineWithDetails } from "@/lib/services/disciplines-service";
import { getDepartments } from "@/lib/services/departments-service";

export default function DisciplinesPage() {
    const [disciplines, setDisciplines] = useState<DisciplineWithDetails[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingDiscipline, setEditingDiscipline] = useState<DisciplineWithDetails | null>(null);
    const [formData, setFormData] = useState({ name: "", department_id: "" });

    const fetchData = async () => {
        setLoading(true);
        const [dData, deptData] = await Promise.all([
            getDisciplines(),
            getDepartments()
        ]);
        setDisciplines(dData);
        setDepartments(deptData);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSave = async () => {
        if (!formData.name || !formData.department_id) {
            toast.error("Please fill all fields");
            return;
        }

        setIsSubmitting(true);

        if (editingDiscipline) {
            const result = await updateDiscipline(editingDiscipline.id, formData);
            if (result) {
                setDialogOpen(false);
                setFormData({ name: "", department_id: "" });
                setEditingDiscipline(null);
                fetchData();
            }
        } else {
            const result = await createDiscipline(formData);
            if (result) {
                setDialogOpen(false);
                setFormData({ name: "", department_id: "" });
                fetchData();
            }
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure? This will delete all associated courses.")) {
            const success = await deleteDiscipline(id);
            if (success) fetchData();
        }
    };

    const columns: ColumnDef<DisciplineWithDetails>[] = [
        {
            accessorKey: "name",
            header: "Discipline Name",
            cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>
        },
        {
            accessorKey: "department.name",
            header: "Department",
        },
        {
            accessorKey: "courses_count",
            header: "Courses",
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-black hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                            setEditingDiscipline(row.original);
                            setFormData({ name: row.original.name, department_id: row.original.department_id });
                            setDialogOpen(true);
                        }}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Link href={`/admin/disciplines/${row.original.id}`}>
                        <Button variant="ghost" size="icon" className="cursor-pointer" asChild>
                            <span><Eye className="h-4 w-4" /></span>
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 cursor-pointer"
                        onClick={() => handleDelete(row.original.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <PageWrapper>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Disciplines</h1>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer" onClick={() => { setEditingDiscipline(null); setFormData({ name: "", department_id: "" }); }}>
                                <Plus className="mr-2 h-4 w-4" /> Add Discipline
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingDiscipline ? "Edit Discipline" : "Add New Discipline"}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. BSCS"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="department">Department</Label>
                                    <Select
                                        value={formData.department_id}
                                        onValueChange={(val) => setFormData({ ...formData, department_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map((d) => (
                                                <SelectItem key={d.id} value={d.id} className="cursor-pointer">{d.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Cancel</Button>
                                <Button disabled={isSubmitting} onClick={handleSave} className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {editingDiscipline ? "Update" : "Create"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <DataTable columns={columns} data={disciplines} searchKey="name" filename="disciplines_list" />
            </div>
        </PageWrapper>
    );
}
