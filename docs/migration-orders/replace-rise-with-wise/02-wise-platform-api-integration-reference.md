# Wise Platform API — Integration Reference (verified)

**Purpose:** the single grounded reference for every Wise API fact Part 19.5 depends on, so no
W-session has to re-research and no implementer has to guess. Every claim carries its source URL.
**Verified:** 2026-07-25 against `docs.wise.com`.
**Rule for the Executor:** if this document and Wise's live docs disagree at CONFIRM time,
**Wise's live docs win** — record the difference as a Deviation and update this file.

---

## 1. Environments

|                | mTLS                                | TLS only                       |
| -------------- | ----------------------------------- | ------------------------------ |
| **Production** | `https://api-mtls.transferwise.com` | `https://api.wise.com`         |
| **Sandbox**    | `https://api-mtls.wise-sandbox.com` | `https://api.wise-sandbox.com` |

Sandbox UI: `https://wise-sandbox.com`. Wise recommends mTLS for most situations; Part 19.5 starts
TLS-only (no mTLS setup burden) and treats mTLS as an optional later hardening step.

Sandbox does **not** move real money, does **not** offer live rates, has higher latency, and does
**not** support load testing.

> Note: older Wise material and some SDK examples use `api.sandbox.transferwise.tech`. The current
> documented sandbox host is `api.wise-sandbox.com`. Use the documented one.

Source: <https://docs.wise.com/guides/developer/environments>

---

## 2. Authentication

### 2.1 Personal API token (Model A — Wise Business, self-serve)

- Create: Wise business account → `Your Account > Connect and manage apps > API tokens` →
  **Add new token** (2-step verification required). Choose **full** or **read-only** access.
- Use: `Authorization: Bearer <personal_token>` on every request.
- Tokens remain active until revoked; revoke from the same screen.

**Documented limitations — this is the load-bearing constraint of the whole design:**

> "Personal API tokens are limited to the endpoints for creating quotes, retrieving and creating
> recipients, creating transfers and batch groups, and tracking transfer events.
> **Funding transfers and retrieving balance statements via API are not supported except for
> accounts based in the US, Canada, Australia, New Zealand, Singapore, and Malaysia.**"

So for a **Thailand**-registered business on Model A:

| Capability                                 | Available?                                       |
| ------------------------------------------ | ------------------------------------------------ |
| Create authenticated quote                 | ✅                                               |
| Retrieve recipient account requirements    | ✅                                               |
| Create recipient                           | ✅                                               |
| Create transfer (single)                   | ✅                                               |
| Create batch group + batch-group transfers | ✅                                               |
| Track transfers via **profile** webhooks   | ✅                                               |
| **Fund** a transfer or batch group         | ❌                                               |
| Retrieve balance statements                | ❌                                               |
| Application-level webhooks                 | ❌ (needs a `clientKey` from client credentials) |

Sources: <https://docs.wise.com/guides/developer/auth-and-security/personal-api-token> ·
<https://docs.wise.com/guides/product/send-money/use-cases/payouts-smbs>

### 2.2 Client credentials / user tokens (Model B — Platform partnership)

Obtained via a partnership + implementation team. Enables application-level webhooks (needs
`clientKey`), API funding, balance statements, and SCA-over-API. Not available self-serve.

### 2.3 ⚠️ Business Payment Approvals break API transfers

> "Business Payment Approvals created on your wise.com settings page are **not compatible** with
> creating transfers over the API. If you use personal tokens and do not use client credentials,
> and if your business account has payment approvals, your application will receive this error when
> attempting to create a transfer: _Quote cannot be accepted with this request due to missing
> approval._ Consider removing the payment rule if you are going to use the API to create transfers."

**Action:** confirm in the Wise UI that no payment-approval rule exists, **before** session 4A-W6.
This is 4A-W1 entry-criterion material.

Source: <https://docs.wise.com/api-reference/standard-transfer/transfercreate>

---

## 3. Rate limits and correlation

- Partner accounts: **100 req/s, 1000 req/min** per client. `429` on breach. Additional per-service
  limits may apply on top of the gateway limit.
- `X-External-Correlation-Id` — optional UUID (≤36 chars) accepted on most endpoints; Wise echoes it
  back. Send it on every call and log it.
- `Accept-Minor-Version: 1` — **required** to get v1.1 of the account-requirements endpoints (adds
  recipient name and email to the dynamic schema).

Sources: <https://docs.wise.com/api-reference> ·
<https://docs.wise.com/api-reference/recipient/recipientaccountrequirementsget>

---

## 4. The send-money flow

Wise's own four stages:

1. **Create an authenticated quote** — `POST /v3/profiles/{profileId}/quotes`
2. **Create/lookup the recipient** — `POST /v1/accounts`
3. **Create the transfer** — `POST /v1/transfers`
4. **Fund the transfer** — `POST /v3/profiles/{profileId}/transfers/{transferId}/payments`

Source: <https://docs.wise.com/guides/product/send-money/use-cases/enterprise/send-money>

The SMB (personal-token) variant adds two discovery steps and ends without step 4:

1. Create authenticated quote
2. `GET /v1/quotes/{quoteId}/account-requirements` (learn required fields)
3. `POST /v1/accounts` (create recipient)
4. **Update the quote** (re-price now that the target account is known)
5. `GET`/`POST` transfer requirements (learn conditionally-required transfer fields)
6. Create transfer (or batch-group transfer)
7. **Log into Wise to fund** ← the human gate

Source: <https://docs.wise.com/guides/product/send-money/use-cases/payouts-smbs>

### 4.1 Quote

`POST /v3/profiles/{profileId}/quotes`

```json
{
  "sourceCurrency": "USD",
  "targetCurrency": "THB",
  "sourceAmount": 100,
  "targetAmount": null,
  "targetAccount": 12345,
  "payOut": null,
  "preferredPayIn": null,
  "paymentMetadata": { "transferNature": "..." },
  "pricingConfiguration": {
    "fee": { "type": "OVERRIDE", "variable": 0.011, "fixed": 15.42 }
  }
}
```

- Specify **`sourceAmount` XOR `targetAmount`** — this is the F38 decision point (who absorbs the
  fee).
- The mid-market rate is **locked for 30 minutes** on quote creation.
- `targetAccount` may be set at creation or added by **updating** the quote after the recipient
  exists; updating re-prices for the actual payout route.
- `pricingConfiguration` is a partner/Platform feature — omit it on Model A.

Sources: <https://docs.wise.com/api-reference/quote> ·
<https://docs.wise.com/guides/product/send-money/use-cases/enterprise/send-money>

### 4.2 Recipient account requirements (dynamic — never hard-code fields)

```
GET  /v1/quotes/{quoteId}/account-requirements      (Accept-Minor-Version: 1)
POST /v1/quotes/{quoteId}/account-requirements      (Accept-Minor-Version: 1)
GET  /v1/account-requirements?source=EUR&target=USD&sourceAmount=1000   ← discouraged
```

Response shape (abridged): `type`, `title`, `usageInfo`, `fields[].group[]` where each field has
`key`, `name`, `type`, `required`, `example`, `minLength`, `maxLength`, `validationRegexp`,
`valuesAllowed[]`, and **`refreshRequirementsOnChange`**.

Key behaviours:

- When a field has `refreshRequirementsOnChange: true`, **POST** the partially-filled recipient
  payload back to `account-requirements` to reveal follow-on fields (`address.country = "US"` →
  reveals `state`).
- The quote-scoped variants are strongly preferred: some payout methods only surface when the
  profile context is known (Wise's own example: business payments to CNY).
- `?addressRequired=true` forces address collection.
- `originatorLegalEntityType=BUSINESS|PRIVATE` when the true sender differs from the profile type.
- Wise warns: "Address requirement fields are subject to change. Your integration should be built
  in a way to handle unrecognized or changed fields."

Source: <https://docs.wise.com/api-reference/recipient/recipientaccountrequirementsget>

### 4.3 Create recipient

`POST /v1/accounts?refund=false`

```json
{
  "currency": "GBP",
  "type": "sort_code",
  "profile": 30000000,
  "ownedByCustomer": true,
  "accountHolderName": "John Doe",
  "details": {
    "legalType": "PRIVATE",
    "sortCode": "040075",
    "accountNumber": "37778842",
    "dateOfBirth": "1961-01-01"
  },
  "ultimateBeneficiary": { "name": { "fullName": "John Doe" } }
}
```

`type` and the contents of `details` come **entirely** from the account-requirements response.
Recipient IDs are cross-compatible between the v1 and v2 recipient APIs.

Sources: <https://docs.wise.com/api-reference/recipient> ·
<https://docs.wise.com/guides/product/send-money/use-cases/enterprise/send-money>

### 4.4 Create transfer

`POST /v1/transfers` — Security: `UserToken`, `PersonalToken`

```json
{
  "targetAccount": 8692237,
  "quoteUuid": "8fa9be20-ba43-4b15-abbb-9424e1481050",
  "customerTransactionId": "54a6bc09-cef9-49a8-9041-f1f0c654cd88",
  "details": { "reference": "DavinTrade commission BATCH-2026-…" }
}
```

- **`customerTransactionId` is required and is the idempotency key.** "If your initial call to
  create a transfer fails (error or timeout), retry the call using the same
  `customerTransactionId` value. Subsequent retry messages are treated as repeat messages and will
  not create duplicate transfers." → store it **before** the call, retry with the same value.
- **One transfer per quote.** A quote cannot be reused.
- Response includes `id`, `status` (initially `incoming_payment_waiting`), `rate`, `sourceValue`,
  `targetValue`, `sourceCurrency`, `targetCurrency`, `hasActiveIssues`, `customerTransactionId`,
  `payinSessionId`.
- `details.reference` max length is currency-route dependent.
- Conditionally-required fields (`transferPurpose` for THB, `transferPurposeSubTransferPurpose` for
  CNY, `transferPurposeInvoiceNumber` for INR, `sourceOfFunds` above thresholds) must be discovered
  via the **transfer requirements** endpoint, not assumed. **THB is explicitly called out as needing
  `transferPurpose`** — directly relevant to Thai affiliates.
- A created transfer is **auto-cancelled if not funded within ~14 days**.

Sources: <https://docs.wise.com/api-reference/standard-transfer/transfercreate> ·
<https://docs.wise.com/api-reference/transfer>

### 4.5 Fund a transfer

`POST /v3/profiles/{profileId}/transfers/{transferId}/payments` with `{"type":"BALANCE","balanceId":…}`.
**SCA-protected**; unavailable on Model A outside US/CA/AU/NZ/SG/MY.

Source: <https://docs.wise.com/guides/product/send-money/use-cases/enterprise/send-money>

---

## 5. Batch payment groups

> "A batch group is a named collection of **up to 1000 transfers** that can be managed as a single
> unit. Batch groups are primarily used for funding multiple transfers with a single payment."
>
> Workflow: 1. create with a source currency → 2. add transfers → 3. **complete** (closes it) → 4. **fund** from a balance or via direct debit. Individual transfers follow the standard transfer
> lifecycle and can be tracked separately.

### 5.1 Create — `POST /v3/profiles/{profileId}/batch-groups` · Security: `UserToken`, `PersonalToken`

Request: `{ "sourceCurrency": "USD", "name": "<≤100 chars, unique-ish>" }`
Response `201`: `id` (UUID), **`version`** (int, optimistic concurrency), `name`, `sourceCurrency`,
`status`, `transferIds[]`, `payInDetails[]` _(only when `COMPLETED`)_.

### 5.2 Statuses

| Status                    | Meaning                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `NEW`                     | open; more transfers can be added; **transfers cannot be funded or paid out yet**  |
| `COMPLETED`               | closed to changes; transfers are now fundable/payable. **Does not mean paid out.** |
| `MARKED_FOR_CANCELLATION` | cancellation requested                                                             |
| `PROCESSING_CANCEL`       | cancellation in progress (takes time)                                              |
| `CANCELLED`               | transfers cancelled                                                                |

`version` is a signed integer, **not monotonically ordered**, and some operations reject a stale
version — always send back the version most recently received.

### 5.3 `payInDetails[]` (only present once `COMPLETED`)

Type is currently `bank_transfer` only. Fields include: **`reference`** ("should be treated as an
**opaque value**; there should be no attempt to decode or decompose it"), `amount`, `currency`,
`name`, and — route-dependent, any of — `accountNumber`, `accountType`, `bankCode`, `branchName`,
`iban`, `bban`, `institutionNumber`, `transitNumber`, `beneficiaryBankBIC`, `intermediaryBankBIC`,
`fpsIdentifier`, `clearingNumber`, `bankAddress{…}`, `transferWiseAddress{…}`.

⇒ Store `payInDetails` **verbatim as JSON** and render it generically. Do not model it field-by-field.

### 5.4 Fund — `POST /v3/profiles/{profileId}/batch-payments/{batchGroupId}/payments`

Security: `UserToken`, `PersonalToken`. Body: `{"type":"BALANCE"}`.
"Funds all transfers in a batch group from a multi-currency account balance. Transfers are paid out
immediately. The batch group must first be completed, and there must be enough funds in the account
for the whole batch. Otherwise, an insufficient funds error will be returned."

> ⚠️ "This endpoint is **SCA protected** when it applies. If your profile is registered within the
> UK and/or EEA, SCA most likely applies to you."

Note the path asymmetry: create/complete use `/batch-groups/`, funding uses `/batch-payments/`.

Also available: `POST …/batch-group-payment-initiations` (fund via **direct debit**).

Sources: <https://docs.wise.com/api-reference/batch-group> ·
<https://docs.wise.com/api-reference/batch-group/batchgroupcreate> ·
<https://docs.wise.com/api-reference/batch-group/batchgroupfund>

---

## 6. Webhooks

### 6.1 Endpoint requirements (all mandatory)

- Valid **domain name** — IPs disallowed.
- HTTPS on **port 443**; a port number in the URL is rejected.
- Certificate signed by a trusted CA — self-signed/expired rejected.
- **No query arguments** in the URL. No user credentials in the URL.
- Respond **directly** with `2xx`. **Any 3xx is a delivery error and the redirect is not followed.**
- Respond **within 5 seconds**.

Valid: `https://webhooks.example.com/balance-change` · Invalid: `http://webhooks.example.com:8080/hook.php?type=balance`

Multiple subscriptions per event type are allowed — you then receive duplicate callbacks, one per
subscription. (Another reason `X-Delivery-Id` dedupe is not optional.)

### 6.2 Delivery, retries, ordering

- Exponential backoff: 1 min → 2 → 4 → … after the 11th retry, **14 more retries once a day**
  (≈25 attempts over ~2 weeks).
- `Retry-After` is respected (`http-date` or `delay-seconds`).
- Non-recoverable client errors (`400, 401, 403, 404, 405, 409, 410, 417, 422`) are attempted **only
  3 times**.
- Delivery is **best-effort**: "Please contact us if you believe you missed any webhook events."
  ⇒ the reconciliation cron in the design is not defensive over-engineering.
- **Events may arrive out of order. Use `data.occurred_at` to reconcile.**
- Recommended handling: "do some basic validation and then store the notification for processing by
  a separate server process."

### 6.3 Headers

| Header                | Meaning                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `X-Signature-SHA256`  | **RSA-SHA256 signature of the raw request body, Base64-encoded**           |
| `X-Delivery-Id`       | unique UUID per delivery attempt → the dedupe key                          |
| `X-Test-Notification` | present with value `true` for the test event sent at subscription creation |

### 6.4 Payload envelope

```json
{
  "data": {},
  "subscription_id": "01234567-89ab-cdef-0123-456789abcdef",
  "event_type": "transfers#state-change",
  "schema_version": "4.0.0",
  "sent_at": "2020-01-01T12:34:56.123Z"
}
```

Expected response body: `{"status":"ok"}` with `200`.
Payloads contain **no PII**. Schema `4.0.0`+ gives millisecond-precision timestamps — **use 4.0.0**.

### 6.5 Signature verification — the published public keys

Wise signs with an RSA key; the verifying key is **public**, so no shared secret exists. Reference
implementations (Java/Node/Ruby): <https://github.com/transferwise/digital-signatures-examples/tree/main/verify-webhook-signature>

**Production**

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvO8vXV+JksBzZAY6GhSO
XdoTCfhXaaiZ+qAbtaDBiu2AGkGVpmEygFmWP4Li9m5+Ni85BhVvZOodM9epgW3F
bA5Q1SexvAF1PPjX4JpMstak/QhAgl1qMSqEevL8cmUeTgcMuVWCJmlge9h7B1CS
D4rtlimGZozG39rUBDg6Qt2K+P4wBfLblL0k4C4YUdLnpGYEDIth+i8XsRpFlogx
CAFyH9+knYsDbR43UJ9shtc42Ybd40Afihj8KnYKXzchyQ42aC8aZ/h5hyZ28yVy
Oj3Vos0VdBIs/gAyJ/4yyQFCXYte64I7ssrlbGRaco4nKF3HmaNhxwyKyJafz19e
HwIDAQAB
-----END PUBLIC KEY-----
```

**Sandbox**

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwpb91cEYuyJNQepZAVfP
ZIlPZfNUefH+n6w9SW3fykqKu938cR7WadQv87oF2VuT+fDt7kqeRziTmPSUhqPU
ys/V2Q1rlfJuXbE+Gga37t7zwd0egQ+KyOEHQOpcTwKmtZ81ieGHynAQzsn1We3j
wt760MsCPJ7GMT141ByQM+yW1Bx+4SG3IGjXWyqOWrcXsxAvIXkpUD/jK/L958Cg
nZEgz0BSEh0QxYLITnW1lLokSx/dTianWPFEhMC9BgijempgNXHNfcVirg1lPSyg
z7KqoKUN0oHqWLr2U1A+7kqrl6O2nx3CKs1bj1hToT1+p4kcMoHXA7kA+VBLUpEs
VwIDAQAB
-----END PUBLIC KEY-----
```

Node verification sketch:

```ts
import { createVerify } from 'node:crypto';

export function verifyWiseSignature(
  rawBody: Buffer,
  signatureB64: string,
  publicKeyPem: string
) {
  if (!signatureB64 || rawBody.length === 0) return false;
  try {
    return createVerify('RSA-SHA256')
      .update(rawBody)
      .verify(publicKeyPem, signatureB64, 'base64');
  } catch {
    return false;
  }
}
```

`crypto.verify` is already constant-time-safe for signature comparison; no manual `timingSafeEqual`
is needed (unlike the HMAC path in `providers/rise/webhook-verifier.ts`).

### 6.6 Subscribing

**Application level** (Model B — Wise's recommendation): `POST /v3/applications/{clientKey}/subscriptions`,
security `ClientCredentialsToken`.

```json
{
  "name": "DavinTrade commission payout listener",
  "trigger_on": "transfers#state-change",
  "delivery": {
    "version": "4.0.0",
    "url": "https://money-service-production.up.railway.app/v1/webhooks/wise"
  }
}
```

**Profile level** (Model A — what a personal token can do):
`POST /v1/profiles/{profileId}/subscriptions` with a **user token**. Same body/response shape. Only
certain event types support profile level.

**Or via Developer Hub UI** (`https://wise.com/developer-hub` → Webhooks > Subscriptions):
one event type per subscription, URL validated live (must be `https://`, no port, no query params,
no credentials), schema version picked from a dropdown. Creating a subscription **automatically
sends a test event** to the URL — the endpoint must already be deployed and answering `200`.

Deleting a subscription: "Any events in flight at the time of deletion are still delivered but no
webhook will be sent for them as the subscription no longer exists."

Sources: <https://docs.wise.com/guides/developer/webhooks> ·
<https://docs.wise.com/guides/developer/webhooks/event-handling> ·
<https://docs.wise.com/guides/developer/webhooks/subscribe-to-webhooks> ·
<https://docs.wise.com/api-reference/webhook/webhookapplicationsubscriptioncreate>

### 6.7 Sender IPs (optional allowlisting)

Production: `45.129.54.0/24`, `45.129.55.0/24` (Frankfurt + Paris, for regional failover).
Individual IPs if a `/24` is impossible: `45.129.54.176`, `45.129.54.183`, `45.129.54.106`,
`18.184.162.75`, `52.58.50.91`, `18.184.251.153`, `18.197.211.225`, `18.197.211.10`,
`18.197.211.120`.
Sandbox: `18.199.110.249`, `3.67.109.66`, `3.78.113.13`, `35.157.106.141`, `54.93.137.122`,
`18.196.39.9`.

Wise's own caveat: "Don't use IP allowlisting as your only security control."

---

## 7. Events used by Part 19.5

### 7.1 `transfers#state-change` — primary

Schema `4.0.0` payload `data`:

```
data.resource.type        "transfer"
data.resource.id          <transfer id, integer>
data.resource.profile_id  <integer>
data.resource.account_id  <recipient account id, integer>
data.current_state        e.g. "processing"
data.previous_state       e.g. "incoming_payment_waiting"  (null for newly created)
data.occurred_at          "2020-01-01T12:34:56.789Z"        ← ORDERING KEY
```

Profile-level ✅ · Application-level ✅.
⚠️ "For topup-to-balance transfers, `transfers#state-change` events are **not** triggered. To listen
to these, subscribe to `balances#update`."

Source: <https://docs.wise.com/api-reference/webhook-event/eventtransfersstatechange>

### 7.2 `transfers#payout-failure` — required alongside, not instead

```
data.transfer_id, data.profile_id,
data.failure_reason_code        e.g. "WRONG_ID_NUMBER"
data.failure_description        e.g. "Invalid recipient's ID document number"
data.occurred_at
```

Wise's explicit guidance:

> "The `transfers#state-change` event provides high level information about the state of transfers,
> but it doesn't provide details about payout failures. While a transfer is in
> `outgoing_payment_sent` state, the payout could fail for certain reasons. Additionally, **not
> every payout failure will trigger a change in transfer state.** For example a payout might fail
> with `MANDATE_NOT_FILLED_IN`, but the corresponding transfer might stay in the same state. We
> recommend processing both event types **separate from each other**."
>
> "Wise can add new failure codes so your system should be able to handle the events even if the
> failure reason code is not recognised."

Source: <https://docs.wise.com/api-reference/webhook-event/eventtransferspayoutfailure>

### 7.3 Others considered

| Event                                                         | Verdict for Part 19.5                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `balances#update`                                             | **subscribe** — notifies on every multi-currency account credit/debit. Used as the _best-effort_ funding-detection signal in MANUAL mode, and required for topup-to-balance transfers.                                                                   |
| `balances#credit`                                             | legacy/profile-level equivalent of the credit half. Prefer `balances#update`.                                                                                                                                                                            |
| `transfers#active-cases`                                      | profile-level; fires when a transfer's list of active cases changes (Wise doing extra checks / a problem needing attention). **Optional nice-to-have** — `transfers#payout-failure` covers the actionable cases with a documented `4.0.0` schema. Defer. |
| `transfers#refund`                                            | supported in sandbox; note sandbox refund amounts are simulated, not realistic. Optional.                                                                                                                                                                |
| `profiles#state-change`, `profiles#verification-state-change` | not needed — affiliates are recipients, not Wise profiles.                                                                                                                                                                                               |
| card / SWIFT / bulk-settlement events                         | out of scope.                                                                                                                                                                                                                                            |

---

## 8. Transfer status reference (contract-critical)

| Status                       | Meaning                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `incoming_payment_waiting`   | submitted; Wise awaiting funds                                                                                   |
| `incoming_payment_initiated` | funding initiated, money not yet at Wise                                                                         |
| `processing`                 | funds received; AML / compliance / fraud checks running                                                          |
| `funds_converted`            | compliance done; FX executed                                                                                     |
| `outgoing_payment_sent`      | **Wise has paid out. Final state of the happy path.** _Not_ proof the beneficiary bank has credited the account. |
| `cancelled`                  | never funded, therefore never processed — final for unfunded transfers                                           |
| `funds_refunded`             | refunded to sender — final state for a funded-then-cancelled transfer                                            |
| `bounced_back`               | bounced but not yet cancelled/refunded → will either deliver late or become `funds_refunded`                     |
| `charged_back`               | Wise couldn't debit the payer, or the payer asked for the funds back. **Can follow any state.**                  |
| `unknown`                    | Wise lacks information to reach a final state; Wise emails for more info                                         |

Happy path: `incoming_payment_waiting → processing → funds_converted → outgoing_payment_sent`
Unhappy path: `outgoing_payment_sent → bounced_back → processing → cancelled → funds_refunded`

> "Transfers support **rollback transitions**, which allows you to return a transfer back to one of
> its previous states."
>
> "Most bounce backs occur within 2-3 business days. However, they can happen **up to several weeks**
> after a transfer is sent."

Payout speed varies by region (UK: minutes after `outgoing_payment_sent`; US: usually a day).
Live per-transfer delivery estimate: `GET /v1/delivery-estimates/{transferId}?timezone=…`.

Wise's recommended consumer-facing wording: `outgoing_payment_sent` → "Payment sent";
`charged_back` → "Funds returned to sender"; `bounced_back` → "Bounced back"; etc.

Source: <https://docs.wise.com/guides/product/send-money/tracking/transfer-statuses>

---

## 9. Corrections to `replace-rise-with-wise.md` (Davin's original brief)

The brief is directionally right and its state-mapping intuition matches the design. Five specifics
do not survive verification — corrected here so they are not implemented as written:

| #   | Brief says                                                                 | Verified reality                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "**User/Profile ID**: Required in API headers (`X-Profile-Id`)"            | There is **no `X-Profile-Id` header** in the current API. The profile id is a **path segment** on v3 endpoints (`/v3/profiles/{profileId}/quotes`, `…/batch-groups`, `…/batch-payments/{id}/payments`) and a **body field** on `POST /v1/accounts` (`"profile"`). The optional header worth sending is `X-External-Correlation-Id`. |
| 2   | `POST /v3/applications/subscriptions`                                      | Actual path: `POST /v3/applications/**{clientKey}**/subscriptions`, and it requires a **ClientCredentialsToken** — i.e. **not available on a personal token**. On Model A use `POST /v1/profiles/{profileId}/subscriptions` (profile-level).                                                                                        |
| 3   | `"delivery": { "version": "4.0.0" }` with event `transfers#state-change`   | Correct — `4.0.0` is right and is the recommended version (ms-precision timestamps for ordering). ✅ no change, noted for completeness.                                                                                                                                                                                             |
| 4   | Subscribe to `balances#credit`                                             | Prefer **`balances#update`** — the currently documented event, application- _and_ profile-level, and the one Wise names as the fallback for topup-to-balance transfers.                                                                                                                                                             |
| 5   | Subscribe to `transfers#active-cases` for exceptions                       | Exists, but is profile-level with legacy schema. The documented, versioned, actionable event for payout problems is **`transfers#payout-failure`** (`4.0.0`, with `failure_reason_code` + `failure_description`). Subscribe to that; treat `active-cases` as optional later.                                                        |
| 6   | "Verify the raw HTTP request body against Wise's Public Key … timing-safe" | Correct in substance. Note the mechanism is **asymmetric RSA verification**, so `crypto.verify` handles it — there is no secret to compare and no need for `timingSafeEqual`. Keys are published (§6.5).                                                                                                                            |
| 7   | (silent)                                                                   | The brief never mentions that **funding is not available via API for a Thailand-registered account on a personal token**, nor that **Business Payment Approvals break API transfers**. These two facts drive the entire Part 19.5 design.                                                                                           |

---

## 10. Sandbox testing capabilities (what W5/W6 can and cannot prove)

**Can** (per Wise's own sandbox capability list): create fixed-source and fixed-target quotes;
create recipients; request transfer requirements; create transfers; **create batch payments**;
initiate funding with balance or bulk settlement; subscribe to and receive `transfers#state-change`
and `transfers#refund`; **simulate transfer state changes**; simulate a balance **top-up** and
receive `balances#update`; retrieve statements showing the simulated top-up.

**Cannot:** move real money; live rates; email/SMS notifications (**sandbox 2FA code is always
`111111`**); realistic refund amounts in refund webhooks; ACH/direct-debit USD funding; load testing.

**Sandbox region/currency fallback when something doesn't work:** UK region; **GBP, USD, EUR**
(business = UK Sole Trader). ⇒ **THB cannot be exercised end-to-end in sandbox.**

### Simulation API — transfer state changes

`/api-reference/simulation/simulationtransferstatechange`. Available states, **which must be called
in order**: `processing` → `funds_converted` → `outgoing_payment_sent` → `bounced_back` →
`funds_refunded`.

Requirements: **fund the transfer first**, and wait **≥5 seconds between calls** (processing is
asynchronous). Also available: `simulationbalancetopup` for `balances#update`.

This is the mechanism that generates **real, Wise-signed** webhook payloads for the replay tests
the migration plan (plan §6) requires — capture them once in W5 and commit them as fixtures.

Sources: <https://docs.wise.com/guides/developer/environments> ·
<https://docs.wise.com/guides/product/send-money/tracking/transfer-statuses>

---

## 11. Quick endpoint index (everything Part 19.5 calls)

| Purpose                                | Method + path                                                                           | Token needed                     |
| -------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| Profiles (bootstrap `WISE_PROFILE_ID`) | `GET /v1/profiles`                                                                      | personal                         |
| Authenticated quote                    | `POST /v3/profiles/{profileId}/quotes`                                                  | personal                         |
| Update quote (attach recipient)        | `PATCH`/`PUT` quote per API reference                                                   | personal                         |
| Account requirements                   | `GET`/`POST /v1/quotes/{quoteId}/account-requirements` (+`Accept-Minor-Version: 1`)     | personal                         |
| Create recipient                       | `POST /v1/accounts`                                                                     | personal                         |
| List / get recipient                   | `GET /v1/accounts`, `GET /v1/accounts/{id}`                                             | personal                         |
| Transfer requirements                  | `GET`/`POST` transfer-requirements                                                      | personal                         |
| Create transfer                        | `POST /v1/transfers`                                                                    | personal                         |
| Get transfer (reconciliation)          | `GET /v1/transfers/{id}`                                                                | personal                         |
| Delivery estimate                      | `GET /v1/delivery-estimates/{id}`                                                       | personal                         |
| Create batch group                     | `POST /v3/profiles/{profileId}/batch-groups`                                            | personal                         |
| Add transfer to batch group            | `POST /v3/profiles/{profileId}/batch-groups/{groupId}/transfers`                        | personal                         |
| Complete batch group                   | `PATCH /v3/profiles/{profileId}/batch-groups/{groupId}` `{status:"COMPLETED", version}` | personal                         |
| Get batch group                        | `GET /v3/profiles/{profileId}/batch-groups/{groupId}`                                   | personal                         |
| **Fund batch group**                   | `POST /v3/profiles/{profileId}/batch-payments/{groupId}/payments` `{type:"BALANCE"}`    | personal **+ region gate + SCA** |
| Fund single transfer                   | `POST /v3/profiles/{profileId}/transfers/{transferId}/payments`                         | personal **+ region gate + SCA** |
| Subscribe (profile)                    | `POST /v1/profiles/{profileId}/subscriptions`                                           | user/personal                    |
| Subscribe (application)                | `POST /v3/applications/{clientKey}/subscriptions`                                       | client credentials               |
| Simulate state change                  | Simulation API                                                                          | personal (sandbox only)          |

> **Executor note:** the exact HTTP verb/shape for _update quote_ and _complete batch group_ must be
> re-read from the live API reference at CONFIRM time (`/api-reference/quote`,
> `/api-reference/batch-group`) — those two are the only entries in this table taken from the
> workflow prose rather than a per-operation reference page.

---

## Sources

- [Sandbox & Production Environments](https://docs.wise.com/guides/developer/environments)
- [Personal API tokens](https://docs.wise.com/guides/developer/auth-and-security/personal-api-token)
- [Payouts for Small to Medium Businesses (SMBs)](https://docs.wise.com/guides/product/send-money/use-cases/payouts-smbs)
- [Send Money (overview)](https://docs.wise.com/guides/product/send-money)
- [Enterprise: Send money](https://docs.wise.com/guides/product/send-money/use-cases/enterprise/send-money)
- [Quotes](https://docs.wise.com/api-reference/quote)
- [Recipient Accounts](https://docs.wise.com/api-reference/recipient)
- [Retrieve recipient account requirements dynamically](https://docs.wise.com/api-reference/recipient/recipientaccountrequirementsget)
- [Transfers](https://docs.wise.com/api-reference/transfer)
- [Create a transfer](https://docs.wise.com/api-reference/standard-transfer/transfercreate)
- [Batch Payment Groups](https://docs.wise.com/api-reference/batch-group)
- [Create a batch group](https://docs.wise.com/api-reference/batch-group/batchgroupcreate)
- [Fund a batch group](https://docs.wise.com/api-reference/batch-group/batchgroupfund)
- [Webhooks and notifications](https://docs.wise.com/guides/developer/webhooks)
- [Event handling (signatures, keys, envelope)](https://docs.wise.com/guides/developer/webhooks/event-handling)
- [Subscribe to webhooks](https://docs.wise.com/guides/developer/webhooks/subscribe-to-webhooks)
- [Create Application Webhook Subscription](https://docs.wise.com/api-reference/webhook/webhookapplicationsubscriptioncreate)
- [Transfer state change event](https://docs.wise.com/api-reference/webhook-event/eventtransfersstatechange)
- [Transfer payout failure event](https://docs.wise.com/api-reference/webhook-event/eventtransferspayoutfailure)
- [Tracking transfers / transfer statuses](https://docs.wise.com/guides/product/send-money/tracking/transfer-statuses)
- [SCA over API](https://docs.wise.com/guides/developer/auth-and-security/sca-over-api)
- [One Time Token](https://docs.wise.com/guides/developer/auth-and-security/one-time-token)
- [Strong Customer Authentication & 2FA](https://docs.wise.com/api-docs/features/strong-customer-authentication-2fa)
- [Webhook signature reference implementations (GitHub)](https://github.com/transferwise/digital-signatures-examples/tree/main/verify-webhook-signature)
