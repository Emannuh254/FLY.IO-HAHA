// test-env.js
require('dotenv').config();

console.log('=== Environment Variables Test ===');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '[HIDDEN]' : 'MISSING');
console.log('PORT:', process.env.PORT);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '[HIDDEN]' : 'MISSING');
console.log('NODE_ENV:', process.env.NODE_ENV);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('\n❌ ERROR: Required Supabase environment variables are missing!');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set correctly!');
}