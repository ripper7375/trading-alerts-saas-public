'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Globe,
  Lock,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/lib/context/locale-context';

const COUNTRY_LABELS: Record<string, string> = {
  TH: 'Thailand',
  GB: 'United Kingdom',
  VN: 'Vietnam',
  IN: 'India',
  ID: 'Indonesia',
  PK: 'Pakistan',
  NG: 'Nigeria',
  ZA: 'South Africa',
  TR: 'Turkey',
  US: 'United States',
  JP: 'Japan',
};

const LOCAL_PAYMENT_METHODS: Record<string, string[]> = {
  TH: ['TrueMoney Wallet', 'Thai QR Payment', 'Bank Transfer'],
  IN: ['UPI', 'Paytm', 'PhonePe', 'Net Banking'],
  ID: ['GoPay', 'OVO', 'Dana'],
  NG: ['Bank Transfer', 'USSD', 'Paystack'],
  VN: ['MoMo', 'ZaloPay', 'Bank Transfer'],
  PK: ['JazzCash', 'EasyPaisa', 'Bank Transfer'],
  ZA: ['Instant EFT', 'Bank Transfer'],
  TR: ['Bank Transfer', 'Papara'],
  GB: ['Bank Transfer', 'Open Banking'],
  US: ['ACH Bank Transfer'],
  JP: ['Konbini', 'Bank Transfer'],
};

export default function CheckoutForm() {
  const router = useRouter();
  const { t, formatCurrency } = useLocale();

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'dlocal'>('card');
  const [country, setCountry] = useState('TH');
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const basePrice = 49.0;
  const discountAmount = discountApplied ? 10.0 : 0.0;
  const finalPrice = basePrice - discountAmount;

  const handleApplyDiscount = () => {
    if (
      discountCode.toLowerCase() === 'pro20' ||
      discountCode.toLowerCase() === 'davin10'
    ) {
      setDiscountApplied(true);
    }
  };

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      router.push('/');
    }, 1200);
  };

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 select-none md:grid-cols-3">
      {/* Payment Form (2 cols) */}
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl md:col-span-2 dark:border-slate-800/80 dark:bg-[#090c14]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800/80">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-slate-100">
              <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />{' '}
              {t('Secure Subscription Checkout')}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('Upgrade to DavinTrade PRO Tier Annual / Monthly Plan')}
            </p>
          </div>
          <Badge className="border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-700 dark:text-amber-300">
            256-BIT SSL
          </Badge>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Select Payment Method')}
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                paymentMethod === 'card'
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-700 shadow-sm dark:text-amber-300'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />{' '}
                {t('Credit / Debit Card')}
              </div>
              {paymentMethod === 'card' && (
                <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('dlocal')}
              className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                paymentMethod === 'dlocal'
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-700 shadow-sm dark:text-amber-300'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400" />{' '}
                {t('dLocal (LATAM / APAC)')}
              </div>
              {paymentMethod === 'dlocal' && (
                <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
            </button>
          </div>
        </div>

        {/* Billing Country Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Billing Country')}
          </Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="dark:border-slate-750 border-slate-200 bg-slate-50 text-xs text-slate-900 dark:bg-[#06080e] dark:text-slate-100">
              <SelectValue placeholder={t('Select country')} />
            </SelectTrigger>
            <SelectContent className="dark:border-slate-750 border-slate-200 bg-white text-xs text-slate-900 dark:bg-[#0f1420] dark:text-slate-100">
              <SelectItem value="TH">🇹🇭 {t('Thailand')}</SelectItem>
              <SelectItem value="GB">🇬🇧 {t('United Kingdom')}</SelectItem>
              <SelectItem value="VN">🇻🇳 {t('Vietnam')}</SelectItem>
              <SelectItem value="IN">🇮🇳 {t('India')}</SelectItem>
              <SelectItem value="ID">🇮🇩 {t('Indonesia')}</SelectItem>
              <SelectItem value="PK">🇵🇰 {t('Pakistan')}</SelectItem>
              <SelectItem value="NG">🇳🇬 {t('Nigeria')}</SelectItem>
              <SelectItem value="ZA">🇿🇦 {t('South Africa')}</SelectItem>
              <SelectItem value="TR">🇹🇷 {t('Turkey')}</SelectItem>
              <SelectItem value="US">🇺🇸 {t('United States')}</SelectItem>
              <SelectItem value="JP">🇯🇵 {t('Japan')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Card Details Form */}
        <form onSubmit={handleCheckout} className="space-y-4">
          {paymentMethod === 'card' ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('Card Number')}
                </Label>
                <Input
                  type="text"
                  required
                  placeholder="4532 •••• •••• 8892"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="dark:border-slate-750 border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 dark:bg-[#06080e] dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('Expiration Date')}
                  </Label>
                  <Input
                    type="text"
                    required
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="dark:border-slate-750 border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 dark:bg-[#06080e] dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('Security CVC')}
                  </Label>
                  <Input
                    type="text"
                    required
                    placeholder="123"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    className="dark:border-slate-750 border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 dark:bg-[#06080e] dark:text-slate-100"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                {t('Available local methods for')}{' '}
                {COUNTRY_LABELS[country] || country}
              </div>
              <ul className="space-y-1 pl-1 text-xs text-slate-600 dark:text-slate-400">
                {(
                  LOCAL_PAYMENT_METHODS[country] || [
                    'Local bank transfer & e-wallets',
                  ]
                ).map((method) => (
                  <li key={method} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {t(method)}
                  </li>
                ))}
              </ul>
              <p className="pt-1 text-[11px] text-slate-500">
                {t(
                  "You'll be redirected to dLocal's secure page to complete payment with your selected method."
                )}
              </p>
            </div>
          )}

          {/* Discount Code Input */}
          <div className="space-y-1.5 border-t border-slate-200 pt-2 dark:border-slate-800/80">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Promo / Discount Code')}
            </Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Try PRO20"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                className="dark:border-slate-750 border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 uppercase dark:bg-[#06080e] dark:text-slate-100"
              />
              <Button
                type="button"
                onClick={handleApplyDiscount}
                variant="outline"
                className="dark:border-slate-750 border-slate-200 bg-slate-100 px-4 text-xs text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                {t('Apply')}
              </Button>
            </div>
            {discountApplied && (
              <p className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> {t('Discount Applied')}:{' '}
                {discountCode.toUpperCase()}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
          >
            {isLoading
              ? t('Processing Payment...')
              : `${t('Complete Order & Unlock PRO')} (${formatCurrency(finalPrice)})`}
            {!isLoading && <ArrowRight className="ml-1.5 h-4 w-4" />}
          </Button>
        </form>
      </div>

      {/* Summary Card (1 col) */}
      <div className="space-y-4">
        <div className="space-y-4 rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-slate-100 p-5 shadow-2xl dark:from-[#0e121e] dark:to-[#080a10]">
          <h3 className="border-b border-amber-500/30 pb-2 text-xs font-bold tracking-wider text-amber-700 uppercase dark:text-amber-300">
            {t('ORDER SUMMARY')}
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
              <span>{t('DavinTrade PRO Subscription')}</span>
              <span className="font-mono">{formatCurrency(basePrice)}</span>
            </div>

            {discountApplied && (
              <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
                <span>{t('Promo Code Discount')}</span>
                <span className="font-mono">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{t('Billing Cycle')}</span>
              <span>{t('Monthly Recurring')}</span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
              <span>{t('Total Due Now')}</span>
              <span className="font-mono text-amber-700 dark:text-amber-300">
                {formatCurrency(finalPrice)}
              </span>
            </div>
          </div>

          <div className="space-y-1 pt-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            <p className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />{' '}
              {t('Cancel anytime from Settings')}
            </p>
            <p>{t('Instant activation upon payment processing.')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
