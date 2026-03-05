"use client";

import { SignUp } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function Page() {
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkMaintenance();
    }, []);

    const checkMaintenance = async () => {
        try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data } = await supabase
                .from("system_settings")
                .select("value")
                .eq("key", "maintenance_mode")
                .maybeSingle();

            if (data?.value === "true") {
                setMaintenanceMode(true);
            }
        } catch {
            // If check fails, allow signup
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F3F5F7]">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (maintenanceMode) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F3F5F7]">
                <div className="max-w-md text-center p-8 rounded-xl border border-gray-200 shadow-sm bg-white">
                    <div className="text-6xl mb-4">🔧</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">System Under Maintenance</h1>
                    <p className="text-gray-600 mb-4">
                        The attendance system is currently undergoing maintenance.
                        Please try again later.
                    </p>
                    <p className="text-sm text-gray-400">
                        If you are an administrator, please contact the system admin directly.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#F3F5F7]">
            <SignUp
                appearance={{
                    elements: {
                        formButtonPrimary: "bg-[#FF8020] hover:bg-[#E5721C] text-sm normal-case",
                        footerActionLink: "text-[#FF8020] hover:text-[#E5721C]",
                        card: "rounded-xl border border-gray-200 shadow-sm"
                    }
                }}
            />
        </div>
    );
}
