import { render, screen } from '@testing-library/react';

import { FxRateAttribution } from '@/components/payments/fx-rate-attribution';
import { useLocale } from '@/lib/context/locale-context';
import type { DisplayUsdRates } from '@/lib/country-config';
import type { FxRateMetadata } from '@/lib/fx/rate-contract';
import { formatDateTimeInZone } from '@/lib/i18n/format-datetime';
import enGB from '@/lib/i18n/dictionaries/en-GB.json';
import th from '@/lib/i18n/dictionaries/th.json';

jest.mock('@/lib/context/locale-context', () => ({
  useLocale: jest.fn(),
}));

const mockUseLocale = jest.mocked(useLocale);
const publishedAt = '2026-10-12T18:30:00Z';

function rateSnapshot(
  metadata: FxRateMetadata = {}
): DisplayUsdRates & FxRateMetadata {
  return {
    rates: { USD: 1, GBP: 0.756, THB: 33.53 },
    source: 'live',
    fetchedAt: '2026-10-13T00:00:00Z',
    ...metadata,
  };
}

function setLocale(
  usdRates: (DisplayUsdRates & FxRateMetadata) | null,
  dictionary: Record<string, string> = enGB,
  prefs: Parameters<typeof formatDateTimeInZone>[1] = {
    timezone: 'Europe/London',
    dateFormat: 'DMY',
    timeFormat: '24h',
  }
) {
  const formatDateTime = jest.fn((value: number | string | Date) =>
    formatDateTimeInZone(value, prefs)
  );
  mockUseLocale.mockReturnValue({
    usdRates,
    t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key,
    formatDateTime,
  } as unknown as ReturnType<typeof useLocale>);
  return formatDateTime;
}

describe('FX rate attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['currencybeacon', 'CurrencyBeacon', 'https://currencybeacon.com/'],
    ['frankfurter', 'Frankfurter', 'https://frankfurter.dev/'],
  ] as const)('links the active %s provider', (provider, name, href) => {
    setLocale(rateSnapshot({ provider }));
    render(<FxRateAttribution />);

    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText('Source updated:')).not.toBeInTheDocument();
  });

  it('changes attribution when the shared snapshot changes provider', () => {
    setLocale(rateSnapshot({ provider: 'currencybeacon' }));
    const { rerender } = render(<FxRateAttribution />);

    setLocale(rateSnapshot({ provider: 'frankfurter' }));
    rerender(<FxRateAttribution />);

    expect(
      screen.getByRole('link', { name: 'Frankfurter' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'CurrencyBeacon' })
    ).not.toBeInTheDocument();
  });

  it('formats the publication time rather than the retrieval time', () => {
    const formatDateTime = setLocale(
      rateSnapshot({ provider: 'currencybeacon', rateUpdatedAt: publishedAt })
    );
    render(<FxRateAttribution />);

    expect(formatDateTime).toHaveBeenCalledWith(publishedAt);
    expect(screen.getByText('12/10/2026 19:30')).toHaveAttribute(
      'dateTime',
      publishedAt
    );
    expect(screen.queryByText('13/10/2026 01:00')).not.toBeInTheDocument();
  });

  it('uses translated labels and the preferred timezone and time format', () => {
    setLocale(
      rateSnapshot({ provider: 'frankfurter', rateUpdatedAt: publishedAt }),
      th,
      { timezone: 'Asia/Bangkok', dateFormat: 'YMD', timeFormat: '12h' }
    );
    render(<FxRateAttribution />);

    expect(screen.getByText('อัตราแลกเปลี่ยนโดยประมาณ:')).toBeInTheDocument();
    expect(screen.getByText('แหล่งข้อมูลอัปเดตเมื่อ:')).toHaveTextContent(
      '2026-10-13 1:30 AM'
    );
    expect(
      screen.getByRole('link', { name: 'Frankfurter' })
    ).toBeInTheDocument();
  });

  it.each([
    ['no snapshot', null],
    ['legacy metadata', rateSnapshot()],
    [
      'fixed rates',
      rateSnapshot({ provider: 'fixed', rateUpdatedAt: publishedAt }),
    ],
  ] as const)(
    'handles %s without attributing an external live source',
    (_, snapshot) => {
      const formatDateTime = setLocale(snapshot);
      render(<FxRateAttribution />);

      expect(
        screen.getByText('Indicative prices use reference exchange rates.')
      ).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(formatDateTime).not.toHaveBeenCalled();
    }
  );

  it('omits an invalid publication time', () => {
    const formatDateTime = setLocale(
      rateSnapshot({
        provider: 'currencybeacon',
        rateUpdatedAt: 'invalid-date',
      })
    );
    render(<FxRateAttribution />);

    expect(
      screen.getByRole('link', { name: 'CurrencyBeacon' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Source updated:')).not.toBeInTheDocument();
    expect(formatDateTime).not.toHaveBeenCalled();
  });
});
