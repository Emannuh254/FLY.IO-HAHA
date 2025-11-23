// test-admin.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://pjofkrbxuwftrfejvbsk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqb2ZrcmJ4dXdmdHJmZWp2YnNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDg2NzAsImV4cCI6MjA3NzkyNDY3MH0.0_MTj-iwaTUdFfL2rSXGMq0LM4_9Hpuqj5dcWZ_fN6k';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAdmin() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'mannuh')
    .eq('role', 'admin')
    .single();
  
  if (error) {
    console.error('Error fetching admin:', error);
  } else {
    console.log('Admin user found:', data);
  }
}

testAdmin();