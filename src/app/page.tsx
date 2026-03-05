import { Button } from "@/components/ui/button";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function Home() {
  const user = await currentUser();

  if (user) {
    const role = user.publicMetadata?.role as string;

    // 1. Try Clerk Metadata first (fastest, set by admin via Clerk Dashboard)
    if (role) {
      if (role === 'admin') redirect("/admin");
      if (role === 'instructor') redirect("/instructor");
      if (role === 'student') redirect("/student");
    }

    // 2. Fallback: Use SECURITY DEFINER RPC to bypass RLS
    // Direct table queries are blocked because Supabase auth.uid() is NULL
    // when using Clerk — Clerk JWTs are not forwarded to Supabase.
    const email = user.emailAddresses[0]?.emailAddress;
    if (email) {
      const { data: rows, error } = await supabase
        .rpc('get_user_by_email', { p_email: email });

      if (error) {
        console.error('[page.tsx] RPC get_user_by_email error:', error.message);
      }

      const dbUser = rows?.[0];

      if (dbUser) {
        // Sync clerk_id if missing (first-time login from this device)
        if (!dbUser.clerk_id) {
          await supabase.rpc('sync_clerk_id', {
            p_email: email,
            p_clerk_id: user.id
          });
        }

        if (dbUser.role === 'admin') redirect("/admin");
        if (dbUser.role === 'instructor') redirect("/instructor");
        if (dbUser.role === 'student') redirect("/student");
      } else {
        console.warn('[page.tsx] No user found in DB for email:', email);
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-6">
      <h1 className="text-4xl font-bold font-sans">Attendance Management System</h1>
      <p className="text-muted-foreground text-lg text-center max-w-md">
        Welcome to the university attendance portal. Please sign in to continue.
      </p>
      <div className="flex gap-4">
        <Link href="/sign-in">
          <Button size="lg" className="w-32">Sign In</Button>
        </Link>
        <Link href="/sign-up">
          <Button variant="outline" size="lg" className="w-32">Sign Up</Button>
        </Link>
      </div>
    </div>
  );
}
