import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await currentUser();

    if (!user || !user.emailAddresses[0]) {
        redirect("/sign-in");
    }

    const email = user.emailAddresses[0].emailAddress;

    // Use SECURITY DEFINER RPC to bypass RLS
    // (Direct queries are blocked because auth.uid() is NULL with Clerk auth)
    const { data: rows } = await supabase
        .rpc('get_user_by_email', { p_email: email });

    const dbUser = rows?.[0];

    if (!dbUser || dbUser.role !== 'admin') {
        redirect("/");
    }

    return <>{children}</>;
}
