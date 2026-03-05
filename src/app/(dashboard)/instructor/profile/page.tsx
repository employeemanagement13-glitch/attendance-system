"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { PageWrapper } from "@/components/shared/page-wrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function InstructorProfilePage() {
    const { user, isLoaded } = useUser();
    const [profile, setProfile] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            const email = user?.primaryEmailAddress?.emailAddress;
            if (!email) return;
            const { data: rows } = await supabase.rpc('get_user_by_email', { p_email: email });
            if (rows?.[0]) {
                // Fetch full profile with extra fields
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', rows[0].id)
                    .single();
                setProfile(data);
            }
        };
        if (isLoaded) fetchProfile();
    }, [isLoaded, user]);

    const handleSave = async () => {
        if (!profile?.id) return;
        setSaving(true);
        const { error } = await supabase
            .from('users')
            .update({
                full_name: profile.full_name,
                phone: profile.phone,
                designation: profile.designation,
                education: profile.education,
                office_location: profile.office_location,
                daily_time_start: profile.daily_time_start,
                daily_time_end: profile.daily_time_end,
                availability: profile.availability,
                address: profile.address,
            })
            .eq('id', profile.id);

        // Also sync the name to Clerk so Sidebar & Navbar update immediately
        if (!error && user && profile.full_name) {
            try {
                const nameParts = profile.full_name.trim().split(/\s+/);
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                await user.update({ firstName, lastName });
            } catch (clerkError) {
                console.error('Failed to sync name to Clerk:', clerkError);
                // Non-critical - DB update already succeeded
            }
        }

        setSaving(false);
        if (error) toast.error('Failed to save changes');
        else toast.success('Profile updated successfully');
    };

    const set = (key: string, value: string) => setProfile((p: any) => ({ ...p, [key]: value }));

    if (!isLoaded || !profile) {
        return <PageWrapper><div className="p-8 text-center text-muted-foreground">Loading profile...</div></PageWrapper>;
    }

    const initials = (profile.full_name || "?").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

    return (
        <PageWrapper>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">Profile & Settings</h1>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Personal Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Personal Information</CardTitle>
                            <CardDescription>Manage your profile details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarFallback className="bg-[#FF8020] text-white text-xl font-bold">{initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{profile.full_name}</p>
                                    <p className="text-sm text-muted-foreground">{profile.designation || "Faculty Member"}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid gap-2">
                                <Label>Full Name</Label>
                                <Input value={profile.full_name || ""} onChange={e => set('full_name', e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Email</Label>
                                <Input value={profile.email || ""} disabled />
                            </div>
                            <div className="grid gap-2">
                                <Label>Phone</Label>
                                <Input value={profile.phone || ""} onChange={e => set('phone', e.target.value)} placeholder="+1 234 567 890" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Designation</Label>
                                <Input value={profile.designation || ""} onChange={e => set('designation', e.target.value)} placeholder="Professor, Associate Professor..." />
                            </div>
                            <div className="grid gap-2">
                                <Label>Education</Label>
                                <Input value={profile.education || ""} onChange={e => set('education', e.target.value)} placeholder="PhD in Computer Science" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Office Location</Label>
                                <Input value={profile.office_location || ""} onChange={e => set('office_location', e.target.value)} placeholder="SST-804V" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Address</Label>
                                <Input value={profile.address || ""} onChange={e => set('address', e.target.value)} />
                            </div>
                            <Button className="w-full bg-[#FF8020] hover:bg-[#E6721C] text-white" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Schedule Settings */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Availability</CardTitle>
                                <CardDescription>Set your working hours and availability.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>Availability Days</Label>
                                    <Input value={profile.availability || ""} onChange={e => set('availability', e.target.value)} placeholder="Monday - Friday" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Start Time</Label>
                                        <Input type="time" value={profile.daily_time_start || ""} onChange={e => set('daily_time_start', e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>End Time</Label>
                                        <Input type="time" value={profile.daily_time_end || ""} onChange={e => set('daily_time_end', e.target.value)} />
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full" onClick={handleSave} disabled={saving}>
                                    Save Availability
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Account Info</CardTitle>
                                <CardDescription>Your system role and status.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Role</span>
                                    <span className="font-medium capitalize">{profile.role}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className={`font-medium capitalize ${profile.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>{profile.status}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Member Since</span>
                                    <span className="font-medium">{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
}
