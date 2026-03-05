"use client";

import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

import {
    getSettings,
    updateSetting,
    upsertSetting
} from "@/lib/services/settings-service";

export default function SystemSettingsPage() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        setLoading(true);
        const data = await getSettings();
        const settingsMap: Record<string, string> = {};
        data.forEach(s => {
            settingsMap[s.key] = s.value;
        });
        setSettings(settingsMap);
        setLoading(false);
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleUpdate = async (key: string, value: string) => {
        await updateSetting(key, { value });
        await fetchSettings();
    };

    const handleSaveGeneral = async () => {
        try {
            await Promise.all([
                upsertSetting("support_email", settings.support_email || "support@university.edu"),
                upsertSetting("current_semester", settings.current_semester || "Fall 2024"),
                upsertSetting("semester_end_date", settings.semester_end_date || "")
            ]);
            toast.success("General settings saved successfully");
            await fetchSettings();
        } catch (error) {
            toast.error("Failed to save general settings");
        }
    };

    const handleSaveAttendance = async () => {
        try {
            await Promise.all([
                upsertSetting("warning_threshold", settings.warning_threshold || "75"),
                upsertSetting("debarment_threshold", settings.debarment_threshold || "60")
            ]);
            toast.success("Attendance settings saved successfully");
            await fetchSettings();
        } catch (error) {
            toast.error("Failed to save attendance settings");
        }
    };

    return (
        <PageWrapper>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>

                <Tabs defaultValue="general" className="w-full">
                    <TabsList>
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="attendance">Attendance</TabsTrigger>
                        <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>General Settings</CardTitle>
                                <CardDescription>Configure general system parameters</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="support_email">Support Email</Label>
                                        <Input
                                            id="support_email"
                                            type="email"
                                            value={settings.support_email || ""}
                                            onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                                            placeholder="support@university.edu"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="current_semester">Current Semester</Label>
                                        <Input
                                            id="current_semester"
                                            value={settings.current_semester || ""}
                                            onChange={(e) => setSettings({ ...settings, current_semester: e.target.value })}
                                            placeholder="Fall 2024"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="semester_end_date">Semester End Date</Label>
                                        <Input
                                            id="semester_end_date"
                                            type="date"
                                            value={settings.semester_end_date || ""}
                                            onChange={(e) => setSettings({ ...settings, semester_end_date: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={handleSaveGeneral}
                                    className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer"
                                >
                                    Save General Settings
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="attendance" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Attendance Thresholds</CardTitle>
                                <CardDescription>Configure attendance warning and debarment thresholds</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="warning_threshold">Warning Threshold (%)</Label>
                                        <Input
                                            id="warning_threshold"
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={settings.warning_threshold || "75"}
                                            onChange={(e) => setSettings({ ...settings, warning_threshold: e.target.value })}
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Students below this percentage will receive a warning
                                        </p>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="debarment_threshold">Debarment Threshold (%)</Label>
                                        <Input
                                            id="debarment_threshold"
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={settings.debarment_threshold || "60"}
                                            onChange={(e) => setSettings({ ...settings, debarment_threshold: e.target.value })}
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Students below this percentage will be debarred from exams
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleSaveAttendance}
                                    className="bg-[#FF8020] hover:bg-[#FF8020]/90 text-white cursor-pointer"
                                >
                                    Save Attendance Settings
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="maintenance" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Maintenance Mode</CardTitle>
                                <CardDescription>Enable or disable system maintenance mode</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-0.5">
                                    <Label>Maintenance Mode</Label>
                                    <p className="text-sm text-muted-foreground">
                                        When enabled, users will not be able to sign in or sign up.
                                        Only admins can access the system during maintenance.
                                    </p>
                                </div>
                                <RadioGroup
                                    value={settings.maintenance_mode === "true" ? "true" : "false"}
                                    onValueChange={(value) => {
                                        setSettings({ ...settings, maintenance_mode: value });
                                        handleUpdate("maintenance_mode", value);
                                    }}
                                    className="mt-4 space-y-3"
                                >
                                    <div className="flex items-center space-x-3">
                                        <RadioGroupItem value="true" id="maintenance-enabled" />
                                        <Label htmlFor="maintenance-enabled" className="font-normal cursor-pointer">
                                            <span className="font-medium text-red-600">Enabled</span>
                                            <span className="text-muted-foreground"> — System will show maintenance page. Users cannot sign in or sign up.</span>
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <RadioGroupItem value="false" id="maintenance-disabled" />
                                        <Label htmlFor="maintenance-disabled" className="font-normal cursor-pointer">
                                            <span className="font-medium text-green-600">Disabled</span>
                                            <span className="text-muted-foreground"> — System is running normally. All users can access the system.</span>
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </PageWrapper>
    );
}
