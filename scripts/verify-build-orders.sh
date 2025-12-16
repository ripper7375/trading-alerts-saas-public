#!/bin/bash

# Build-Order Verification Script
# Verifies that all 18 build-order files are complete and ready for Phase 3

echo "🔍 Verifying Build-Order Files..."
echo ""
echo "=================================="
echo "BUILD-ORDER INTEGRITY CHECK"
echo "=================================="
echo ""

TOTAL=0
COMPLETE=0
PLACEHOLDER=0
MISSING=0

# Define expected parts (per README.md)
declare -a PARTS=(
    "01-foundation"
    "02-database"
    "03-types"
    "04-tier-system"
    "05-authentication"
    "06-flask-mt5"
    "07-indicators-api"
    "08-dashboard"
    "09-charts"
    "10-watchlist"
    "11-alerts"
    "12-ecommerce"
    "13-settings"
    "14-admin"
    "15-notifications"
    "16-utilities"
    "17-affiliate"
    "18-dlocal"
)

# Check each part
for part in "${PARTS[@]}"; do
    TOTAL=$((TOTAL + 1))
    file="docs/build-orders/part-$part.md"

    if [ -f "$file" ]; then
        size=$(wc -c < "$file")
        lines=$(wc -l < "$file")

        if [ $size -lt 2000 ]; then
            echo "⚠️  PLACEHOLDER: part-$part ($size bytes, $lines lines)"
            PLACEHOLDER=$((PLACEHOLDER + 1))
        else
            echo "✅ COMPLETE:    part-$part ($size bytes, $lines lines)"
            COMPLETE=$((COMPLETE + 1))
        fi
    else
        echo "❌ MISSING:     part-$part"
        MISSING=$((MISSING + 1))
    fi
done

echo ""
echo "=================================="
echo "SUMMARY"
echo "=================================="
echo ""
echo "Total Parts:       $TOTAL"
echo "✅ Complete:       $COMPLETE (>2KB each)"
echo "⚠️  Placeholders:  $PLACEHOLDER (<2KB)"
echo "❌ Missing:        $MISSING"
echo ""

if [ $COMPLETE -eq $TOTAL ]; then
    echo "🎉 SUCCESS! All $TOTAL build-order files are complete!"
    echo ""
    echo "Ready for Phase 3 autonomous building with:"
    echo "  - 2-5% escalation rate (target)"
    echo "  - Smooth autonomous building"
    echo "  - Minimal human intervention"
    echo ""
    exit 0
elif [ $PLACEHOLDER -gt 0 ]; then
    echo "⚠️  WARNING: $PLACEHOLDER placeholder files detected!"
    echo ""
    echo "Risk Analysis:"
    echo "  - Expected escalation rate: 10-15% (vs. target 2-5%)"
    echo "  - Estimated extra interventions: 15-25 across 170+ files"
    echo "  - Ambiguous build sequences may slow progress"
    echo ""
    echo "Recommendation: Complete placeholder files before Phase 3"
    exit 1
else
    echo "❌ ERROR: $MISSING files missing!"
    echo ""
    echo "Cannot proceed to Phase 3 without complete build-orders."
    exit 1
fi
