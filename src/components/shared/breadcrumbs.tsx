"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

export function Breadcrumbs() {
    const pathname = usePathname();

    // Skip breadcrumbs on main dashboard roots if desired, or show generic "Home"
    const paths = pathname.split("/").filter((path) => path);

    if (paths.length === 0) return null;

    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link href="/" className="hover:text-foreground transition-colors">
                <Home className="h-4 w-4" />
            </Link>
            {paths.map((path, index) => {
                const href = `/${paths.slice(0, index + 1).join("/")}`;
                const isLast = index === paths.length - 1;

                // Capitalize and format path segment
                const label = path
                    .replace(/-/g, " ")
                    .replace(/%20/g, " ") // handle encoded spaces if any
                    .replace(/\b\w/g, (char) => char.toUpperCase());

                return (
                    <Fragment key={path}>
                        <ChevronRight className="h-4 w-4" />
                        {isLast ? (
                            <span className="font-medium text-foreground">{label}</span>
                        ) : (
                            <Link href={href} className="hover:text-foreground transition-colors">
                                {label}
                            </Link>
                        )}
                    </Fragment>
                );
            })}
        </div>
    );
}
