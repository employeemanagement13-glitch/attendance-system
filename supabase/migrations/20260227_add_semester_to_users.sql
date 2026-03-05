-- =========================================================================
-- USER TABLE SCHEMA ENHANCEMENT
-- Adds missing columns for Discipline and Current Semester tracking
-- =========================================================================

DO $$ 
BEGIN
    -- Add discipline_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='discipline_id') THEN
        ALTER TABLE public.users ADD COLUMN discipline_id UUID REFERENCES public.disciplines(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added discipline_id column to users table';
    END IF;

    -- Add current_semester if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='current_semester') THEN
        ALTER TABLE public.users ADD COLUMN current_semester INTEGER DEFAULT 1;
        RAISE NOTICE '✅ Added current_semester column to users table';
    END IF;
END $$;
