import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Trash2,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function DeletionConfirmPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [reason, setReason] = useState('switching_broker');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleInitiateDeletion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      toast.error('Please check the confirmation box');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.warning('Account scheduled for deletion in 7 days');
      navigate('/account/deletion-cancel');
    }, 900);
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(-1)}
          className="h-8 w-8 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-black text-foreground">
            Confirm Account Deletion
          </h1>
          <p className="text-xs text-muted-foreground">
            7-day grace period cancellation
          </p>
        </div>
      </div>

      <Card className="border-destructive/40 bg-destructive/5 shadow-xl">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/20 font-black text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Permanent Deletion Request
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Your alerts, AI chat history, and affiliate balances will be
                wiped.
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-destructive/30 bg-background/80 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-destructive">
              <Clock className="h-4 w-4" />
              <span>7-Day Security Grace Period</span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              To protect against unauthorized access, deletion will complete on{' '}
              <strong>August 26, 2026</strong>. You can cancel this request at
              any time before then simply by logging back in.
            </p>
          </div>

          <form onSubmit={handleInitiateDeletion} className="space-y-4 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Reason for Leaving
              </label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="switching_broker">
                    Switching Broker / Platform
                  </SelectItem>
                  <SelectItem value="temporary_break">
                    Taking a Trading Break
                  </SelectItem>
                  <SelectItem value="too_expensive">
                    Subscription Cost
                  </SelectItem>
                  <SelectItem value="not_needed">
                    No Longer Trading Margins
                  </SelectItem>
                  <SelectItem value="other">Other Reason</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-xs text-foreground/90">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-border"
                required
              />
              <span className="text-[11px] leading-snug">
                I understand that after 7 days, my account data, active alerts,
                and affiliate commissions cannot be recovered.
              </span>
            </label>

            <Button
              type="submit"
              disabled={loading || !confirmed}
              variant="destructive"
              className="mt-2 h-11 w-full gap-2 text-xs font-bold"
            >
              <Trash2 className="h-4 w-4" />
              <span>
                {loading
                  ? 'Scheduling Deletion...'
                  : 'Schedule 7-Day Account Deletion'}
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
