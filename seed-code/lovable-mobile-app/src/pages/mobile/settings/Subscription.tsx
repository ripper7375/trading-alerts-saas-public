import {
  ArrowLeft,
  Check,
  Crown,
  Zap,
  Star,
  Shield,
  TrendingUp,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CountrySelector } from '@/components/payments/CountrySelector';
import { PaymentMethodSelector } from '@/components/payments/PaymentMethodSelector';
import { PriceDisplay } from '@/components/payments/PriceDisplay';
import { InvoiceList, type Invoice } from '@/components/billing/InvoiceList';
import { getCurrency } from '@/lib/dlocal/constants';
import type { DLocalCountry } from '@/types/dlocal';

// Reference-only mock billing history, illustrating the VAT/tax-invoicing
// stack's UI states: a standard EU-VAT invoice, a validated B2B
// reverse-charge invoice, and an untaxed US invoice (zero visual change).
const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv_1',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 29.0,
    status: 'paid',
    description: 'Pro plan — monthly',
    invoicePdfUrl: '#',
    hostedInvoiceUrl: '#',
    taxAmount: 5.51,
    taxRate: 0.19,
    taxCountry: 'DE',
    reverseCharge: false,
  },
  {
    id: 'inv_2',
    date: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 29.0,
    status: 'paid',
    description: 'Pro plan — monthly',
    invoicePdfUrl: null,
    hostedInvoiceUrl: '#',
    taxAmount: 0,
    taxRate: 0,
    taxCountry: 'FR',
    reverseCharge: true,
  },
  {
    id: 'inv_3',
    date: new Date(Date.now() - 63 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 29.0,
    status: 'paid',
    description: 'Pro plan — monthly',
    invoicePdfUrl: '#',
    hostedInvoiceUrl: '#',
    taxAmount: 0,
    taxRate: 0,
    taxCountry: 'US',
    reverseCharge: false,
  },
];

// Stripe product/price configuration
const SUBSCRIPTION_TIERS = {
  basic: {
    product_id: 'prod_TkpwryMzXgNwt0',
    price_id: 'price_1SnKGE55Obu9Ws2ALJ7EVUrm',
  },
  pro: {
    product_id: 'prod_TasWRnvzBDJyRO',
    price_id: 'price_1Sdgl355Obu9Ws2AJSDpYobS',
  },
  enterprise: {
    product_id: 'prod_TkpwnCgV0ufGIO',
    price_id: 'price_1SnKGa55Obu9Ws2Agjud74qj',
  },
};

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with basic features',
    features: [
      '5 watchlist items',
      'Basic alerts',
      'Daily market summary',
      'Community support',
    ],
    icon: Star,
    priceId: null,
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$9.99',
    period: 'month',
    description: 'Essential trading features',
    features: [
      '25 watchlist items',
      'Standard alerts',
      'Real-time price updates',
      'Email support',
      'No ads',
    ],
    icon: Zap,
    priceId: SUBSCRIPTION_TIERS.basic.price_id,
    productId: SUBSCRIPTION_TIERS.basic.product_id,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: 'month',
    description: 'For active traders',
    features: [
      'Unlimited watchlist items',
      'Advanced alerts with conditions',
      '15 symbols x 9 timeframes',
      'Technical indicators',
      'Priority support',
    ],
    icon: Crown,
    popular: true,
    priceId: SUBSCRIPTION_TIERS.pro.price_id,
    productId: SUBSCRIPTION_TIERS.pro.product_id,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$49.99',
    period: 'month',
    description: 'For professional traders',
    features: [
      'Everything in Pro',
      'AI-powered insights',
      'Portfolio analytics',
      'API access',
      'Dedicated account manager',
    ],
    icon: Shield,
    priceId: SUBSCRIPTION_TIERS.enterprise.price_id,
    productId: SUBSCRIPTION_TIERS.enterprise.product_id,
  },
];

interface SubscriptionStatus {
  subscribed: boolean;
  product_id: string | null;
  price_id: string | null;
  subscription_end: string | null;
}

const Subscription = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string>('free');
  const [paymentRegion, setPaymentRegion] = useState<DLocalCountry | 'GLOBAL'>(
    'GLOBAL'
  );
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  const handleRegionChange = (region: DLocalCountry | 'GLOBAL') => {
    setPaymentRegion(region);
    setPaymentMethod(null);
  };

  const selectedPlanUsdPrice = useMemo(() => {
    const plan = plans.find((p) => p.id === selectedPlan);
    const parsed = plan ? Number(plan.price.replace('$', '')) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 29;
  }, [selectedPlan]);

  // Check for success/canceled URL params
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated successfully!');
      checkSubscriptionStatus();
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Subscription checkout was canceled');
    }
  }, [searchParams]);

  const checkSubscriptionStatus = async () => {
    setIsCheckingSubscription(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setCurrentPlanId('free');
        setIsCheckingSubscription(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        'check-subscription',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      setSubscriptionStatus(data);

      if (data.subscribed && data.product_id) {
        const matchedPlan = plans.find((p) => p.productId === data.product_id);
        if (matchedPlan) {
          setCurrentPlanId(matchedPlan.id);
          setSelectedPlan(matchedPlan.id);
        }
      } else {
        setCurrentPlanId('free');
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setIsCheckingSubscription(false);
    }
  };

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const handleUpgrade = async (planId: string, priceId: string | null) => {
    if (!priceId) {
      toast.info("You're on the Free plan");
      return;
    }

    // Reference-only local-payment path: this seed app's Supabase backend
    // only wires up Stripe, so a chosen dLocal country demonstrates the UI
    // flow (country -> payment method -> local-currency price) without a
    // real checkout call, mirroring the monolith's dLocal payment intent.
    if (paymentRegion !== 'GLOBAL') {
      if (!paymentMethod) {
        toast.error('Select a payment method to continue');
        return;
      }
      toast.info(
        `This is a reference build — real DavinTrade checkout would create a dLocal ${paymentMethod} payment in ${paymentRegion}.`
      );
      return;
    }

    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to upgrade your subscription');
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        'create-checkout',
        {
          body: { priceId },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to manage your subscription');
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        'customer-portal',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Failed to open subscription management. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentPlan = plans.find((p) => p.id === currentPlanId) || plans[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Subscription</h1>
        </div>
      </div>

      <div className="space-y-6 p-4">
        {/* Current Plan */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <currentPlan.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Current Plan</CardTitle>
              </div>
              <Badge variant="secondary">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isCheckingSubscription ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground">
                  Checking subscription...
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{currentPlan.name}</span>
                  <span className="text-muted-foreground">
                    {currentPlan.price}/{currentPlan.period}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentPlan.description}
                </p>
                {subscriptionStatus?.subscription_end && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Renews on{' '}
                    {new Date(
                      subscriptionStatus.subscription_end
                    ).toLocaleDateString()}
                  </p>
                )}
                {currentPlanId !== 'free' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={handleManageSubscription}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4" />
                    )}
                    Manage Subscription
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Usage This Month
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Watchlist
                  </span>
                </div>
                <p className="mt-1 text-xl font-semibold">
                  3/
                  {currentPlanId === 'free'
                    ? '5'
                    : currentPlanId === 'basic'
                      ? '25'
                      : '∞'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Alerts</span>
                </div>
                <p className="mt-1 text-xl font-semibold">
                  2/
                  {currentPlanId === 'free'
                    ? '3'
                    : currentPlanId === 'basic'
                      ? '10'
                      : '∞'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator />

        {/* Payment Region */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <CountrySelector
              value={paymentRegion}
              onChange={handleRegionChange}
            />

            {paymentRegion !== 'GLOBAL' && (
              <>
                <PaymentMethodSelector
                  country={paymentRegion}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                />
                <div className="rounded-lg bg-secondary/50 p-3">
                  <PriceDisplay
                    usdAmount={selectedPlanUsdPrice}
                    currency={getCurrency(paymentRegion)}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Available Plans */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Available Plans
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkSubscriptionStatus}
              disabled={isCheckingSubscription}
            >
              {isCheckingSubscription ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
          <div className="space-y-4">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const isCurrent = plan.id === currentPlanId;
              return (
                <Card
                  key={plan.id}
                  className={`relative cursor-pointer transition-all ${
                    selectedPlan === plan.id
                      ? 'border-primary ring-1 ring-primary'
                      : 'hover:border-primary/50'
                  } ${isCurrent ? 'border-green-500/50 bg-green-500/5' : ''}`}
                  onClick={() => !isCurrent && setSelectedPlan(plan.id)}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2 right-4 bg-primary">
                      Most Popular
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge className="absolute -top-2 left-4 bg-green-500">
                      Your Plan
                    </Badge>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{plan.name}</CardTitle>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold">{plan.price}</span>
                        <span className="text-sm text-muted-foreground">
                          /{plan.period}
                        </span>
                      </div>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {!isCurrent && plan.priceId && (
                      <Button
                        className="mt-4 w-full"
                        variant={plan.popular ? 'default' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpgrade(plan.id, plan.priceId);
                        }}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {currentPlanId === 'free'
                          ? `Upgrade to ${plan.name}`
                          : `Switch to ${plan.name}`}
                      </Button>
                    )}
                    {!isCurrent && !plan.priceId && (
                      <Button
                        className="mt-4 w-full"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManageSubscription();
                        }}
                        disabled={isLoading || currentPlanId === 'free'}
                      >
                        {currentPlanId === 'free'
                          ? 'Current Plan'
                          : 'Downgrade to Free'}
                      </Button>
                    )}
                    {isCurrent && (
                      <p className="mt-4 text-center text-sm font-medium text-green-600">
                        ✓ This is your current plan
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Billing Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing Information</CardTitle>
            <CardDescription>
              Manage your payment methods and billing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentPlanId !== 'free' ? (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleManageSubscription}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  Manage Billing
                </Button>

                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    Invoice History
                  </h3>
                  <InvoiceList invoices={MOCK_INVOICES} />
                </div>
              </>
            ) : (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Upgrade to a paid plan to manage billing
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Subscription;
