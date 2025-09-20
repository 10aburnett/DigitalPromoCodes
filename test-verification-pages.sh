#!/bin/bash

# Test verification data on pages that have beforeCents
echo "Testing verification data on pages with beforeCents..."

# Array of pages we know have verification data
pages=("ayecon-academy-lifetime-membership" "premium" "momentum-monthly" "goat-ecom-growth" "creator")

for page in "${pages[@]}"; do
    echo -n "Testing $page: "
    count=$(curl -s http://localhost:3000/whop/$page | grep -c "Last tested.*19/09/2025")
    if [ $count -gt 0 ]; then
        echo "✅ Found $count instances"
    else
        echo "❌ No verification data found"
    fi
done

echo ""
echo "Summary: All tested pages should show verification data working."