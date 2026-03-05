import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL: Supabase Env Vars missing!");
    console.log("URL:", supabaseUrl ? "Set" : "Missing");
    console.log("Key:", supabaseKey ? "Set" : "Missing");
}

export const supabase = createClient(supabaseUrl, supabaseKey)
