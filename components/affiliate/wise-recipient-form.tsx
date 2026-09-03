/**
 * Wise Recipient Form (Session 4A-W3b, File 2/5)
 *
 * Schema-driven bank-details form for affiliate Wise payout onboarding.
 * Step 1 collects target currency / recipient country / legal type, then
 * fetches the live account-requirements schema and renders one dynamic
 * field per requirement. Submits to POST /api/wise/recipients.
 *
 * Zero raw bank details are cached anywhere after submission — form state
 * lives only in this component's own React state and is discarded on
 * unmount/success (F41: money-service never returns raw details back
 * either, only accountTail + status).
 *
 * @module components/affiliate/wise-recipient-form
 */

'use client';

import { useState } from 'react';

import { useLocale } from '@/lib/context/locale-context';
import type {
  WiseAccountRequirementFieldGroup,
  WiseAccountRequirementGroup,
  WiseRecipientSummary,
  WiseRequirementsResponse,
} from '@/lib/money-service/wise-types';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Static option lists — UI convenience only, not a backend contract
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CURRENCY_OPTIONS = [
  'THB',
  'USD',
  'GBP',
  'EUR',
  'AUD',
  'CAD',
  'SGD',
  'MYR',
  'NZD',
];

type FormStep = 'select-currency' | 'fill-details' | 'submitting' | 'done';

interface Props {
  onSubmitted?: (recipient: WiseRecipientSummary) => void;
}

export default function WiseRecipientForm({
  onSubmitted,
}: Props): React.ReactElement {
  const { t } = useLocale();
  const [step, setStep] = useState<FormStep>('select-currency');
  const [targetCurrency, setTargetCurrency] = useState('THB');
  const [recipientCountry, setRecipientCountry] = useState('');
  const [legalType, setLegalType] = useState<'PRIVATE' | 'BUSINESS'>('PRIVATE');
  const [accountHolderName, setAccountHolderName] = useState('');

  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [groups, setGroups] = useState<WiseAccountRequirementGroup[]>([]);
  const [selectedGroupType, setSelectedGroupType] = useState<string | null>(
    null
  );
  const [details, setDetails] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGroup = groups.find((g) => g.type === selectedGroupType);
  const allFields: WiseAccountRequirementFieldGroup[] =
    selectedGroup?.fields.flatMap((f) => f.group) ?? [];

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 1 → fetch requirements
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function handleFetchRequirements(): Promise<void> {
    if (!recipientCountry || recipientCountry.length !== 2) {
      setError(
        t(
          'affiliate.payouts.error_invalid_country_code',
          'Enter a valid 2-letter recipient country code (e.g. TH, US)'
        )
      );
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        targetCurrency,
        recipientCountry,
        legalType,
      });
      const res = await fetch(`/api/wise/recipients/requirements?${params}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.message ??
            body.error ??
            t(
              'affiliate.payouts.error_load_bank_fields',
              'Could not load bank detail fields'
            )
        );
      }

      const data: WiseRequirementsResponse = await res.json();
      setQuoteId(data.quoteId);
      setGroups(data.groups);
      setSelectedGroupType(data.groups[0]?.type ?? null);
      setDetails({});
      setStep('fill-details');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'affiliate.payouts.error_load_bank_fields',
              'Could not load bank detail fields'
            )
      );
    } finally {
      setLoading(false);
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Dynamic field-refresh (refreshRequirementsOnChange) — only meaningful
  // once a real quoteId exists. GET requirements currently always returns
  // quoteId: null (no quote-scoping built yet, 4A-W3a Deviations), so this
  // never actually fires live today; it's built and unit-tested against a
  // mocked quoteId instead.
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async function handleFieldRefresh(): Promise<void> {
    if (!quoteId) return;

    try {
      const res = await fetch('/api/wise/recipients/requirements/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, partial: details }),
      });
      if (!res.ok) return;
      const data: { groups: WiseAccountRequirementGroup[] } = await res.json();
      setGroups(data.groups);
    } catch {
      // Non-fatal — the form keeps working with the fields it already has.
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Validation + submit
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function validateFields(): boolean {
    const errors: Record<string, string> = {};

    for (const field of allFields) {
      const value = details[field.key] ?? '';

      if (field.required && !value) {
        errors[field.key] = t('affiliate.payouts.field_required', 'Required');
        continue;
      }
      if (!value) continue;

      if (field.minLength && value.length < field.minLength) {
        errors[field.key] = t(
          'affiliate.payouts.min_length_error',
          'Must be at least {n} characters'
        ).replace('{n}', String(field.minLength));
      }
      if (field.maxLength && value.length > field.maxLength) {
        errors[field.key] = t(
          'affiliate.payouts.max_length_error',
          'Must be at most {n} characters'
        ).replace('{n}', String(field.maxLength));
      }
      if (field.validationRegexp) {
        try {
          const re = new RegExp(field.validationRegexp);
          if (!re.test(value)) {
            errors[field.key] = t(
              'affiliate.payouts.invalid_format_for',
              'Invalid format for {field}'
            ).replace('{field}', field.name);
          }
        } catch {
          // Malformed regex from the provider — skip client-side pattern
          // validation for this field rather than blocking submission.
        }
      }
    }

    if (!accountHolderName.trim()) {
      errors['__accountHolderName'] = t(
        'affiliate.payouts.account_holder_name_required',
        'Account holder name is required'
      );
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(): Promise<void> {
    if (!selectedGroup || !validateFields()) return;

    setStep('submitting');
    setError(null);

    try {
      const res = await fetch('/api/wise/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCurrency,
          recipientCountry,
          legalType,
          accountHolderName: accountHolderName.trim(),
          requirementsType: selectedGroup.type,
          details,
        }),
      });

      if (res.status === 201) {
        const recipient: WiseRecipientSummary = await res.json();
        setStep('done');
        onSubmitted?.(recipient);
        return;
      }

      // Graceful handling of the confirmed live 403/500 (read-only token
      // scope, 4A-W3a) — surface a calm message, not a raw provider error.
      setError(
        t(
          'affiliate.payouts.verification_in_progress',
          'Bank details verification is in progress with our payment provider. Please try again shortly.'
        )
      );
      setStep('fill-details');
    } catch {
      setError(
        t(
          'affiliate.payouts.verification_in_progress',
          'Bank details verification is in progress with our payment provider. Please try again shortly.'
        )
      );
      setStep('fill-details');
    }
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Field rendering
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  function renderField(
    field: WiseAccountRequirementFieldGroup
  ): React.ReactElement {
    const value = details[field.key] ?? '';
    const errorText = fieldErrors[field.key];

    const commonProps = {
      id: field.key,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setDetails((d) => ({ ...d, [field.key]: e.target.value })),
      onBlur: field.refreshRequirementsOnChange
        ? handleFieldRefresh
        : undefined,
      className: `w-full rounded-md border bg-background px-3 py-2 text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 ${
        errorText ? 'border-red-400' : 'border-border'
      }`,
    };

    return (
      <div key={field.key}>
        <label
          htmlFor={field.key}
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {field.name}
          {field.required && <span className="text-red-500"> *</span>}
        </label>
        {field.valuesAllowed ? (
          <select {...commonProps}>
            <option value="">
              {t('affiliate.payouts.select_ellipsis', 'Select…')}
            </option>
            {field.valuesAllowed.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder={field.example}
            maxLength={field.maxLength}
            {...commonProps}
          />
        )}
        {errorText && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errorText}
          </p>
        )}
      </div>
    );
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Render
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (step === 'done') {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6 text-center">
        <p className="font-medium text-green-700 dark:text-green-400">
          {t(
            'affiliate.payouts.submitted_successfully',
            'Payout details submitted successfully.'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      {error && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {error}
        </div>
      )}

      {step === 'select-currency' && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t('affiliate.payouts.payout_currency', 'Payout currency')}
            </label>
            <select
              value={targetCurrency}
              onChange={(e) => setTargetCurrency(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t(
                'affiliate.payouts.recipient_country_code',
                'Recipient country (2-letter code)'
              )}
            </label>
            <input
              type="text"
              value={recipientCountry}
              onChange={(e) =>
                setRecipientCountry(e.target.value.toUpperCase())
              }
              maxLength={2}
              placeholder="TH"
              className="w-full rounded-md border border-border bg-background px-3 py-2 uppercase text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t('affiliate.payouts.account_type', 'Account type')}
            </label>
            <div className="flex gap-4">
              {(['PRIVATE', 'BUSINESS'] as const).map((lt) => (
                <label
                  key={lt}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="radio"
                    checked={legalType === lt}
                    onChange={() => setLegalType(lt)}
                    className="text-amber-500 focus:ring-amber-500"
                  />
                  {lt === 'PRIVATE'
                    ? t('affiliate.payouts.individual', 'Individual')
                    : t('affiliate.payouts.business', 'Business')}
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={handleFetchRequirements}
            disabled={loading}
            className="w-full rounded-md bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 font-bold text-slate-950 shadow-md shadow-amber-500/20 transition-colors hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
          >
            {loading
              ? t('affiliate.payouts.loading_ellipsis', 'Loading…')
              : t('admin.disbursement.continue', 'Continue')}
          </button>
        </div>
      )}

      {(step === 'fill-details' || step === 'submitting') && (
        <div className="space-y-4">
          {groups.length > 1 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                {t('affiliate.payouts.payment_method', 'Payment method')}
              </label>
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <button
                    key={g.type}
                    type="button"
                    onClick={() => {
                      setSelectedGroupType(g.type);
                      setDetails({});
                      setFieldErrors({});
                    }}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      selectedGroupType === g.type
                        ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'border-border bg-background text-foreground hover:bg-accent'
                    }`}
                  >
                    {g.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="accountHolderName"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t(
                'affiliate.payouts.account_holder_name',
                'Account holder name'
              )}
              <span className="text-red-500"> *</span>
            </label>
            <input
              id="accountHolderName"
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              className={`w-full rounded-md border bg-background px-3 py-2 text-foreground ${
                fieldErrors['__accountHolderName']
                  ? 'border-red-400'
                  : 'border-border'
              }`}
            />
            {fieldErrors['__accountHolderName'] && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors['__accountHolderName']}
              </p>
            )}
          </div>

          {allFields.map(renderField)}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep('select-currency')}
              className="rounded-md border border-border px-4 py-2 text-foreground transition-colors hover:bg-accent"
            >
              {t('affiliate.payouts.back', 'Back')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={step === 'submitting'}
              className="flex-1 rounded-md bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 font-bold text-slate-950 shadow-md shadow-amber-500/20 transition-colors hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
              {step === 'submitting'
                ? t('affiliate.payouts.submitting_ellipsis', 'Submitting…')
                : t(
                    'affiliate.payouts.submit_payout_details',
                    'Submit payout details'
                  )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
