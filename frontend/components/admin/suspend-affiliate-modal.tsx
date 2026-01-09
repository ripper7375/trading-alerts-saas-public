'use client';

/**
 * Suspend Affiliate Modal Component
 *
 * Confirmation modal for suspending an affiliate.
 *
 * @module components/admin/suspend-affiliate-modal
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SuspendAffiliateModalProps {
  affiliateId: string;
  affiliateName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function SuspendAffiliateModal({
  affiliateName,
  isOpen,
  onClose,
  onConfirm,
}: SuspendAffiliateModalProps) {
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for suspension');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onConfirm(reason);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to suspend affiliate'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend Affiliate</DialogTitle>
          <DialogDescription>
            Are you sure you want to suspend {affiliateName}? This will prevent
            them from earning commissions and accessing the affiliate portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Suspension</Label>
            <Input
              id="reason"
              placeholder="e.g., Violation of terms"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Suspending...' : 'Suspend Affiliate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
