import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSent(true);
    toast.success('Password reset link sent to your email');
  };

  return (
    <div className="flex flex-1 flex-col justify-center p-4">
      <div className="mx-auto w-full max-w-sm space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Reset Password
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter your email to receive a password recovery link.
          </p>
        </div>

        <Card className="border-border/80 bg-card shadow-xl">
          <CardContent className="p-5">
            {sent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Check Your Email
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We have dispatched a secure recovery link to{' '}
                    <span className="font-semibold text-foreground">
                      {email}
                    </span>
                    .
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSent(false)}
                  className="w-full text-xs"
                >
                  Resend Link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Account Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="trader@example.com"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/25 hover:bg-amber-400"
                >
                  <Send className="mr-2 h-4 w-4" />
                  <span>Send Reset Link</span>
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
