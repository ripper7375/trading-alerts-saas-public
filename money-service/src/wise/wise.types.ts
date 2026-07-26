/**
 * Wise API Types (Session 4A-W3a, File 3/10)
 *
 * TypeScript interfaces for Wise API payloads and responses, per
 * `part19.5-wise-disbursement-openapi.yaml` (frozen at 4A-W1) and
 * `02-wise-platform-api-integration-reference.md` §4.2-4.3.
 */

export interface WiseProfile {
  id: number;
  type: 'PERSONAL' | 'BUSINESS';
  details: Record<string, unknown>;
}

export interface AccountRequirementFieldGroup {
  key: string;
  name: string;
  type: string;
  required: boolean;
  example?: string;
  minLength?: number;
  maxLength?: number;
  validationRegexp?: string;
  valuesAllowed?: Array<{ key: string; name: string }>;
  refreshRequirementsOnChange?: boolean;
}

export interface AccountRequirementGroup {
  type: string;
  title: string;
  usageInfo?: string;
  fields: Array<{ group: AccountRequirementFieldGroup[] }>;
}

export interface CreateRecipientDto {
  currency: string;
  type: string;
  profile: number;
  accountHolderName: string;
  details: Record<string, unknown>;
}

export interface WiseRecipientResponse {
  id: number;
  profile: number;
  accountHolderName: string;
  currency: string;
  type: string;
  details: Record<string, unknown>;
  active: boolean;
}

export interface RecipientSummaryDto {
  id: string;
  affiliateProfileId: string;
  wiseRecipientId: string | null;
  accountHolderName: string;
  targetCurrency: string;
  recipientCountry: string;
  legalType: string;
  accountTail: string | null;
  status: string;
  createdAt: Date;
}

/**
 * Wise Webhook Types (Session 4A-W5, File 1/8)
 *
 * Per `part19.5-wise-disbursement-openapi.yaml`'s `WiseEventEnvelope` /
 * `WiseTransferStateChangeData` / `WisePayoutFailureData` schemas. `data`'s
 * exact shape depends on `event_type` — only the two Part 19.5 handles are
 * modelled; every other event type is persisted and skipped (never
 * rejected), so its `data` is typed loosely.
 */

export interface WiseTransferResource {
  type: string;
  id: number;
  profile_id?: number;
  account_id?: number;
}

/** Wise's documented transfer states (`02-...reference.md` §8) plus the
 * literal `'unknown'` state Wise itself sometimes sends. The union is not
 * exhaustive by design (design §5.1) — unrecognised strings fall through to
 * the mapper's default case rather than a type error. */
export type WiseTransferCurrentState =
  | 'incoming_payment_waiting'
  | 'incoming_payment_initiated'
  | 'processing'
  | 'funds_converted'
  | 'outgoing_payment_sent'
  | 'bounced_back'
  | 'funds_refunded'
  | 'charged_back'
  | 'cancelled'
  | 'unknown'
  | (string & {});

export interface WiseTransferStateChangeData {
  resource: WiseTransferResource;
  current_state: WiseTransferCurrentState;
  previous_state?: WiseTransferCurrentState | null;
  occurred_at: string;
}

export interface WisePayoutFailureData {
  transfer_id: number;
  profile_id?: number;
  failure_reason_code: string;
  failure_description?: string;
  occurred_at: string;
}

/** Wise does not publish a versioned schema for `balances#update` the way
 * it does for transfers — this is best-effort funding detection only
 * (design §6.2 step 6b), never the authoritative funding signal, so the
 * shape is typed loosely and every read is optional-chained. */
export interface WiseBalanceUpdateData {
  amount?: { value: number; currency: string };
  occurred_at?: string;
  [key: string]: unknown;
}

export interface WiseWebhookEnvelope {
  subscription_id?: string;
  event_type: string;
  schema_version: string;
  sent_at?: string;
  data:
    | WiseTransferStateChangeData
    | WisePayoutFailureData
    | WiseBalanceUpdateData
    | Record<string, unknown>;
}
