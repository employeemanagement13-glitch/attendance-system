"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getUserByEmail, updateUser } from "@/lib/services/users-service";

export default function StudentProfilePage() {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [userData, setUserData] = useState<any>(null);

    // Form fields
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            if (!isLoaded || !user?.primaryEmailAddress?.emailAddress) return;

            try {
                const data = await getUserByEmail(user.primaryEmailAddress.emailAddress);
                if (data) {
                    setUserData(data);
                    setPhone(data.phone || "");
                    setAddress(data.address || "");
                }
            } catch (error) {
                console.error("Error loading profile:", error);
                toast.error("Failed to load profile");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isLoaded, user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userData) return;

        try {
            setSubmitting(true);
            await updateUser(userData.id, {
                phone,
                address
            });
            toast.success("Profile updated successfully");
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Failed to update profile");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isLoaded || loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
                <p className="text-muted-foreground">Manage your personal information</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Full Name</Label>
                            <Input value={userData.full_name || ""} disabled />
                        </div>
                        <div className="grid gap-2">
                            <Label>Email</Label>
                            <Input value={userData.email || ""} disabled />
                        </div>
                        <div className="grid gap-2">
                            <Label>Role</Label>
                            <Input value={userData.role} disabled className="capitalize" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Discipline</Label>
                            <Input value={userData.discipline?.name || "N/A"} disabled />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+1 234 567 8900"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="123 University St"
                                />
                            </div>
                            <Button type="submit" disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
