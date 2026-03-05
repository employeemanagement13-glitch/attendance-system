"use client";

import { useState, useEffect } from "react";
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
import { FileText, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { getUserByEmail } from "@/lib/services/users-service";
import {
    getStudentResources,
    ResourceWithDetails,
    formatFileSize,
    downloadResourceFile
} from "@/lib/services/resources-service";

export default function StudentResourcesPage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [resources, setResources] = useState<ResourceWithDetails[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchData = async () => {
        if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

        try {
            const userDetails = await getUserByEmail(user.primaryEmailAddress.emailAddress);
            if (userDetails && userDetails.role === 'student') {
                const data = await getStudentResources(userDetails.id);
                setResources(data);
            }
        } catch (error) {
            console.error("Error loading resources:", error);
            toast.error("Failed to load resources");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isLoaded, user]);

    const handleDownload = async (resource: ResourceWithDetails) => {
        try {
            let fileName = resource.name;
            const extension = resource.file_path.split('.').pop();
            if (extension && !fileName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
                fileName = `${fileName}.${extension}`;
            }

            toast.info(`Starting download: ${fileName}`);
            await downloadResourceFile(resource.file_path, fileName, 'course-materials');
        } catch (error) {
            console.error("Error downloading file:", error);
            toast.error("Failed to download file");
        }
    };

    const filteredResources = resources.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.course?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.course?.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Course Resources</h1>
                <p className="text-muted-foreground">Access learning materials for your courses</p>
            </div>

            <div className="flex items-center justify-between">
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search resources..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>File Name</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Uploaded By</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredResources.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">
                                    No resources found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredResources.map((resource) => (
                                <TableRow key={resource.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            {resource.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{resource.course?.name || "General Material"}</div>
                                        <div className="text-xs text-muted-foreground">{resource.course?.code || "All Users"}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="uppercase">
                                            {resource.file_type?.split('/')[1] || 'FILE'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatFileSize(resource.file_size || 0)}</TableCell>
                                    <TableCell>{resource.uploader?.full_name || 'Unknown'}</TableCell>
                                    <TableCell>{format(new Date(resource.created_at), 'MMM d, yyyy')}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownload(resource)}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
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
