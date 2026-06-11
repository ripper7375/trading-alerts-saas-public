The indicator export engine is your single source of truth for the data contract. The EA replicates that same logic as indicator export engine (reading via CopyBuffer() and sending to BullMQ instead of writing to a file).

This way, if you ever change the format, you change the export engine first, verify it with a .txt export, then update the EA to match.

Step to implement :

Step 1 — Validate the Export Engine (what you already have)
Step 2 — Use it as the blueprint for the EA

Indicator Export Engine (Reference) ---> EA Data Assembly (mirrors it)
