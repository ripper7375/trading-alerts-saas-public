'use client';

import { useLocale } from '@/lib/context/locale-context';

/**
 * Fresh authenticator code before a payout batch is executed (CODE-06B).
 *
 * Executing a batch moves real money, so the confirm dialog of both batch pages asks for a
 * current authenticator code. `requestPayoutStepUp` trades it for a 120-second token at
 * `/api/admin/payout-step-up`; the page sends that token to the execute route in
 * `X-Payout-Step-Up`, and money-service spends it (one token, one call). No token, no call.
 *
 * Admin pages need no translations; the words are `t(key, English)`.
 */

/** The header money-service reads the token from; the monolith's execute route forwards it. */
export const PAYOUT_STEP_UP_HEADER = 'X-Payout-Step-Up';

/** An authenticator (TOTP) code: six digits. Backup codes do not approve payouts. */
export function isStepUpCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

/**
 * Trades a current authenticator code for a payout step-up token. Throws an `Error` whose
 * message is the server's own words (wrong code, too many attempts, 2FA not set up).
 */
export async function requestPayoutStepUp(code: string): Promise<string> {
  const response = await fetch('/api/admin/payout-step-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    stepUpToken?: unknown;
    error?: unknown;
  };
  if (!response.ok || typeof data.stepUpToken !== 'string') {
    throw new Error(
      typeof data.error === 'string' && data.error
        ? data.error
        : 'Could not confirm your identity'
    );
  }
  return data.stepUpToken;
}

interface PayoutStepUpCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/** The code input inside the execute confirm dialog. */
export function PayoutStepUpCodeField({
  value,
  onChange,
}: PayoutStepUpCodeFieldProps): React.ReactElement {
  const { t } = useLocale();

  return (
    <div className="space-y-1">
      <label
        htmlFor="payout-step-up-code"
        className="text-sm font-medium text-foreground"
      >
        {t('admin.disbursement.step_up_code_label', 'Authenticator code')}
      </label>
      <input
        id="payout-step-up-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
        placeholder="123456"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
      />
      <p className="text-xs text-muted-foreground">
        {t(
          'admin.disbursement.step_up_code_help',
          'Enter the current 6-digit code from your authenticator app to confirm this payout.'
        )}
      </p>
    </div>
  );
}
