#!/bin/bash
# =============================================================================
# OpenAPI TypeScript Type Generation Script for Flask MT5 Service
# =============================================================================
# Purpose: Generate TypeScript types from the Flask MT5 OpenAPI spec
# Usage: sh scripts/openapi/generate-flask-types.sh
# Output: lib/mt5-client/ directory with generated TypeScript types
# =============================================================================

echo "📄 Generating TypeScript types from Flask MT5 OpenAPI spec..."
echo ""

# Check if OpenAPI spec exists
if [ ! -f "docs/flask_mt5_openapi.yaml" ]; then
    echo "❌ ERROR: docs/flask_mt5_openapi.yaml not found!"
    echo "   Please ensure the OpenAPI spec file exists."
    exit 1
fi

# Check if openapi-generator-cli is installed
if ! command -v openapi-generator-cli &> /dev/null; then
    echo "⚠️  openapi-generator-cli is not installed globally."
    echo "   Installing it now (this may take a moment)..."
    npm install -g @openapitools/openapi-generator-cli

    if [ $? -ne 0 ]; then
        echo "❌ Failed to install openapi-generator-cli"
        echo "   Please run: npm install -g @openapitools/openapi-generator-cli"
        exit 1
    fi
fi

echo "🔧 Running OpenAPI Generator..."
echo ""

# Generate TypeScript types
openapi-generator-cli generate \
  -i docs/flask_mt5_openapi.yaml \
  -g typescript-axios \
  -o lib/mt5-client \
  --additional-properties=supportsES6=true,npmVersion=8.0.0,withSeparateModelsAndApi=true

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Flask MT5 types generated successfully!"
    echo ""
    echo "📍 Output location: lib/mt5-client/"
    echo ""
    echo "📝 Usage in your code:"
    echo "   import { IndicatorData, MarketData, SymbolInfo } from '@/lib/mt5-client'"
    echo ""
    echo "💡 TIP: Run this script whenever you update docs/flask_mt5_openapi.yaml"
    echo "   to keep your TypeScript types in sync with the Flask API specification."
else
    echo ""
    echo "❌ Type generation failed!"
    echo "   This is expected if the Next.js project doesn't exist yet."
    echo "   You'll run this script again in Phase 3 when building the application."
    exit 1
fi
