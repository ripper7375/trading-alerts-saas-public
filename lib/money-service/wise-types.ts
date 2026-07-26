// Frontend-side mirror of money-service's wise.types.ts (Session 4A-W3b) —
// the ACTUAL live shapes confirmed against wise-recipients.controller.ts /
// wise-recipient.service.ts at this session's CONFIRM, not the idealized
// OpenAPI prose. Keep in sync manually; money-service owns the source of
// truth (no shared package between the two services yet).

export interface WiseAccountRequirementFieldGroup {
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

export interface WiseAccountRequirementGroup {
  type: string;
  title: string;
  usageInfo?: string;
  fields: Array<{ group: WiseAccountRequirementFieldGroup[] }>;
}

export interface WiseRequirementsResponse {
  quoteId: string | null;
  groups: WiseAccountRequirementGroup[];
}

export type WiseRecipientStatus =
  | 'DRAFT'
  | 'PENDING_DETAILS'
  | 'ACTIVE'
  | 'INVALID'
  | 'ARCHIVED';

export interface WiseRecipientSummary {
  id: string;
  affiliateProfileId: string;
  wiseRecipientId: string | null;
  accountHolderName: string;
  targetCurrency: string;
  recipientCountry: string;
  legalType: string;
  accountTail: string | null;
  status: WiseRecipientStatus;
  createdAt: string;
}

export interface WiseRecipientsAdminList {
  items: WiseRecipientSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateWiseRecipientPayload {
  targetCurrency: string;
  recipientCountry: string;
  legalType: 'PRIVATE' | 'BUSINESS';
  accountHolderName: string;
  requirementsType: string;
  details: Record<string, unknown>;
}
