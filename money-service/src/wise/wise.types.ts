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
