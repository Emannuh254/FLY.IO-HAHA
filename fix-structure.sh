#!/bin/bash

echo "This script will organize your project into the correct folder structure."
echo "It will create missing folders/files and move existing ones."
read -p "Do you want to continue? (y/n): " confirm

if [[ "$confirm" != "y" ]]; then
    echo "Cancelled."
    exit 0
fi

# ------- Create directories -------
declare -a dirs=("servers" "shared" "public")

for d in "${dirs[@]}"; do
    if [[ ! -d "$d" ]]; then
        read -p "Directory '$d' is missing. Create it? (y/n): " make_dir
        if [[ "$make_dir" == "y" ]]; then
            mkdir -p "$d"
            echo "Created: $d/"
        fi
    else
        echo "Directory exists: $d/"
    fi
done

# ------- Define expected files -------
servers_files=(
    "indexServer.js"
    "profileServer.js"
    "referralsServer.js"
    "tradingServer.js"
    "demoServer.js"
    "depositWithdrawServer.js"
    "dashboardServer.js"
    "adminServer.js"
)

shared_files=(
    "database.js"
    "middleware.js"
    "auth.js"
    "helpers.js"
)

public_files=(
    "index.html"
    "profile.html"
    "referrals.html"
    "trading.html"
    "demo.html"
    "deposit-withdraw.html"
    "dashboard.html"
    "admin.html"
)

# ------- Function to handle files -------
handle_file() {
    local file="$1"
    local target_dir="$2"

    if [[ -f "$file" ]]; then
        read -p "Move $file to $target_dir/? (y/n): " move_file
        if [[ "$move_file" == "y" ]]; then
            mv "$file" "$target_dir/" 2>/dev/null
            echo "Moved $file → $target_dir/"
        fi
    else
        read -p "$file does NOT exist. Create empty file in $target_dir/? (y/n): " create_file
        if [[ "$create_file" == "y" ]]; then
            touch "$target_dir/$file"
            echo "Created $target_dir/$file"
        fi
    fi
}

# ------- Process each file group -------
echo ""
echo "Processing server files..."
for f in "${servers_files[@]}"; do
    handle_file "$f" "servers"
done

echo ""
echo "Processing shared files..."
for f in "${shared_files[@]}"; do
    handle_file "$f" "shared"
done

echo ""
echo "Processing public files..."
for f in "${public_files[@]}"; do
    handle_file "$f" "public"
done

echo ""
echo "✔ Project structure is now organized."
echo "Done."
