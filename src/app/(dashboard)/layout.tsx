"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-background w-full relative">
            {/* Sidebar with mobile overlay logic */}
            <div className={cn(
                "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
                isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )} onClick={() => setIsMobileMenuOpen(false)} />

            <div className={cn(
                "fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <Sidebar />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden w-full">
                <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
                    <div className="max-w-[1400px] mx-auto w-full">
                        <Breadcrumbs />
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
