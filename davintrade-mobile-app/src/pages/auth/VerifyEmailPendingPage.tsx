import React, { useState } from 'react';
import { Mail, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function VerifyEmailPendingPage() {
  const [resending, setResending] = useState(false);

  const handleResend = () => {
    setResending(true);
    setTimeout(() => {
      setResending(false);
      toast.success('Verification email resent!');
    }, 1000);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/80 bg-card shadow-xl">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500">
            <Mail className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground">
              Verify Your Email
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              We sent a verification link to your inbox. Please click the link
              to activate your trading account.
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              disabled={resending}
              onClick={handleResend}
              className="w-full gap-2 text-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`}
              />
              <span>
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </span>
            </Button>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 pt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
