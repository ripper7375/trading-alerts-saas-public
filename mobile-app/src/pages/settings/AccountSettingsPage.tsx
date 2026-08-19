import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Trash2, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-4 p-4">
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
            Account Management
          </h1>
          <p className="text-xs text-muted-foreground">
            Deactivation & deletion options
          </p>
        </div>
      </div>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>Danger Zone</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Deactivating your account pauses all active price alerts. You can
            also permanently initiate a 7-day account deletion.
          </p>

          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              onClick={() =>
                toast.info('All alerts paused. Account deactivated.')
              }
              className="w-full gap-2 border-border/80 text-xs font-semibold"
            >
              <Power className="h-4 w-4" />
              <span>Deactivate Account & Pause Alerts</span>
            </Button>

            <Button
              variant="destructive"
              onClick={() => navigate('/account/deletion-confirm')}
              className="w-full gap-2 text-xs font-bold"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Account (7-Day Grace Period)</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
