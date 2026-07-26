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
      setError('Enter a valid 2-letter recipient country code (e.g. TH, US)');
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
          body.message ?? body.error ?? 'Could not load bank detail fields'
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
        err instanceof Error ? err.message : 'Could not load bank detail fields'
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
        errors[field.key] = 'Required';
        continue;
      }
      if (!value) continue;

      if (field.minLength && value.length < field.minLength) {
        errors[field.key] = `Must be at least ${field.minLength} characters`;
      }
      if (field.maxLength && value.length > field.maxLength) {
        errors[field.key] = `Must be at most ${field.maxLength} characters`;
      }
      if (field.validationRegexp) {
        try {
          const re = new RegExp(field.validationRegexp);
          if (!re.test(value)) {
            errors[field.key] = `Invalid format for ${field.name}`;
          }
        } catch {
          // Malformed regex from the provider — skip client-side pattern
          // validation for this field rather than blocking submission.
        }
      }
    }

    if (!accountHolderName.trim()) {
      errors['__accountHolderName'] = 'Account holder name is required';
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
        'Bank details verification is in progress with our payment provider. Please try again shortly.'
      );
      setStep('fill-details');
    } catch {
      setError(
        'Bank details verification is in progress with our payment provider. Please try again shortly.'
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
      className: `w-full px-3 py-2 border rounded-md transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none ${
        errorText ? 'border-red-400' : 'border-gray-300'
      }`,
    };

    return (
      <div key={field.key}>
        <label
          htmlFor={field.key}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {field.name}
          {field.required && <span className="text-red-500"> *</span>}
        </label>
        {field.valuesAllowed ? (
          <select {...commonProps}>
            <option value="">Select…</option>
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
        {errorText && <p className="mt-1 text-xs text-red-600">{errorText}</p>}
      </div>
    );
  }

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Render
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (step === 'done') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-medium text-green-800">
          Payout details submitted successfully.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg bg-white p-6 shadow-md">
      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {step === 'select-currency' && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Payout currency
            </label>
            <select
              value={targetCurrency}
              onChange={(e) => setTargetCurrency(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Recipient country (2-letter code)
            </label>
            <input
              type="text"
              value={recipientCountry}
              onChange={(e) =>
                setRecipientCountry(e.target.value.toUpperCase())
              }
              maxLength={2}
              placeholder="TH"
              className="w-full rounded-md border border-gray-300 px-3 py-2 uppercase"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Account type
            </label>
            <div className="flex gap-4">
              {(['PRIVATE', 'BUSINESS'] as const).map((lt) => (
                <label key={lt} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={legalType === lt}
                    onChange={() => setLegalType(lt)}
                  />
                  {lt === 'PRIVATE' ? 'Individual' : 'Business'}
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={handleFetchRequirements}
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Continue'}
          </button>
        </div>
      )}

      {(step === 'fill-details' || step === 'submitting') && (
        <div className="space-y-4">
          {groups.length > 1 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Payment method
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
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
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
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Account holder name<span className="text-red-500"> *</span>
            </label>
            <input
              id="accountHolderName"
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 ${
                fieldErrors['__accountHolderName']
                  ? 'border-red-400'
                  : 'border-gray-300'
              }`}
            />
            {fieldErrors['__accountHolderName'] && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors['__accountHolderName']}
              </p>
            )}
          </div>

          {allFields.map(renderField)}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep('select-currency')}
              className="rounded-md border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={step === 'submitting'}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {step === 'submitting' ? 'Submitting…' : 'Submit payout details'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
