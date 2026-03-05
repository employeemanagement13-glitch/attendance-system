import { Card } from "@/components/ui/card";

interface StatsCardProps {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
}

export function StatsCard({ label, value, icon }: StatsCardProps) {
    return (
        <Card className="rounded-xl shadow-sm bg-white p-6 flex justify-between border border-border min-h-[100px]">
            <div className="flex justify-between items-center w-full">
                <span className="text-gray-500 text-sm font-medium mb-1">{label}</span>
                {icon && <div className="text-[#FF8020]">{icon}</div>}
            </div>
            <span className="text-3xl font-bold text-foreground">{value}</span>
        </Card>
    );
}

