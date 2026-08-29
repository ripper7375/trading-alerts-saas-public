# **DavinTrade Platform: Global SaaS Architecture & Multi-Jurisdiction Tax Specification**

**Document Type:** Engineering & Legal Tax Architecture Design | **Target Entity:** UK Limited Company (UK Ltd) | **Primary Base Currency:** USD  
**Target Executor:** Claude Code / Senior Engineering Team | **Status:** Ready for Implementation

## **1\. Executive Summary & Global Tax Compliance Strategy**

This architecture document defines the end-to-end technical implementation of the billing, tax automation, and database storage systems for DavinTrade (a SaaS platform operating under a UK Ltd entity). The platform provides algorithmic analysis, indicator pipelines, and trading tools to global customers with USD as the primary functional base currency.

### **1.1 Multi-Jurisdiction Tax Decision Matrix**

| Target Market / Customer Tier             | Tax Classification & Threshold                               | Applied Tax Rate                     | Required System Behavior                                                                   |
| :---------------------------------------- | :----------------------------------------------------------- | :----------------------------------- | :----------------------------------------------------------------------------------------- |
| **EU B2C (Consumers)**                    | Zero Threshold (Mandatory from €0.01)                        | Destination Country Rate (17% – 27%) | Stripe Tax calculates VAT automatically. Settled quarterly via EU Non-Union OSS (Ireland). |
| **EU & Global B2B (Businesses)**          | Reverse Charge Mechanism                                     | 0% VAT                               | Collect & validate Tax/VAT ID. Annotate invoice: "VAT Subject to Reverse Charge".          |
| **UK Domestic Customers**                 | £90,000 Rolling 12-Month Threshold                           | 0% (Until threshold reached)         | Issue standard invoices without UK VAT until domestic taxable turnover exceeds £90k.       |
| **United States (US)**                    | State Economic Nexus ($100k / 200 txns)                      | 0% (Postponed during MVP)            | Monitor cumulative state sales via analytics; no immediate tax collection needed.          |
| **dLocal Emerging Markets (8 Countries)** | Country-Specific Thresholds (TH, VN, ID, IN, PK, NG, TR, ZA) | Flat Rate (0% Local Tax)             | Process local payment methods. Track 12-month rolling gross revenue per country.           |

## **2\. System Architecture & Data Flow**

The architecture decouples checkout initiation from webhook-driven fulfillment, ensuring atomic transactions, idempotent processing, and resilient record keeping.

\[ Client Browser / Web App \]  
 │  
 │ 1\. POST /api/checkout/create-session  
 ▼  
\[ DavinTrade Backend API \] ──( 2\. stripe.checkout.sessions.create )──► \[ Stripe API Engine \]  
 ▲ │  
 │ │ 3\. Returns Session URL  
 │ ▼  
 │ \[ Stripe Hosted Checkout \]  
 │ (Collects Tax ID, Address, IP)  
 │ │  
 │ 5\. Asynchronous Webhooks: │ 4\. Payment Authorized  
 │ \- checkout.session.completed ▼  
 │ \- invoice.payment_succeeded \[ Stripe Billing Core \]  
 │  
\[ Webhook Ingestion Service \]  
 │  
 │ 6\. Verify Signature & Upsert Database  
 ▼  
\[ Application Database (PostgreSQL / SQLite) \]  
 ├── \`orders\` (Session status, customer ID, gross amount)  
 ├── \`invoices\` (Tax breakdown, tax_rate, tax_country, customer_tax_id, invoice_pdf)  
 └── \`v_country_trailing_12m_sales\` (SQL Monitoring View)

## **3\. Stripe Backend Implementation (API & Checkout Sessions)**

To support automated multi-jurisdiction tax calculation, B2B VAT validation, and universal PDF invoice generation, the session creation parameters must be configured with explicit flags.

### **3.1 Configuration Parameters Breakdown**

> - **automatic_tax: { enabled: true }**: Instructs Stripe to calculate tax in real time based on customer IP address, billing address, and Card BIN country code.
> - **tax_id_collection: { enabled: true }**: Renders the Tax ID / VAT Number input field on the checkout page. Automatically validates EU VAT numbers against the official VIES registry. If valid, applies 0% Reverse Charge.
> - **billing_address_collection: 'required'**: Mandates address submission to satisfy EU two-factor non-conflicting location proof rules.
> - **invoice_creation: { enabled: true } (Technical Nuance for One-Time Payments)**: In mode: 'subscription', Stripe generates invoices automatically. For mode: 'payment' (lifetime licenses or one-off add-ons), this parameter must be explicitly passed to trigger automatic PDF invoice generation.

### **3.2 TypeScript Checkout Service Implementation**

import Stripe from 'stripe';

const stripe \= new Stripe(process.env.STRIPE_SECRET_KEY as string, {  
 apiVersion: '2024-06-20',  
});

export interface CreateCheckoutParams {  
 customerId?: string;  
 customerEmail: string;  
 priceId: string;  
 mode: 'subscription' | 'payment';  
 userId: string;  
 successUrl: string;  
 cancelUrl: string;  
}

export async function createDavinTradeCheckoutSession(  
 params: CreateCheckoutParams  
): Promise\<Stripe.Checkout.Session\> {  
 const sessionParams: Stripe.Checkout.SessionCreateParams \= {  
 mode: params.mode,  
 payment_method_types: \['card'\],  
 customer: params.customerId || undefined,  
 customer_email: params.customerId ? undefined : params.customerEmail,  
 line_items: \[  
 {  
 price: params.priceId,  
 quantity: 1,  
 },  
 \],  
 // 1\. Enable automated multi-jurisdiction tax calculation  
 automatic_tax: {  
 enabled: true,  
 },  
 // 2\. Enable B2B VAT / Tax ID collection and VIES validation  
 tax_id_collection: {  
 enabled: true,  
 },  
 // 3\. Collect billing address for legal location proof  
 billing_address_collection: 'required',  
 customer_update: {  
 address: 'auto',  
 name: 'auto',  
 },  
 // 4\. Traceability metadata  
 metadata: {  
 userId: params.userId,  
 },  
 success_url: \`${params.successUrl}?session_id={CHECKOUT_SESSION_ID}\`,  
 cancel_url: params.cancelUrl,  
 };

// Technical Nuance: Enforce PDF invoice creation for one-off payments  
 if (params.mode \=== 'payment') {  
 sessionParams.invoice_creation \= {  
 enabled: true,  
 invoice_data: {  
 metadata: {  
 userId: params.userId,  
 },  
 },  
 };  
 }

return await stripe.checkout.sessions.create(sessionParams);  
}

## **4\. Webhook Ingestion & Technical Nuances**

### **4.1 Resolving Technical Nuances**

**Nuance 1 (PDF Invoice Availability):** When the checkout.session.completed event fires, the session.invoice field only contains a raw invoice ID string (e.g., in_1Nxxxx), not the final compiled invoice_pdf URL. Attempting to read session.invoice_pdf directly results in null.  
**Solution:** Implement a dual-event webhook architecture:

> 1. checkout.session.completed: Immediately provisions user access and creates an initial order record.
> 2. invoice.payment_succeeded: Fires when the invoice is finalized and signed. Captures invoice.invoice_pdf, invoice.hosted_invoice_url, line-item tax_rate, and tax_amount, updating the database record idempotently.

### **4.2 TypeScript Webhook Handler (\`webhook.handler.ts\`)**

import { Request, Response } from 'express';  
import Stripe from 'stripe';  
import { db } from './db';

const stripe \= new Stripe(process.env.STRIPE_SECRET_KEY as string, {  
 apiVersion: '2024-06-20',  
});

export async function handleStripeWebhook(req: Request, res: Response) {  
 const sig \= req.headers\['stripe-signature'\] as string;  
 let event: Stripe.Event;

try {  
 event \= stripe.webhooks.constructEvent(  
 req.body,  
 sig,  
 process.env.STRIPE_WEBHOOK_SECRET as string  
 );  
 } catch (err: any) {  
 console.error(\`Webhook signature verification failed: ${err.message}\`);  
 return res.status(400).send(\`Webhook Error: ${err.message}\`);  
 }

try {  
 switch (event.type) {  
 case 'checkout.session.completed': {  
 const session \= event.data.object as Stripe.Checkout.Session;  
 await handleCheckoutSessionCompleted(session);  
 break;  
 }

      case 'invoice.payment\_succeeded': {
        const invoice \= event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription \= event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });

} catch (error: any) {  
 console.error(\`Error processing webhook event ${event.type}:\`, error);  
 return res.status(500).json({ error: 'Webhook processing failed' });  
 }  
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {  
 const userId \= session.metadata?.userId;  
 if (\!userId) return;

const customerCountry \= session.customer_details?.address?.country || 'UNKNOWN';  
 const taxAmount \= session.total_details?.amount_tax ?? 0;  
 const totalAmount \= session.amount_total ?? 0;  
 const currency \= session.currency?.toUpperCase() || 'USD';

await db.query(  
 \`INSERT INTO orders (  
 session_id, user_id, stripe_customer_id, amount_total, tax_amount,  
 currency, customer_country, payment_status, created_at  
 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())  
 ON CONFLICT (session_id) DO UPDATE SET  
 payment_status \= EXCLUDED.payment_status,  
 tax_amount \= EXCLUDED.tax_amount;\`,  
 \[  
 session.id,  
 userId,  
 session.customer as string,  
 totalAmount / 100,  
 taxAmount / 100,  
 currency,  
 customerCountry,  
 session.payment_status,  
 \]  
 );  
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {  
 const invoicePdf \= invoice.invoice_pdf;  
 const hostedInvoiceUrl \= invoice.hosted_invoice_url;  
 const customerId \= invoice.customer as string;  
 const stripeInvoiceId \= invoice.id;  
 const taxAmount \= invoice.tax ?? 0;  
 const totalAmount \= invoice.total;  
 const currency \= invoice.currency.toUpperCase();  
 const customerCountry \= invoice.customer_address?.country || 'UNKNOWN';

let effectiveTaxRate \= 0;  
 if (invoice.lines.data.length \> 0 && invoice.lines.data\[0\].tax_rates?.length) {  
 effectiveTaxRate \= (invoice.lines.data\[0\].tax_rates\[0\].percentage ?? 0\) / 100;  
 }

const customerTaxId \= invoice.customer_tax_ids?.\[0\]?.value || null;

await db.query(  
 \`INSERT INTO invoices (  
 stripe_invoice_id, stripe_customer_id, amount_total, tax_amount,  
 tax_rate, tax_country, customer_tax_id, currency,  
 invoice_pdf, hosted_invoice_url, paid_at  
 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TO_TIMESTAMP($11))  
 ON CONFLICT (stripe_invoice_id) DO UPDATE SET  
 invoice_pdf \= EXCLUDED.invoice_pdf,  
 hosted_invoice_url \= EXCLUDED.hosted_invoice_url,  
 tax_amount \= EXCLUDED.tax_amount,  
 tax_rate \= EXCLUDED.tax_rate,  
 customer_tax_id \= EXCLUDED.customer_tax_id,  
 paid_at \= EXCLUDED.paid_at;\`,  
 \[  
 stripeInvoiceId,  
 customerId,  
 totalAmount / 100,  
 taxAmount / 100,  
 effectiveTaxRate,  
 customerCountry,  
 customerTaxId,  
 currency,  
 invoicePdf,  
 hostedInvoiceUrl,  
 invoice.status_transitions.paid_at || Math.floor(Date.now() / 1000),  
 \]  
 );  
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {  
 await db.query(  
 \`UPDATE subscriptions SET status \= 'canceled', updated_at \= NOW() WHERE stripe_subscription_id \= $1;\`,  
 \[subscription.id\]  
 );  
}

## **5\. Database Schema & Country-Based Threshold Aggregation**

### **5.1 SQL DDL (\`schema.sql\`)**

\-- Table: orders  
CREATE TABLE IF NOT EXISTS orders (  
 id SERIAL PRIMARY KEY,  
 session_id VARCHAR(255) UNIQUE NOT NULL,  
 user_id VARCHAR(255) NOT NULL,  
 stripe_customer_id VARCHAR(255),  
 amount_total NUMERIC(12, 2\) NOT NULL,  
 tax_amount NUMERIC(12, 2\) DEFAULT 0.00,  
 currency VARCHAR(10) NOT NULL DEFAULT 'USD',  
 customer_country VARCHAR(10) NOT NULL,  
 payment_status VARCHAR(50) NOT NULL,  
 created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  
);

\-- Table: invoices (Tax Audit Log & User Downloads)  
CREATE TABLE IF NOT EXISTS invoices (  
 id SERIAL PRIMARY KEY,  
 stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,  
 stripe_customer_id VARCHAR(255) NOT NULL,  
 amount_total NUMERIC(12, 2\) NOT NULL,  
 tax_amount NUMERIC(12, 2\) DEFAULT 0.00,  
 tax_rate NUMERIC(6, 4\) DEFAULT 0.0000,  
 tax_country VARCHAR(10) NOT NULL,  
 customer_tax_id VARCHAR(100),  
 currency VARCHAR(10) NOT NULL DEFAULT 'USD',  
 invoice_pdf TEXT,  
 hosted_invoice_url TEXT,  
 paid_at TIMESTAMP WITH TIME ZONE,  
 created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_country ON invoices(tax_country);  
CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON invoices(paid_at);

### **5.2 Rolling 12-Month Sales Threshold Monitoring View**

CREATE OR REPLACE VIEW v_country_trailing_12m_sales AS  
SELECT  
 tax_country,  
 currency,  
 COUNT(id) AS total_transactions,  
 SUM(amount_total) AS gross_sales_12m,  
 SUM(tax_amount) AS total_tax_collected_12m  
FROM invoices  
WHERE paid_at \>= NOW() \- INTERVAL '12 months'  
GROUP BY tax_country, currency  
ORDER BY gross_sales_12m DESC;

## **6\. Stripe Dashboard & Product Tax Code Configuration**

> 1. **Assign Product Tax Code:**

- Navigate to: **Product Catalog** → Select Plan → **Tax Code**.
- Set to: txcd_10501000 (**Software as a service (SaaS) \- business / consumer**).
- _Effect:_ Automatically categorizes trading algorithms and software access under digital service tax rules globally.
  > 2. **Invoice Customization:**
- Navigate to: **Settings** → **Invoice template**.
- Set Company Name, UK Registered Office Address, and default memo: "DavinTrade \- Algorithmic Analysis & SaaS Platform. VAT Reverse Charge applies to eligible non-UK business customers."
  > 3. **Tax Registration:**
- Navigate to: **Settings** → **Tax** → **Tax registrations** → **Add registration**.
- Select **European Union** → **OSS Non-Union** → Input Ireland Revenue EU... Tax ID.

## **7\. EU Non-Union OSS Compliance (Ireland ROS Portal)**

> 1. **Registration:** Apply via the Irish Revenue Online Service (ROS) portal as a Non-Union OSS applicant. Submit UK Certificate of Incorporation and Director details to obtain the EU372XXXXXX identifier.
> 2. **Quarterly Export:** At quarter-end (Q1: Apr 30, Q2: Jul 31, Q3: Oct 31, Q4: Jan 31), export the _Stripe Tax EU OSS Report_ summarizing gross EUR sales and VAT collected by member state.
> 3. **Filing & Remittance:** Input country totals into the ROS portal and initiate a single wire transfer in EUR to Irish Revenue. Irish Revenue automatically disburses taxes to respective member states.

## **8\. Claude Code Execution Plan & Verification Checklist**

> - \[ \] **Phase 1: Dependencies:** Verify stripe and @stripe/stripe-js packages.
> - \[ \] **Phase 2: Database Migration:** Run schema.sql to create orders, invoices, indexes, and the 12-month trailing view.
> - \[ \] **Phase 3: Checkout Service:** Update checkout session creation with automatic_tax: { enabled: true }, tax_id_collection: { enabled: true }, and conditional invoice_creation.
> - \[ \] **Phase 4: Webhooks:** Implement signature verification and dual-event handlers (checkout.session.completed and invoice.payment_succeeded).
> - \[ \] **Phase 5: User Dashboard API:** Provide GET /api/user/invoices returning invoice_pdf and hosted_invoice_url.
> - \[ \] **Phase 6: End-to-End Testing:** Test using Stripe Test Clock with EU customer addresses (Germany: 19%, France: 20%) and verified B2B VAT IDs (0% Reverse Charge).
