'use client';

/**
 * AlertDialog — configures a line-touch alert on a selected drawing.
 *
 * The available target levels come from the selected mark's `alertLevels()`
 * (shared geometry), so the dropdown always matches what the server validates.
 *
 * @module components/charts/drawing/AlertDialog
 */

import { useEffect, useState, type JSX } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export interface LineAlertValues {
  targetLevel: string;
  direction: 'cross_up' | 'cross_down' | 'either';
  tolerance: number;
  cooldownSec: number;
  oneShot: boolean;
  name?: string;
}

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: { id: string; label: string }[];
  submitting?: boolean;
  error?: string | null;
  onSubmit: (values: LineAlertValues) => void;
}

export function AlertDialog({
  open,
  onOpenChange,
  levels,
  submitting = false,
  error,
  onSubmit,
}: AlertDialogProps): JSX.Element {
  const [targetLevel, setTargetLevel] = useState('');
  const [direction, setDirection] =
    useState<LineAlertValues['direction']>('either');
  const [tolerance, setTolerance] = useState('0');
  const [cooldownSec, setCooldownSec] = useState('60');
  const [oneShot, setOneShot] = useState(false);
  const [name, setName] = useState('');

  // Default the target level whenever the dialog (re)opens with new levels.
  useEffect(() => {
    if (open && levels.length > 0) {
      setTargetLevel((prev) =>
        levels.some((l) => l.id === prev) ? prev : (levels[0]?.id ?? '')
      );
    }
  }, [open, levels]);

  const handleSubmit = (): void => {
    onSubmit({
      targetLevel,
      direction,
      tolerance: Number(tolerance) || 0,
      cooldownSec: Math.max(0, Math.floor(Number(cooldownSec) || 0)),
      oneShot,
      name: name.trim() ? name.trim() : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add price alert</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="alert-level">Target level</Label>
            <Select value={targetLevel} onValueChange={setTargetLevel}>
              <SelectTrigger id="alert-level">
                <SelectValue placeholder="Select a level" />
              </SelectTrigger>
              <SelectContent>
                {levels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-direction">Direction</Label>
            <Select
              value={direction}
              onValueChange={(v) =>
                setDirection(v as LineAlertValues['direction'])
              }
            >
              <SelectTrigger id="alert-direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="either">Cross either way</SelectItem>
                <SelectItem value="cross_up">Cross up</SelectItem>
                <SelectItem value="cross_down">Cross down</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="alert-tolerance">Tolerance (price)</Label>
              <Input
                id="alert-tolerance"
                type="number"
                min={0}
                step="any"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-cooldown">Cooldown (sec)</Label>
              <Input
                id="alert-cooldown"
                type="number"
                min={0}
                value={cooldownSec}
                onChange={(e) => setCooldownSec(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-name">Name (optional)</Label>
            <Input
              id="alert-name"
              value={name}
              maxLength={120}
              placeholder="e.g. XAUUSD support break"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="alert-oneshot">Fire once, then disable</Label>
            <Switch
              id="alert-oneshot"
              checked={oneShot}
              onCheckedChange={setOneShot}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !targetLevel}>
            {submitting ? 'Creating…' : 'Create alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
