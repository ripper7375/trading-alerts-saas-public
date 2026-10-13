'use client';
import { useEffect, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function CheckoutFallback(): React.ReactElement {
  const { t } = useLocale();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
        <p className="text-muted-foreground">
          {t('checkout.loading_checkout', 'Loading checkout...')}
        </p>
      </div>
    </div>
  );
}

/** Shared existing sign-in and active-PRO boundaries for all checkout routes. */
export function CheckoutAccess({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const { t } = useLocale();
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const callbackUrl = `${pathname}${query ? `?${query}` : ''}`;
  useEffect(() => {
    if (status === 'unauthenticated')
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }, [status, router, callbackUrl]);
  if (status === 'loading') return <CheckoutFallback />;
  if (!session)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          {t('checkout.redirecting_login', 'Redirecting to login...')}
        </p>
      </div>
    );
  // Already PRO tier notification
  if (session.user.tier === 'PRO') {
    return (
      <div className="bg-muted/30 min-h-screen py-8">
        <div className="container mx-auto max-w-2xl px-4">
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('checkout.back_to_dashboard', 'Back to Dashboard')}
          </Link>

          <Card className="p-8 text-center shadow-lg">
            <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-primary">
              <CreditCard className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('checkout.already_pro_title', "You're Already a PRO Member")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              {t(
                'checkout.already_pro_desc',
                'Your account currently has active access to all PRO features, trading strategies, and real-time alerts.'
              )}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild variant="outline">
                <Link href="/settings/billing">
                  {t('checkout.manage_subscription', 'Manage Subscription')}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">
                  {t('checkout.go_to_dashboard', 'Go to Dashboard')}
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
