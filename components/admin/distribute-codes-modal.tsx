'use client';

/**
 * Distribute Codes Modal Component
 *
 * Modal for distributing additional codes to an affiliate.
 *
 * @module components/admin/distribute-codes-modal
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

interface DistributeCodesModalProps {
  affiliateId: string;
  affiliateName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (count: number, reason: string) => Promise<void>;
}

export function DistributeCodesModal({
  affiliateName,
  isOpen,
  onClose,
  onConfirm,
}: DistributeCodesModalProps) {
  const [count, setCount] = useState(15);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (count < 1 || count > 100) {
      setError('Count must be between 1 and 100');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onConfirm(count, reason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to distribute codes');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Distribute Codes</DialogTitle>
          <DialogDescription>
            Distribute additional affiliate codes to {affiliateName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="count">Number of Codes</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="e.g., Bonus for good performance"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
            {isLoading ? 'Distributing...' : `Distribute ${count} Codes`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
