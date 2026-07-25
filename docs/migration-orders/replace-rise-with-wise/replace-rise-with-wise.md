To replace Rise with **Wise Platform API** as the final node in your disbursement workflow, you'll need to configure API credentials and webhook listeners to track payouts automatically.

---

## 1. Wise API Requirements & Settings

To allow your backend service to communicate programmatically with Wise, you need two layers of credentials:

### **A. Environment & Credentials**

- **Sandbox Environment**: `[https://api.wise-sandbox.com](https://api.wise-sandbox.com)`
- **Production Environment**: `[https://api.wise.com](https://api.wise.com)`
- **API Key / Client Credentials**: Generated via the **Wise Developer Hub** under your Business Profile.
- **User/Profile ID**: Required in API headers (`X-Profile-Id`) to specify which multi-currency account funds are being drawn from.

### **B. Webhook Endpoint Requirements**

Before subscribing to Wise webhooks, your backend endpoint must meet these standards:

- **Protocol**: HTTPS listening on port 443 with a valid, trusted SSL/TLS certificate (no self-signed certificates).
- **Domain**: A public FQDN (IP addresses are rejected).
- **Response**: Must return a `200 OK` status code immediately upon receiving the event payload.

---

## 2. Setting Up Webhooks

Wise supports subscribing to webhooks either via the **Wise Developer Hub UI** or programmatically via the API.

### Subscribing via API

You can register your webhook listener using a `POST` request:

```http
POST /v3/applications/subscriptions
Authorization: Bearer <YOUR_CLIENT_CREDENTIALS_TOKEN>
Content-Type: application/json

{
  "name": "DavinTrade Commission Disbursed Listener",
  "trigger_on": "transfers#state-change",
  "delivery": {
    "url": "https://api.davintrade.com/api/v1/webhooks/wise",
    "version": "4.0.0"
  }
}

```

---

## 3. Essential Webhook Events for Your Backend

For an affiliate commission payout system, you should subscribe to the following primary event types:

| Event Name (`trigger_on`)    | When It Triggers                                                                                        | Primary Backend Action                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **`transfers#state-change`** | Fired whenever a transfer changes status (e.g., `processing` → `outgoing_payment_sent` / `cancelled`).  | Update affiliate payout status in your DB from `pending` to `paid` or `failed`. |
| **`transfers#active-cases`** | Fired if a payout hits an exception (e.g., recipient bank account detail mismatch or compliance check). | Flag the commission payout for manual review or notify the affiliate.           |
| **`balances#credit`**        | Fired when your Wise business account is funded (e.g., top-up from Stripe/dLocal revenues).             | Reconcile your platform's available disbursement liquidity.                     |

---

## 4. Key Transfer Lifecycle States (`transfers#state-change`)

When handling the webhook payload, evaluate the `data.current_state` property:

- **`incoming_payment_waiting` / `processing**`: Wise is processing the payout request. Keep commission state as `in_transit`.
- **`outgoing_payment_sent`**: **[Success State]** Wise has dispatched local funds to the affiliate's bank. Mark commission as `disbursed`.
- **`bounced_back` / `funds_refunded**`: **[Failure State]** Recipient bank rejected the deposit. Revert affiliate balance and alert the user to update bank info.

---

## 5. Security: Signature Verification

Wise signs every outgoing webhook POST request using RSA-SHA256. To ensure incoming webhooks are authentic:

1. Extract the `X-Signature-SHA256` header.
2. Verify the raw HTTP request body against Wise's Public Key (available in their Developer Hub / documentation).
3. Perform a timing-safe signature validation prior to parsing JSON in your application logic.
