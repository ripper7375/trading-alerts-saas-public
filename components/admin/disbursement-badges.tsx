'use client';

import { Badge } from '@/components/ui/badge';
import type {
  PaymentBatchStatus,
  DisbursementTransactionStatus,
  RiseWorksKycStatus,
} from '@/types/disbursement';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAYMENT BATCH STATUS BADGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const batchStatusConfig: Record<
  PaymentBatchStatus,
  { className: string; label: string }
> = {
  PENDING: { className: 'bg-yellow-600', label: 'Pending' },
  QUEUED: { className: 'bg-blue-600', label: 'Queued' },
  PROCESSING: { className: 'bg-purple-600', label: 'Processing' },
  COMPLETED: { className: 'bg-green-600', label: 'Completed' },
  FAILED: { className: 'bg-red-600', label: 'Failed' },
  CANCELLED: { className: 'bg-gray-600', label: 'Cancelled' },
};

export function BatchStatusBadge({
  status,
}: {
  status: PaymentBatchStatus;
}): React.ReactElement {
  const config = batchStatusConfig[status];

  return (
    <Badge className={`${config.className} text-white text-xs`}>
      {config.label}
    </Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRANSACTION STATUS BADGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const transactionStatusConfig: Record<
  DisbursementTransactionStatus,
  { className: string; label: string }
> = {
  PENDING: { className: 'bg-yellow-600', label: 'Pending' },
  PROCESSING: { className: 'bg-blue-600', label: 'Processing' },
  COMPLETED: { className: 'bg-green-600', label: 'Completed' },
  FAILED: { className: 'bg-red-600', label: 'Failed' },
  CANCELLED: { className: 'bg-gray-600', label: 'Cancelled' },
};

export function TransactionStatusBadge({
  status,
}: {
  status: DisbursementTransactionStatus;
}): React.ReactElement {
  const config = transactionStatusConfig[status];

  return (
    <Badge className={`${config.className} text-white text-xs`}>
      {config.label}
    </Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KYC STATUS BADGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const kycStatusConfig: Record<string, { className: string; label: string }> = {
  APPROVED: { className: 'bg-green-600', label: 'Approved' },
  PENDING: { className: 'bg-yellow-600', label: 'Pending' },
  SUBMITTED: { className: 'bg-blue-600', label: 'Submitted' },
  REJECTED: { className: 'bg-red-600', label: 'Rejected' },
  EXPIRED: { className: 'bg-gray-600', label: 'Expired' },
  none: { className: 'bg-gray-600', label: 'No Account' },
};

const defaultKycConfig = { className: 'bg-gray-600', label: 'No Account' };

export function KycStatusBadge({
  status,
}: {
  status: RiseWorksKycStatus | 'none';
}): React.ReactElement {
  const config = kycStatusConfig[status] ?? defaultKycConfig;

  return (
    <Badge className={`${config.className} text-white text-xs`}>
      {config.label}
    </Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROVIDER BADGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ProviderBadge({
  provider,
}: {
  provider: string;
}): React.ReactElement {
  return (
    <Badge className="bg-gray-600 text-white text-xs">{provider}</Badge>
  );
}
