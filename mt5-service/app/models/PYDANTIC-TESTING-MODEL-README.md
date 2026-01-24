# API Type Definitions (Pydantic Models)

## Overview

This directory contains auto-generated Pydantic models from the OpenAPI specification.

**Generated from:** `docs/open-api-documents/part-06-flask_mt5_openapi.yaml`

**Purpose:** Runtime validation and type safety for API requests/responses

---

## Files

- `api_types.py` - Auto-generated Pydantic models (DO NOT EDIT MANUALLY)
- `__init__.py` - Package initialization

---

## Regenerating Models

When the OpenAPI spec changes, regenerate the models:

```bash
# From mt5-service directory
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
```

**Or use the npm script:**

```bash
npm run generate:types:python
```

---

## Usage Examples

### 1. Validate API Response Structure

```python
from app.models.api_types import OHLCVDataResponse, OHLCVBar, OHLCVData
from pydantic import ValidationError

@app.route('/api/indicators/<symbol>/<timeframe>')
def get_indicators(symbol: str, timeframe: str):
    # Fetch raw data from MT5
    raw_data = fetch_ohlcv_data(connection, symbol, timeframe)

    # Validate response structure using Pydantic
    try:
        response = OHLCVDataResponse(
            success=True,
            data=OHLCVData(
                symbol=symbol,
                timeframe=timeframe,
                bars=len(raw_data['ohlcv']),
                ohlcv=[OHLCVBar(**bar) for bar in raw_data['ohlcv']],
                metadata=raw_data['metadata']
            )
        )

        # Convert to dict for JSON response
        return jsonify(response.model_dump()), 200

    except ValidationError as e:
        # Validation failed - data doesn't match OpenAPI spec
        return jsonify({
            "success": False,
            "error": f"Response validation failed: {str(e)}"
        }), 500
```

### 2. Validate Input Parameters with Enums

```python
from app.models.api_types import Symbol, Timeframe, UserTier
from pydantic import ValidationError

@app.route('/api/indicators/<symbol>/<timeframe>')
def get_indicators(symbol: str, timeframe: str):
    try:
        # Validate symbol (raises ValueError if invalid)
        validated_symbol = Symbol(symbol)

        # Validate timeframe (raises ValueError if invalid)
        validated_timeframe = Timeframe(timeframe)

        # Now you have type-safe, validated inputs
        data = fetch_ohlcv_data(connection, validated_symbol, validated_timeframe)

        return jsonify({"success": True, "data": data}), 200

    except ValueError as e:
        # Invalid enum value
        return jsonify({
            "success": False,
            "error": f"Invalid parameter: {str(e)}"
        }), 400
```

### 3. Validate User Tier Access

```python
from app.models.api_types import UserTier, AccessDeniedResponse

@app.route('/api/indicators/<symbol>/<timeframe>')
def get_indicators(symbol: str, timeframe: str):
    # Get tier from header
    tier_header = request.headers.get('X-User-Tier', 'FREE')

    try:
        # Validate tier
        user_tier = UserTier(tier_header)

        # Check access
        if user_tier == UserTier.FREE and symbol not in ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD']:
            # Return properly structured access denied response
            response = AccessDeniedResponse(
                success=False,
                error=f"{user_tier} tier cannot access {symbol}",
                tier=user_tier,
                accessible_symbols=['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'],
                upgrade_required=True
            )
            return jsonify(response.model_dump()), 403

        # Continue with data fetch...

    except ValueError:
        return jsonify({"success": False, "error": "Invalid tier"}), 400
```

### 4. Admin Endpoints with Complex Types

```python
from app.models.api_types import AdminHealthResponse, AdminTerminalStatus

@admin_bp.route('/terminals/health')
def get_terminals_health():
    try:
        pool = get_connection_pool()
        raw_health = pool.get_admin_health_summary()

        # Validate admin health response
        response = AdminHealthResponse(**raw_health)

        return jsonify(response.model_dump()), 200

    except ValidationError as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

### 5. Error Response Handling

```python
from app.models.api_types import ErrorResponse

@app.errorhandler(500)
def internal_error(error):
    # Always return properly structured error responses
    response = ErrorResponse(
        success=False,
        error=str(error)
    )
    return jsonify(response.model_dump()), 500
```

---

## Benefits

### ✅ **1. Runtime Validation**

Catches invalid data before it reaches your code:

- Wrong types (string instead of int)
- Missing required fields
- Invalid enum values
- Out-of-range values

### ✅ **2. Type Safety**

Python type hints work with your IDE:

- Autocomplete for model attributes
- Type checking with mypy
- Inline documentation

### ✅ **3. Single Source of Truth**

- Models generated from OpenAPI spec
- Frontend and backend use same contract
- Changes to spec automatically update types

### ✅ **4. Self-Documenting**

- Field descriptions from OpenAPI spec
- Example values included
- Clear error messages when validation fails

### ✅ **5. Data Coercion**

Pydantic automatically converts compatible types:

```python
bar = OHLCVBar(
    time="1699632000",  # String → int
    open="1985.50",     # String → float
    # ... Pydantic converts automatically!
)
```

---

## Available Models

### Enums

- `UserTier` - FREE, PRO
- `Symbol` - All 15 trading symbols
- `Timeframe` - All 9 timeframes
- `Status` - ok, degraded, error
- `Level` - INFO, WARNING, ERROR, DEBUG

### Response Models

- `OHLCVDataResponse` - Main data endpoint response
- `HealthResponse` - Service health check
- `SymbolsResponse` - Available symbols by tier
- `TimeframesResponse` - Available timeframes by tier
- `AccessDeniedResponse` - Tier access denied
- `ErrorResponse` - Generic error

### Data Models

- `OHLCVData` - Complete OHLCV package
- `OHLCVBar` - Single candlestick
- `OHLCVMetadata` - Request metadata
- `TerminalStatus` - MT5 terminal status

### Admin Models

- `AdminHealthResponse` - Admin health with metrics
- `AdminTerminalStatus` - Detailed terminal status
- `TerminalRestartResponse` - Restart operation result
- `RestartAllResponse` - Bulk restart result
- `TerminalLogsResponse` - Terminal logs
- `TerminalStatsResponse` - Aggregate statistics

---

## Important Notes

### ⚠️ DO NOT Edit `api_types.py` Manually

This file is auto-generated. Any manual changes will be lost when regenerated.

**Instead:**

1. Update the OpenAPI spec: `docs/open-api-documents/part-06-flask_mt5_openapi.yaml`
2. Regenerate the models: `python3 -m datamodel_code_generator ...`

### ⚠️ Version Compatibility

- **Pydantic Version:** 2.12+
- **Python Version:** 3.11+
- **OpenAPI Version:** 3.0.3

### ⚠️ Performance

Pydantic validation has minimal overhead (~microseconds per model), but for high-throughput endpoints you can:

```python
# Skip validation in production (not recommended)
response = OHLCVDataResponse.model_construct(
    success=True,
    data=data
)

# Or use model_dump() with exclude_none
response.model_dump(exclude_none=True)
```

---

## Integration with Existing Code

The existing Flask routes can be gradually updated to use Pydantic models:

**Phase 1:** Validate inputs

```python
# Before: No validation
symbol = request.args.get('symbol')

# After: Validated
symbol = Symbol(request.args.get('symbol'))
```

**Phase 2:** Validate outputs

```python
# Before: Return dict
return jsonify({"success": True, "data": data})

# After: Validated response
response = OHLCVDataResponse(success=True, data=data)
return jsonify(response.model_dump())
```

**Phase 3:** Full integration

```python
# Both inputs and outputs validated
# Type hints throughout the codebase
# mypy static checking enabled
```

---

## References

- [Pydantic Documentation](https://docs.pydantic.dev/)
- [datamodel-code-generator](https://github.com/koxudaxi/datamodel-code-generator)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3)
