import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Lock,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Check,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { switchRole } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<
    'card' | 'dlocal' | 'crypto'
  >('card');
  const [loading, setLoading] = useState(false);

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      switchRole('PT'); // Upgrade role to Pro
      navigate('/upgrade/success');
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
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
            Complete Checkout
          </h1>
          <p className="text-xs text-muted-foreground">
            DavinTrade PRO Analyst Subscription
          </p>
        </div>
      </div>

      {/* Order Summary Card */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-foreground">
                PRO Monthly Plan
              </span>
              <Badge variant="pro" className="px-1.5 py-0 text-[9px]">
                PRO
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Includes 15 Symbols, 9 TFs & AI Analyst
            </span>
          </div>
          <div className="text-right">
            <span className="text-lg font-black text-foreground">$29.00</span>
            <span className="block text-[10px] text-muted-foreground">
              / month
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Gateway Picker */}
      <div className="space-y-2">
        <label className="px-1 text-xs font-semibold text-foreground">
          Payment Method
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod('card')}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-bold transition-all ${
              paymentMethod === 'card'
                ? 'border-amber-500 bg-amber-500/15 text-amber-500 shadow-sm'
                : 'border-border/60 bg-card/60 text-muted-foreground'
            }`}
          >
            <CreditCard className="h-5 w-5" />
            <span>Card / Apple Pay</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('dlocal')}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-bold transition-all ${
              paymentMethod === 'dlocal'
                ? 'border-amber-500 bg-amber-500/15 text-amber-500 shadow-sm'
                : 'border-border/60 bg-card/60 text-muted-foreground'
            }`}
          >
            <Globe className="h-5 w-5 text-blue-400" />
            <span>dLocal (UPI/Pix)</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('crypto')}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-bold transition-all ${
              paymentMethod === 'crypto'
                ? 'border-amber-500 bg-amber-500/15 text-amber-500 shadow-sm'
                : 'border-border/60 bg-card/60 text-muted-foreground'
            }`}
          >
            <Zap className="h-5 w-5 text-emerald-400" />
            <span>USDT TRC20</span>
          </button>
        </div>
      </div>

      {/* Payment Form Sheet */}
      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="p-5">
          <form onSubmit={handlePay} className="space-y-4">
            {paymentMethod === 'card' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Card Number
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="4242 •••• •••• 4242"
                      className="pl-10 font-mono text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Expiry
                    </label>
                    <Input
                      type="text"
                      placeholder="MM/YY"
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      CVC
                    </label>
                    <Input
                      type="password"
                      maxLength={4}
                      placeholder="123"
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {paymentMethod === 'dlocal' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Select your country to pay via local bank transfer, UPI
                  (India), Pix (Brazil), OXXO (Mexico), or local wallet.
                </p>
                <Input
                  placeholder="Select Country (e.g. India, Brazil, Indonesia)"
                  className="text-xs"
                />
              </div>
            )}

            {paymentMethod === 'crypto' && (
              <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/40 p-3 text-center">
                <p className="text-xs font-bold text-foreground">
                  Pay 29 USDT via TRC20
                </p>
                <p className="break-all rounded-lg bg-background p-2 font-mono text-[10px] text-muted-foreground">
                  TXYZ999DavinTradeOfficialPaymentAddress
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full bg-gradient-to-r from-amber-500 to-amber-600 font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500"
            >
              <Lock className="mr-2 h-4 w-4 fill-slate-950" />
              <span>
                {loading ? 'Processing Payment...' : 'Subscribe Now • $29.00'}
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <span>256-Bit Encrypted Secure SSL Checkout</span>
      </div>
    </div>
  );
}
