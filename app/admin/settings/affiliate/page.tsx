'use client';

/**
 * Admin Affiliate Settings Page
 *
 * Allows admin to configure affiliate discount and commission percentages.
 * Changes are stored in SystemConfig and take effect immediately across
 * the entire SaaS platform.
 *
 * @module app/admin/settings/affiliate/page
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ConfigValue {
  value: number;
  updatedBy: string | null;
  updatedAt: string;
}

interface AffiliateSettings {
  discountPercent: ConfigValue;
  commissionPercent: ConfigValue;
  codesPerMonth: ConfigValue;
  basePrice: ConfigValue;
  threeDayPrice: ConfigValue;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AdminAffiliateSettingsPage(): React.ReactElement {
  const { t } = useLocale();
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [commissionPercent, setCommissionPercent] = useState<number>(20);
  const [codesPerMonth, setCodesPerMonth] = useState<number>(15);
  const [basePrice, setBasePrice] = useState<number>(29);
  const [threeDayPrice, setThreeDayPrice] = useState<number>(1.99);
  const [reason, setReason] = useState<string>('');

  // Fetch current settings
  const fetchSettings = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/settings/affiliate');

      if (!response.ok) {
        throw new Error(
          t('admin.affiliates.error_fetch_settings', 'Failed to fetch settings')
        );
      }

      const data: AffiliateSettings = await response.json();
      setSettings(data);

      // Initialize form with current values
      setDiscountPercent(data.discountPercent.value);
      setCommissionPercent(data.commissionPercent.value);
      setCodesPerMonth(data.codesPerMonth.value);
      setBasePrice(data.basePrice.value);
      setThreeDayPrice(data.threeDayPrice.value);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.affiliates.error_occurred', 'An error occurred')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save settings
  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/settings/affiliate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountPercent,
          commissionPercent,
          codesPerMonth,
          basePrice,
          threeDayPrice,
          reason: reason || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            t('admin.affiliates.error_save_settings', 'Failed to save settings')
        );
      }

      setSuccess(data.message);
      setReason('');

      // Refresh settings to get updated timestamps
      await fetchSettings();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.affiliates.error_occurred', 'An error occurred')
      );
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate example commission
  const exampleNetPrice = basePrice * (1 - discountPercent / 100);
  const exampleCommission = exampleNetPrice * (commissionPercent / 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/affiliates"
          className="text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          &larr;{' '}
          {t('admin.affiliates.back_to_affiliates_short', 'Back to Affiliates')}
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          {t('admin.affiliates.settings_title', 'Affiliate Settings')}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'admin.affiliates.settings_subtitle',
            'Configure discount and commission percentages for the affiliate program'
          )}
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-500">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-600 dark:text-emerald-400">
          {success}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Settings Form */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                {t('admin.affiliates.configuration', 'Configuration')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                {/* Discount Percent */}
                <div className="space-y-1">
                  <Label htmlFor="discountPercent">
                    {t(
                      'admin.affiliates.customer_discount',
                      'Customer Discount (%)'
                    )}
                  </Label>
                  <Input
                    type="number"
                    id="discountPercent"
                    min="0"
                    max="100"
                    step="0.1"
                    value={discountPercent}
                    onChange={(e) =>
                      setDiscountPercent(parseFloat(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'admin.affiliates.customer_discount_desc',
                      'Discount given to customers using affiliate codes'
                    )}
                  </p>
                  {settings?.discountPercent.updatedBy && (
                    <p className="text-muted-foreground/70 text-xs">
                      {t(
                        'admin.affiliates.last_updated_by',
                        'Last updated by {who} on {date}'
                      )
                        .replace('{who}', settings.discountPercent.updatedBy)
                        .replace(
                          '{date}',
                          formatDate(settings.discountPercent.updatedAt)
                        )}
                    </p>
                  )}
                </div>

                {/* Commission Percent */}
                <div className="space-y-1">
                  <Label htmlFor="commissionPercent">
                    {t(
                      'admin.affiliates.affiliate_commission',
                      'Affiliate Commission (%)'
                    )}
                  </Label>
                  <Input
                    type="number"
                    id="commissionPercent"
                    min="0"
                    max="100"
                    step="0.1"
                    value={commissionPercent}
                    onChange={(e) =>
                      setCommissionPercent(parseFloat(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'admin.affiliates.affiliate_commission_desc',
                      'Commission percentage on net revenue (after discount)'
                    )}
                  </p>
                  {settings?.commissionPercent.updatedBy && (
                    <p className="text-muted-foreground/70 text-xs">
                      {t(
                        'admin.affiliates.last_updated_by',
                        'Last updated by {who} on {date}'
                      )
                        .replace('{who}', settings.commissionPercent.updatedBy)
                        .replace(
                          '{date}',
                          formatDate(settings.commissionPercent.updatedAt)
                        )}
                    </p>
                  )}
                </div>

                {/* Codes Per Month */}
                <div className="space-y-1">
                  <Label htmlFor="codesPerMonth">
                    {t('admin.affiliates.codes_per_month', 'Codes Per Month')}
                  </Label>
                  <Input
                    type="number"
                    id="codesPerMonth"
                    min="1"
                    max="100"
                    value={codesPerMonth}
                    onChange={(e) =>
                      setCodesPerMonth(parseInt(e.target.value, 10))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'admin.affiliates.codes_per_month_desc',
                      'Number of codes distributed to each affiliate monthly'
                    )}
                  </p>
                </div>

                {/* Base Price */}
                <div className="space-y-1">
                  <Label htmlFor="basePrice">
                    {t(
                      'admin.affiliates.monthly_subscription_price',
                      'Monthly Subscription Price ($)'
                    )}
                  </Label>
                  <Input
                    type="number"
                    id="basePrice"
                    min="0"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'admin.affiliates.monthly_subscription_price_desc',
                      'Regular monthly subscription price before discount'
                    )}
                  </p>
                </div>

                {/* 3-Day Trial Price */}
                <div className="space-y-1">
                  <Label htmlFor="threeDayPrice">
                    {t(
                      'admin.affiliates.three_day_trial_price',
                      '3-Day Trial Price ($)'
                    )}
                  </Label>
                  <Input
                    type="number"
                    id="threeDayPrice"
                    min="0"
                    step="0.01"
                    value={threeDayPrice}
                    onChange={(e) =>
                      setThreeDayPrice(parseFloat(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'admin.affiliates.three_day_trial_price_desc',
                      '3-day trial plan price in USD (dLocal countries only)'
                    )}
                  </p>
                </div>

                {/* Change Reason */}
                <div className="space-y-1">
                  <Label htmlFor="reason">
                    {t(
                      'admin.affiliates.reason_for_change',
                      'Reason for Change (Optional)'
                    )}
                  </Label>
                  <Input
                    type="text"
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t(
                      'admin.affiliates.reason_placeholder_promo',
                      'e.g., Holiday promotion, Market adjustment'
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'admin.affiliates.recorded_in_audit',
                      'This will be recorded in the audit history'
                    )}
                  </p>
                </div>

                {/* Submit Button */}
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? t('Saving...') : t('Save Changes', 'Save Changes')}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <div className="space-y-6">
            {/* Example Calculation */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">
                  {t(
                    'admin.affiliates.example_calculation',
                    'Example Calculation'
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('admin.affiliates.regular_price', 'Regular Price:')}
                  </span>
                  <span className="font-medium text-foreground">
                    ${basePrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>
                    {t(
                      'admin.affiliates.discount_pct',
                      'Discount ({n}%):'
                    ).replace('{n}', String(discountPercent))}
                  </span>
                  <span className="font-medium">
                    -${((basePrice * discountPercent) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">
                    {t('admin.affiliates.customer_pays', 'Customer Pays:')}
                  </span>
                  <span className="font-semibold text-foreground">
                    ${exampleNetPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>
                    {t(
                      'admin.affiliates.affiliate_earns_pct',
                      'Affiliate Earns ({n}%):'
                    ).replace('{n}', String(commissionPercent))}
                  </span>
                  <span className="font-semibold">
                    ${exampleCommission.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-blue-500">
                  <span>
                    {t('admin.affiliates.company_revenue', 'Company Revenue:')}
                  </span>
                  <span className="font-semibold">
                    ${(exampleNetPrice - exampleCommission).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Important Notes */}
            <Card className="border-amber-500/30 bg-amber-500/10">
              <CardContent className="p-4">
                <h3 className="mb-2 font-semibold text-amber-700 dark:text-amber-300">
                  {t('admin.affiliates.important_notes', 'Important Notes')}
                </h3>
                <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                  <li>
                    {t(
                      'admin.affiliates.note_effect_immediately',
                      'Changes take effect immediately for new code distributions'
                    )}
                  </li>
                  <li>
                    {t(
                      'admin.affiliates.note_existing_codes',
                      'Existing codes retain their original discount/commission rates'
                    )}
                  </li>
                  <li>
                    {t(
                      'admin.affiliates.note_caching',
                      'Frontend pages will update within 5 minutes due to caching'
                    )}
                  </li>
                  <li>
                    {t(
                      'admin.affiliates.note_audit_log',
                      'All changes are logged in the audit history'
                    )}
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
