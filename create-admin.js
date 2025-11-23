// admin-fix.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// =========================
// CONFIGURATION
// =========================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const ADMIN_EMAIL = "mannuh";
const ADMIN_PASSWORD = "mannuh";     // Password you will use to login
const JWT_SECRET = "forexpro-secret-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================
// MAIN FUNCTION
// =========================
async function fixAdmin() {
    console.log("🔧 Starting Admin Reset...");
    console.log("Admin Email:", ADMIN_EMAIL);
    console.log("Admin Password:", ADMIN_PASSWORD);
    console.log("");

    // 1. DELETE EXISTING ADMIN
    console.log("1️⃣  Deleting existing admin (if any)...");
    const { error: deleteErr } = await supabase
        .from("users")
        .delete()
        .eq("email", ADMIN_EMAIL)
        .eq("role", "admin");

    if (deleteErr) {
        console.log("   ⚠️ Delete error (probably no admin existed):", deleteErr.message);
    } else {
        console.log("   ✅ Old admin removed");
    }

    // 2. CREATE NEW ADMIN
    console.log("\n2️⃣  Creating NEW admin...");

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const { data: newAdmin, error: insertErr } = await supabase
        .from("users")
        .insert([
            {
                name: "Admin User",
                email: ADMIN_EMAIL,
                password: hashedPassword,
                role: "admin",
                balance: 1000000,
                currency: "USD",
                created_at: new Date().toISOString()
            }
        ])
        .select()
        .single();

    if (insertErr) {
        console.error("❌ INSERT ERROR:", insertErr.message);
        return;
    }

    console.log("   ✅ New admin created!");
    console.log("   ID:", newAdmin.id);

    // 3. VERIFY HASH
    console.log("\n3️⃣  Verifying password hash...");
    const ok = await bcrypt.compare(ADMIN_PASSWORD, newAdmin.password);
    if (!ok) {
        console.log("   ❌ Hash test failed!");
        return;
    }
    console.log("   ✅ Hash verified correctly");

    // 4. BACKUP LOCAL JSON
    console.log("\n4️⃣  Saving backup...");
    const backup = {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        hash: newAdmin.password,
        date: new Date().toISOString()
    };
    fs.writeFileSync("admin-backup.json", JSON.stringify(backup, null, 2));
    console.log("   ✅ Backup saved → admin-backup.json");

    // 5. FINAL CONFIRMATION
    console.log("\n5️⃣  Final DB check...");
    const { data: check, error: checkErr } = await supabase
        .from("users")
        .select("id, email, role")
        .eq("email", ADMIN_EMAIL)
        .eq("role", "admin")
        .single();

    if (checkErr) {
        console.log("❌ Final check failed:", checkErr.message);
        return;
    }

    console.log("   ✅ Admin exists in DB");
    console.log("   Email:", check.email);
    console.log("   Role:", check.role);

    console.log("\n🎉 ALL DONE — ADMIN RESET SUCCESSFULLY!");
    console.log("➡️  Login using:");
    console.log("   Email:    " + ADMIN_EMAIL);
    console.log("   Password: " + ADMIN_PASSWORD);
}

fixAdmin();
