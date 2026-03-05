-- ============================================
-- FIX VIEW & TABLE PERMISSIONS
-- Run this in your Supabase SQL Editor
-- ============================================

-- Grant SELECT on the discipline_attendance_stats view
GRANT SELECT ON discipline_attendance_stats TO anon, authenticated;

-- Ensure all tables have proper permissions for authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- Grant read access to anon for public views
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- If there are any other views, grant them too
DO $$
DECLARE
    v RECORD;
BEGIN
    FOR v IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'GRANT SELECT ON public.' || quote_ident(v.viewname) || ' TO anon, authenticated;';
    END LOOP;
END $$;
