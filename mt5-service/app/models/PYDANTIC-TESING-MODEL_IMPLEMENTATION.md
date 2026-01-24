When OpenAPI Changes ---> Regenerating Pydantic Models

Workflow:

Step 1: You update the API
↓
Step 2: Update OpenAPI spec
docs/open-api-documents/part-06-flask_mt5_openapi.yaml
↓
Step 3: Regenerate Pydantic models
bash scripts/generate-types.sh
↓
Step 4: Python code now validates against NEW API spec

Example Scenario:

You add a new field to OHLCVBar:

# docs/open-api-documents/part-06-flask_mt5_openapi.yaml

OHLCVBar:
properties:
time: integer
open: number
high: number
low: number
close: number
volume: integer
spread: integer # ← NEW FIELD ADDED

Then regenerate:

bash scripts/generate-types.sh

Now app/models/api_types.py automatically updates:

class OHLCVBar(BaseModel):
time: int
open: float
high: float
low: float
close: float
volume: int
spread: int # ← AUTO-ADDED by regeneration

Result: Your Python code now knows about the spread field and will validate it!
