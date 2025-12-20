'use client';

/**
 * Pay Commission Modal Component
 *
 * Modal for processing commission payments to affiliates.
 *
 * @module components/admin/pay-commission-modal
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

interface PayCommissionModalProps {
  affiliateId: string;
  affiliateName: string;
  pendingAmount: number;
  paymentMethod: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number, reference: string) => Promise<void>;
}

export function PayCommissionModal({
  affiliateName,
  pendingAmount,
  paymentMethod,
  isOpen,
  onClose,
  onConfirm,
}: PayCommissionModalProps) {
  const [amount, setAmount] = useState(pendingAmount);
  const [reference, setReference] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (amount < 50) {
      setError('Minimum payment amount is $50');
      return;
    }
    if (amount > pendingAmount) {
      setError(`Cannot pay more than pending amount ($${pendingAmount.toFixed(2)})`);
      return;
    }
    if (!reference.trim()) {
      setError('Please provide a payment reference');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onConfirm(amount, reference);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay Commission</DialogTitle>
          <DialogDescription>
            Process commission payment for {affiliateName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span>Pending Commission:</span>
              <span className="font-medium">${pendingAmount.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span>Payment Method:</span>
              <span className="font-medium">{paymentMethod.replace('_', ' ')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <Input
              id="amount"
              type="number"
              min={50}
              max={pendingAmount}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Payment Reference</Label>
            <Input
              id="reference"
              placeholder="e.g., PayPal transaction ID"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
