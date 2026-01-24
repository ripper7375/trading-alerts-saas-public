#!/bin/bash
# Generate Pydantic Models from OpenAPI Specification
# Usage: ./scripts/generate-types.sh

set -e  # Exit on error

echo "🔄 Generating Pydantic models from OpenAPI spec..."

# Navigate to mt5-service directory
cd "$(dirname "$0")/.."

# Check if datamodel-code-generator is installed
if ! python3 -c "import datamodel_code_generator" 2>/dev/null; then
    echo "❌ datamodel-code-generator not found. Installing..."
    pip install "datamodel-code-generator[http]>=0.53.0"
fi

# Generate Pydantic models
python3 -m datamodel_code_generator \
  --input ../docs/open-api-documents/part-06-flask_mt5_openapi.yaml \
  --output app/models/api_types.py \
  --input-file-type openapi \
  --output-model-type pydantic_v2.BaseModel \
  --use-standard-collections \
  --use-schema-description \
  --target-python-version 3.11 \
  --field-constraints \
  --use-double-quotes

echo "✅ Pydantic models generated successfully!"
echo "📄 Output: app/models/api_types.py"
echo ""
echo "💡 Tip: Import models with:"
echo "   from app.models.api_types import OHLCVDataResponse, OHLCVBar, Symbol, Timeframe"
