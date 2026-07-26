/**
 * Provider Capability Interfaces (Session 4A-W6, File 1/8)
 *
 * Additive capability interfaces per `01-part-19.5-wise-disbursement-architecture-design.md`
 * §3.3 — reproduced verbatim from that section (ground truth), NOT from this
 * order's own paraphrase (`LESSONS-LEARNED.md` L27: this order's own File 1
 * prose described a different, incorrect shape — `isFundable: boolean` plus
 * `getPayInDetails()`/`markFunded()` — that does not match the frozen design).
 *
 * `base-provider.ts` (174 lines, Hard Invariant #3) stays byte-identical:
 * widening the abstract `PaymentProvider` class to add batch/funding members
 * would force `MockPaymentProvider` and the archived Rise provider to
 * implement them too (design §3.2, rejected). Instead, `WisePaymentProvider`
 * additionally implements `FundableProvider`, and `isFundable()` narrows a
 * plain `PaymentProvider` reference to the richer type via a structural
 * (duck-typed) check — no `instanceof`, no provider-name string comparison.
 */

import type { PaymentProvider } from '../../disbursement/providers/base-provider';
import type { AccountRequirementGroup } from '../wise.types';

/** Funding capability mode (design §2). `API` is designed but not built in
 * Phase 1 — `fundBatchFromBalance` always throws `CapabilityUnavailableError`
 * under `MANUAL` (F37, Thailand region gate). */
export type FundingMode = 'MANUAL' | 'API';

export interface PreparedTransferFailure {
  commissionId: string;
  affiliateProfileId: string;
  reason: string;
}

export interface PreparedTransfer {
  commissionId: string;
  affiliateProfileId: string;
  providerTransferId: string; // Wise transfer id (numeric, stringified)
  providerQuoteId: string; // Wise quote UUID
  providerRecipientId: string; // Wise recipient/account id
  idempotencyKey: string; // customerTransactionId (UUID v4)
  sourceCurrency: string;
  sourceValue: number;
  targetCurrency: string;
  targetValue: number;
  rate: number;
  fee: number;
  reference: string;
}

export interface PreparedBatch {
  providerBatchId: string; // Wise batch-group UUID
  providerBatchVersion: number; // Wise optimistic-concurrency version
  transfers: PreparedTransfer[];
  sourceCurrency: string;
  totalSourceAmount: number;
  failures: PreparedTransferFailure[]; // per-affiliate, non-fatal
}

export interface PrepareBatchItem {
  commissionId: string;
  affiliateProfileId: string;
  /** Commission amount the affiliate is owed, in USD. */
  amount: number;
}

export interface PrepareBatchInput {
  /** Local `PaymentBatch.id` — correlates to `WiseBatchGroup.paymentBatchId`. */
  paymentBatchId: string;
  /** Wise batch-group "name" — the PaymentBatch's own batchNumber, <=100 chars. */
  batchName: string;
  sourceCurrency: string;
  items: PrepareBatchItem[];
}

export interface PayInInstruction {
  // mirrors Wise payInDetails[]
  type: 'bank_transfer';
  reference: string; // opaque — never parsed
  amount: number;
  currency: string;
  accountHolderName: string;
  accountNumber?: string | null;
  iban?: string | null;
  bankCode?: string | null;
  raw: Record<string, unknown>; // full Wise object, stored verbatim
}

export interface FundableProvider {
  readonly fundingMode: FundingMode;
  /** quote+recipient+transfer for every request, inside one provider batch. Money does NOT move. */
  prepareBatch(input: PrepareBatchInput): Promise<PreparedBatch>;
  /** close the provider batch to further changes; returns pay-in instructions. Money does NOT move. */
  completeBatch(providerBatchId: string): Promise<PayInInstruction[]>;
  /** MOVE MONEY. Throws CapabilityUnavailableError when fundingMode === 'MANUAL'. */
  fundBatchFromBalance(providerBatchId: string): Promise<void>;
  /** cancel a not-yet-funded provider batch */
  cancelBatch(providerBatchId: string, version: number): Promise<void>;
}

export interface AccountRequirementsInput {
  sourceCurrency: string;
  targetCurrency: string;
  quoteId?: string;
}

export interface CreateRecipientInput {
  currency: string;
  type: string;
  accountHolderName: string;
  details: Record<string, unknown>;
}

export interface ProviderRecipient {
  providerRecipientId: string;
  accountHolderName: string;
  currency: string;
  active: boolean;
}

/** Recipient capability — providers that need a stored payee account object. */
export interface RecipientAwareProvider {
  getAccountRequirements(
    input: AccountRequirementsInput
  ): Promise<AccountRequirementGroup[]>;
  createRecipient(input: CreateRecipientInput): Promise<ProviderRecipient>;
  getRecipient(providerRecipientId: string): Promise<ProviderRecipient>;
  deactivateRecipient(providerRecipientId: string): Promise<void>;
}

export class CapabilityUnavailableError extends Error {
  constructor(
    message: string,
    public readonly capability: string
  ) {
    super(message);
    this.name = 'CapabilityUnavailableError';
  }
}

/**
 * Structural narrowing, per design §3.3: a provider is fundable if it has a
 * `prepareBatch` method, not by checking a boolean flag or provider name.
 */
export function isFundable(
  p: PaymentProvider
): p is PaymentProvider & FundableProvider {
  return typeof (p as Partial<FundableProvider>).prepareBatch === 'function';
}
