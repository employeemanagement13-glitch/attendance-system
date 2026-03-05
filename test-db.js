const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: eData } = await supabase.from('enrollments').select('*').limit(1);
    console.log('Enrollments:', JSON.stringify(eData, null, 2));

    const { data: nData } = await supabase.from('notifications').select('*').limit(1);
    console.log('\nNotifications:', JSON.stringify(nData, null, 2));

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread');

    console.log('\nGlobal Unread Count:', count);
}

run();
