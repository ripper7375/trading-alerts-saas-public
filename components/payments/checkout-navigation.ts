'use client';
import { usePathname, useSearchParams } from 'next/navigation';

/** Preserve locale prefixes and checkout intent across provider navigation. */
export function useCheckoutHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const checkoutIndex = pathname.indexOf('/checkout');
  const prefix = checkoutIndex >= 0 ? pathname.slice(0, checkoutIndex) : '';
  return (
    route: '/checkout' | '/checkout/stripe' | '/checkout/dlocal',
    updates: Record<string, string | null> = {}
  ): string => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    return `${prefix}${route}${query ? `?${query}` : ''}`;
  };
}
