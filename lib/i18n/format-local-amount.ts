/** Format an already denominated market amount without subscription FX conversion. */
export function formatLocalGoldAmount(
  value: number,
  currency: string,
  language: string,
  signed = false
): string {
  return new Intl.NumberFormat(language === 'pt' ? 'pt-PT' : language, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value);
}

export function formatLocalGoldPercent(
  value: number,
  language: string
): string {
  return new Intl.NumberFormat(language === 'pt' ? 'pt-PT' : language, {
    style: 'percent',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(value / 100);
}
