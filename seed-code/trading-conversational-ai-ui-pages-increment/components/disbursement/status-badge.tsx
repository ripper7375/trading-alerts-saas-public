'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared DavinTrade-styled status badges for the disbursement admin
// suite (batches, batch detail, transactions, audit, affiliates,
// recipients). Centralised so every page uses the same tone-to-colour
// mapping instead of each page inventing its own badge classes.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type BadgeTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'progress'
  | 'neutral';

const TONE_CLASS: Record<BadgeTone, string> = {
  success:
    'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  warning:
    'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  danger: 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300',
  info: 'border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300',
  progress:
    'border-purple-500/40 bg-purple-500/15 text-purple-700 dark:text-purple-300',
  neutral:
    'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600/40 dark:bg-slate-600/15 dark:text-slate-400',
};

export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: BadgeTone;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        'font-mono text-[10px] font-bold tracking-wide',
        TONE_CLASS[tone],
        className
      )}
    >
      {label}
    </Badge>
  );
}

// Payment batch lifecycle — mirrors Codebase 1's PaymentBatchStatus enum.
export type BatchStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

const BATCH_STATUS_TONE: Record<BatchStatus, BadgeTone> = {
  PENDING: 'warning',
  QUEUED: 'info',
  PROCESSING: 'progress',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

export function BatchStatusBadge({
  status,
  className,
}: {
  status: BatchStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={BATCH_STATUS_TONE[status]}
      label={status}
      className={className}
    />
  );
}

// Individual disbursement transaction lifecycle — mirrors Codebase 1's
// DisbursementTransactionStatus enum (no QUEUED state at the tx level).
export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

const TRANSACTION_STATUS_TONE: Record<TransactionStatus, BadgeTone> = {
  PENDING: 'warning',
  PROCESSING: 'progress',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

export function TransactionStatusBadge({
  status,
  className,
}: {
  status: TransactionStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={TRANSACTION_STATUS_TONE[status]}
      label={status}
      className={className}
    />
  );
}

export type AuditLogStatus = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'INFO';

const AUDIT_STATUS_TONE: Record<AuditLogStatus, BadgeTone> = {
  SUCCESS: 'success',
  FAILURE: 'danger',
  WARNING: 'warning',
  INFO: 'info',
};

export function AuditStatusBadge({
  status,
  className,
}: {
  status: AuditLogStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={AUDIT_STATUS_TONE[status]}
      label={status}
      className={className}
    />
  );
}

export type KycStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'SUBMITTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'NONE';

const KYC_STATUS_TONE: Record<KycStatus, BadgeTone> = {
  APPROVED: 'success',
  PENDING: 'warning',
  SUBMITTED: 'info',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
  NONE: 'neutral',
};

const KYC_STATUS_LABEL: Record<KycStatus, string> = {
  APPROVED: 'APPROVED',
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  NONE: 'NO ACCOUNT',
};

export function KycStatusBadge({
  status,
  className,
}: {
  status: KycStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={KYC_STATUS_TONE[status]}
      label={KYC_STATUS_LABEL[status]}
      className={className}
    />
  );
}

// Wise recipient verification status — mirrors Codebase 1's
// WiseRecipientStatus enum.
export type WiseRecipientStatus =
  | 'DRAFT'
  | 'PENDING_DETAILS'
  | 'ACTIVE'
  | 'INVALID'
  | 'ARCHIVED';

const WISE_RECIPIENT_STATUS_TONE: Record<WiseRecipientStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_DETAILS: 'warning',
  ACTIVE: 'success',
  INVALID: 'danger',
  ARCHIVED: 'neutral',
};

export function WiseRecipientStatusBadge({
  status,
  className,
}: {
  status: WiseRecipientStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={WISE_RECIPIENT_STATUS_TONE[status]}
      label={status.replace('_', ' ')}
      className={className}
    />
  );
}
