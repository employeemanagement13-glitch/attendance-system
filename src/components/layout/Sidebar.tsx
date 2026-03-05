"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Building2,
    Users,
    GraduationCap,
    Calendar,
    UserCheck,
    BookOpen,
    ClipboardList,
    Menu,
    X,
    Settings,
    ShieldAlert,
    HardDrive,
    Bell,
    BarChart,
    UserCog,
    ChevronLeft,
    ChevronRight,
    FileText
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

export function Sidebar() {
    const { user, isLoaded } = useUser();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        const fetchRole = async () => {
            const email = user?.primaryEmailAddress?.emailAddress;
            if (!email) return;

            const { data: rows } = await supabase
                .rpc('get_user_by_email', { p_email: email });

            const dbUser = rows?.[0];
            if (dbUser?.role) {
                setRole(dbUser.role);
            }
        };
        if (isLoaded) fetchRole();
    }, [isLoaded, user]);

    const routes = {
        admin: [
            { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
            { label: "User Management", href: "/admin/users", icon: UserCog },
            { label: "Departments", href: "/admin/departments", icon: Building2 },
            { label: "Faculty", href: "/admin/faculty", icon: Users },
            { label: "Courses", href: "/admin/courses", icon: BookOpen },
            { label: "Exams", href: "/admin/exams", icon: FileText },
            { label: "System Settings", href: "/admin/settings", icon: Settings },
            { label: "Audit Logs", href: "/admin/audit-logs", icon: ShieldAlert },
            { label: "Resources", href: "/admin/resources", icon: HardDrive },
            { label: "Notifications", href: "/admin/notifications", icon: Bell },
        ],
        instructor: [
            { label: "Dashboard", href: "/instructor", icon: LayoutDashboard },
            { label: "Lectures", href: "/instructor/lectures", icon: GraduationCap },
            { label: "Attendance", href: "/instructor/attendance", icon: UserCheck },
            { label: "Materials", href: "/instructor/materials", icon: HardDrive },
            { label: "Assignments", href: "/instructor/assignments", icon: ClipboardList },
            { label: "Analytics", href: "/instructor/analytics", icon: BarChart },
            { label: "Exams", href: "/instructor/exams", icon: FileText },
            { label: "Personal", href: "/instructor/personal", icon: UserCheck },
            { label: "Leaves", href: "/instructor/leaves", icon: Calendar },
            { label: "Notifications", href: "/instructor/notifications", icon: Calendar },
            { label: "Profile", href: "/instructor/profile", icon: UserCog },
        ],
        student: [
            { label: "Dashboard", href: "/student", icon: LayoutDashboard },
            { label: "My Courses", href: "/student/courses", icon: BookOpen },
            { label: "Assignments", href: "/student/assignments", icon: ClipboardList },
            { label: "Resources", href: "/student/resources", icon: HardDrive },
            { label: "Leaves", href: "/student/leaves", icon: Calendar },
            { label: "Profile", href: "/student/profile", icon: UserCog },
            { label: "Schedule", href: "/student/schedule", icon: Calendar },
            { label: "Notifications", href: "/student/notifications", icon: Bell },
        ],
    };

    if (!role) return null;

    const currentRoutes = routes[role as keyof typeof routes] || routes.student;

    return (
        <motion.div
            initial={false}
            animate={{ width: collapsed ? 80 : 256 }}
            className={cn(
                "relative flex bg-white flex-col h-full border-r border-sidebar-border shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
                // Ensure Sidebar takes full width on its mobile container
                "w-full lg:w-auto"
            )}
        >
            <div className="flex items-center h-20 px-4 mb-4">
                <AnimatePresence mode="wait">
                    {!collapsed && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex items-center gap-2"
                        >
                            <div className="h-8 w-8 rounded-lg bg-[#FF8020] flex items-center justify-center">
                                <GraduationCap className="h-5 w-5 text-white" />
                            </div>
                            <span className="font-bold text-xl tracking-tight text-foreground">Attendance</span>
                        </motion.div>
                    )}
                </AnimatePresence>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        "hover:bg-orange-50 text-[#FF8020] cursor-pointer ml-auto transition-transform duration-300",
                        collapsed && "mx-auto"
                    )}
                >
                    {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 scrollbar-hide">
                <nav className="space-y-1">
                    {currentRoutes.map((route) => {
                        const Icon = route.icon;
                        const isActive = pathname === route.href;

                        return (
                            <Link
                                key={route.href}
                                href={route.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                                    isActive
                                        ? "bg-linear-to-r from-orange-500 to-orange-400 text-white shadow-md shadow-orange-200"
                                        : "text-muted-foreground hover:bg-orange-50 hover:text-orange-600",
                                    collapsed && "justify-center px-0 h-10 w-10 mx-auto"
                                )}
                                title={collapsed ? route.label : undefined}
                            >
                                <Icon className={cn("h-5 w-5 shrink-0", !isActive && "group-hover:scale-110 transition-transform")} />
                                {!collapsed && <span className="truncate">{route.label}</span>}
                                {isActive && collapsed && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-orange-500 rounded-xl -z-10"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* User Profile Section */}
            <div className="p-4 border-t border-sidebar-border mt-auto">
                <div className={cn(
                    "flex items-center gap-3 rounded-2xl bg-slate-50 p-2",
                    collapsed ? "justify-center p-1" : ""
                )}>
                    <UserButton afterSignOutUrl="/" />
                    {!collapsed && (
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold truncate text-foreground">
                                {user?.fullName || "User"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                {role}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
