"use client";

import { useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface ExpandableTextProps {
    text: string;
    limit?: number;
}

export function ExpandableText({ text, limit = 50 }: ExpandableTextProps) {
    if (!text) return <span className="text-muted-foreground italic">No description</span>;
    if (text.length <= limit) return <span>{text}</span>;

    const truncated = text.substring(0, limit) + "...";

    return (
        <div className="flex items-center gap-1">
            <span title={text}>{truncated}</span>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer">
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
                </PopoverContent>
            </Popover>
        </div>
    );
}
