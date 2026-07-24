# Postman dLocal Sandbox — Known Hygiene Issue: Unmasked Secret Key

**Status:** Open, non-blocking
**Affected workspace:** `Dhapanart Kevalee (Davin)'s Workspace` → Environment: `dLocal Sandbox`
**Related to:** dLocal signed-payment integration testing (secure_payments, payments, sandbox-tools/payments requests)

## Issue

The `x_secret_key` variable in the `dLocal Sandbox` Postman environment is currently stored as a plain **string-type** variable, not as a **secret-type** variable in Postman's Local Vault.

Because of this:

- The value is visible in plain text in the environment editor UI to anyone with access to the workspace.
- It would be included if the environment is ever exported, duplicated, or shared (e.g., via "Share" or a Postman collection/environment export file).
- It does not benefit from Postman's Local Vault masking, which hides the value by default and requires an explicit unlock to view.

This does **not** currently block any functionality — signed requests to `https://sandbox.dlocal.com/secure_payments`, `/payments`, and `/sandbox-tools/payments` all work correctly with the key in its current form, since the pre-request scripts read it via `pm.environment.get('x_secret_key')` regardless of variable type.

## Why it matters

The `x_secret_key` is the HMAC signing secret used to authenticate every request to dLocal's API (see `Authorization: V2-HMAC-SHA256, Signature: ...` header construction in the pre-request scripts). Anyone who obtains this value could forge valid signed requests against the sandbox account, and if the same credential-handling habits carry over to production credentials, the exposure risk is significantly higher.

## Recommended fix

1. Open the `dLocal Sandbox` environment in Postman.
2. Locate the `x_secret_key` variable row.
3. Change its type from the default string type to **Secret** (Postman will prompt to store it in **Local Vault**).
4. Re-enter the value once during the Local Vault setup (Postman does not migrate the plain value automatically for security reasons).
5. Confirm the pre-request scripts still resolve the value correctly via `pm.environment.get('x_secret_key')` — Local Vault secrets remain accessible the same way at runtime, only the display/export behavior changes.
6. Repeat this check for `x_trans_key` if it is also sensitive in your account setup (lower risk than `x_secret_key`, but worth reviewing).

## Notes for future agents/collaborators

- Do not export or share the `dLocal Sandbox` environment until this is fixed.
- If you find `x_secret_key` still stored as plain string in a future session, this is a known/tracked issue — not a new discovery — feel free to fix it directly rather than re-flagging from scratch.
- This issue was identified during a webhook-signature debugging session (2026-07-24) that also fixed a real bug in the receiving server's webhook signature verification (wrong header name and wrong HMAC construction) — see related notes/commit `8e68129` on the money-service repo if cross-referencing that work.
