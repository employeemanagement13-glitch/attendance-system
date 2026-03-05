-- ============================================================
-- RLS FIX FOR REDIRECTION
-- Root Cause: App uses Clerk auth + Supabase data WITHOUT 
-- Supabase JWT integration. auth.uid() is always NULL, so ALL 
-- RLS policies block every query from the app.
--
-- Solution: SECURITY DEFINER functions bypass RLS completely.
-- They run as the database superuser regardless of who calls them.
-- ============================================================

-- Step 1: Ensure clerk_id column exists (Safe/Idempotent)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='clerk_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN clerk_id TEXT UNIQUE;
    END IF;
END $$;

-- Step 2: Function to look up a user's role by email (BYPASSES RLS)
-- Called from page.tsx server-side during sign-in redirection
CREATE OR REPLACE FUNCTION public.get_user_by_email(p_email TEXT)
RETURNS TABLE(id UUID, role TEXT, clerk_id TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.role::TEXT, u.clerk_id
    FROM public.users u
    WHERE u.email = p_email
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_by_email(TEXT) TO anon, authenticated;

-- Step 3: Function to sync Clerk ID to an existing user (BYPASSES RLS)
CREATE OR REPLACE FUNCTION public.sync_clerk_id(p_email TEXT, p_clerk_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users 
    SET clerk_id = p_clerk_id,
        status = 'active'
    WHERE email = p_email AND (clerk_id IS NULL OR clerk_id = '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.sync_clerk_id(TEXT, TEXT) TO anon, authenticated;

-- Step 4: Helper for get_auth_role used by other RLS policies
-- Looks up role by clerk_id for Supabase-native JWT users
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
    SELECT role::TEXT FROM public.users WHERE clerk_id = auth.uid()::TEXT LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
