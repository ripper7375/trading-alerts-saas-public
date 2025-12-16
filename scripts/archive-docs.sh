#!/bin/bash

# ============================================================================
# Documentation Archive Script
# ============================================================================
# Moves completed/historical documentation to archive folder
#
# Usage: ./scripts/archive-docs.sh [--dry-run]
# ============================================================================

set -e

DRY_RUN=false
if [ "$1" == "--dry-run" ]; then
  DRY_RUN=true
  echo "🔍 DRY RUN MODE - No files will be moved"
  echo ""
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "📦 Documentation Archive Script"
echo "==============================="
echo ""

# ============================================================================
# Create archive structure
# ============================================================================
echo "📁 Creating archive directory structure..."

ARCHIVE_DIRS=(
  "docs/archive"
  "docs/archive/planning"
  "docs/archive/checklists"
  "docs/archive/summaries/affiliate"
  "docs/archive/summaries/dlocal"
  "docs/archive/testing"
  "docs/archive/setup-guides"
)

for dir in "${ARCHIVE_DIRS[@]}"; do
  if [ "$DRY_RUN" = false ]; then
    mkdir -p "$dir"
  fi
  echo "  ✅ $dir"
done

echo ""

# ============================================================================
# Create archive README
# ============================================================================
echo "📝 Creating archive README..."

if [ "$DRY_RUN" = false ]; then
  cat > docs/archive/README.md << 'EOF'
# Archived Documentation

This directory contains historical documentation that is no longer actively used but preserved for reference.

## Archive Structure

- **planning/** - Planning documents for completed features
- **checklists/** - Completed implementation checklists
- **summaries/** - Historical summary documents (superseded by current docs)
- **testing/** - Completed testing documentation
- **setup-guides/** - Standalone setup guides (merged into main docs)

## Why Files Are Archived

Files are moved here when they are:
1. Planning documents for completed work
2. Checklists with all items completed
3. Redundant summaries (when multiple docs cover same feature)
4. One-time testing/review documents (already executed)
5. Setup guides that have been consolidated into main documentation

## Accessing Archived Files

These files are still in git history and can be referenced if needed. They are moved to archive to keep the main `docs/` directory clean and focused on current, actively-used documentation.

## When to Archive

See `docs/FILE-ARCHIVE-ANALYSIS.md` for the analysis that determined which files to archive.

---

**Last Updated:** 2025-11-18
EOF
  echo "  ✅ docs/archive/README.md created"
else
  echo "  🔍 Would create docs/archive/README.md"
fi

echo ""

# ============================================================================
# Archive files with HIGH CONFIDENCE (definitely historical)
# ============================================================================
echo "📦 Archiving files (HIGH CONFIDENCE - definitely historical)..."
echo ""

# Planning documents
FILES_TO_ARCHIVE_HIGH=(
  "docs/AIDER-AUTONOMY-IMPROVEMENT-PLAN.md:docs/archive/planning/"
  "docs/POLICY_COHERENCE_REVIEW.md:docs/archive/planning/"
)

for entry in "${FILES_TO_ARCHIVE_HIGH[@]}"; do
  IFS=: read -r source dest <<< "$entry"

  if [ -f "$source" ]; then
    if [ "$DRY_RUN" = false ]; then
      mv "$source" "$dest"
      echo -e "  ${GREEN}✅ MOVED${NC} $source → $dest"
    else
      echo -e "  ${YELLOW}🔍 Would move${NC} $source → $dest"
    fi
  else
    echo -e "  ${BLUE}⏭️  SKIP${NC} $source (not found)"
  fi
done

echo ""

# ============================================================================
# Archive files with MEDIUM CONFIDENCE (verify first)
# ============================================================================
echo "⚠️  Files to archive AFTER VERIFICATION:"
echo "(Run with --dry-run first to review)"
echo ""

FILES_TO_ARCHIVE_MEDIUM=(
  "docs/AFFILIATE-ADMIN-JOURNEY.md:docs/archive/summaries/affiliate/"
  "docs/AFFILIATE-MARKETING-INTEGRATION-CHECKLIST.md:docs/archive/checklists/"
  "docs/AFFILIATE-SYSTEM-COMPREHENSIVE-UPDATE-SUMMARY.md:docs/archive/summaries/affiliate/"
  "docs/AFFILIATE-SYSTEM-SETTINGS-DESIGN.md:docs/archive/summaries/affiliate/"
  "docs/AFFILIATE-SYSTEM-UPDATES-NEEDED.md:docs/archive/summaries/affiliate/"
  "docs/DISCOUNT-CODE-CORRECTION-SUMMARY.md:docs/archive/summaries/dlocal/"
  "docs/DLOCAL-DOCUMENTATION-UPDATE-CHECKLIST.md:docs/archive/checklists/"
  "docs/DLOCAL-INTEGRATION-SUMMARY.md:docs/archive/summaries/dlocal/"
  "docs/v7/AIDER-COMPREHENSION-TESTS.md:docs/archive/testing/"
  "docs/v7/PHASE-1-READINESS-CHECK.md:docs/archive/testing/"
  "docs/setup/google-oauth-setup.md:docs/archive/setup-guides/"
  "docs/V0DEV-SYSTEMCONFIG-INTEGRATION-GUIDE.md:docs/archive/setup-guides/"
)

for entry in "${FILES_TO_ARCHIVE_MEDIUM[@]}"; do
  IFS=: read -r source dest <<< "$entry"

  if [ -f "$source" ]; then
    echo "  ⚠️  $source → $dest"
  else
    echo "  ⏭️  $source (not found)"
  fi
done

echo ""
echo "To archive these files, verify they are no longer needed, then run:"
echo "  ${YELLOW}./scripts/archive-docs.sh --archive-all${NC}"
echo ""

# ============================================================================
# Archive all (if requested)
# ============================================================================
if [ "$1" == "--archive-all" ]; then
  echo "📦 Archiving ALL files (including medium confidence)..."
  echo ""

  for entry in "${FILES_TO_ARCHIVE_MEDIUM[@]}"; do
    IFS=: read -r source dest <<< "$entry"

    if [ -f "$source" ]; then
      mv "$source" "$dest"
      echo -e "  ${GREEN}✅ MOVED${NC} $source → $dest"
    else
      echo -e "  ${BLUE}⏭️  SKIP${NC} $source (not found)"
    fi
  done

  echo ""
fi

# ============================================================================
# Summary
# ============================================================================
echo "==============================="
echo "📊 Summary"
echo "==============================="

if [ "$DRY_RUN" = true ]; then
  echo "🔍 DRY RUN - No files were moved"
  echo ""
  echo "Run without --dry-run to actually archive files:"
  echo "  ./scripts/archive-docs.sh"
elif [ "$1" == "--archive-all" ]; then
  echo "✅ All archivable files have been moved"
  echo ""
  echo "Next steps:"
  echo "  1. Review docs/archive/ to verify correct archiving"
  echo "  2. Commit the changes:"
  echo "     git add docs/"
  echo "     git commit -m 'chore: archive historical documentation'"
else
  echo "✅ High-confidence files archived"
  echo "⚠️  Medium-confidence files listed for review"
  echo ""
  echo "Next steps:"
  echo "  1. Review the medium-confidence files listed above"
  echo "  2. If you want to archive them all, run:"
  echo "     ./scripts/archive-docs.sh --archive-all"
  echo "  3. Or manually verify and archive specific files"
fi

echo ""
