// supabaseClient.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Check if environment variables are loaded
console.log('Environment Variables Check:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Found' : 'Missing');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase configuration is missing in environment variables');
  console.error('Please check your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;