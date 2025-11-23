// setup-db.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  try {
    console.log('Setting up database with Supabase...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'supabase-setup.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sql.split(';').filter(statement => statement.trim());
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error('Error executing SQL:', error);
          throw error;
        }
      }
    }
    
    console.log('Database setup completed successfully!');
  } catch (err) {
    console.error('Database setup failed:', err);
    process.exit(1);
  }
}

setupDatabase();