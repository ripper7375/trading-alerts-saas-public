/**
 * PaymentMethodSelector Component Tests
 *
 * Tests the payment method selector:
 * - Renders payment methods for countries
 * - Verifies selection state and dark mode classes
 * - Tests callback on selection
 * - Tests multiple languages
 *
 * @module __tests__/components/payments/PaymentMethodSelector.test
 */

import React from 'react';
import {
  render as rtlRender,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { PaymentMethodSelector } from '@/components/payments/PaymentMethodSelector';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/checkout',
}));

// Mock fetch for payment methods API to fallback to local config immediately
global.fetch = jest.fn().mockRejectedValue(new Error('API offline'));

beforeEach(() => {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(defaultPreferences));
  jest.clearAllMocks();
});

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

describe('PaymentMethodSelector', () => {
  const defaultProps = {
    country: 'TH' as const,
    value: 'TrueMoney',
    onChange: jest.fn(),
  };

  it('renders payment methods for Thailand', async () => {
    render(<PaymentMethodSelector {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('TrueMoney')).toBeInTheDocument();
      expect(screen.getByText('Rabbit LINE Pay')).toBeInTheDocument();
      expect(screen.getByText('Thai QR')).toBeInTheDocument();
    });
  });

  it('applies dark mode styling to selected payment method', async () => {
    render(<PaymentMethodSelector {...defaultProps} value="TrueMoney" />);
    await waitFor(() => {
      const selectedRadio = screen.getByRole('radio', { name: /TrueMoney/i });
      expect(selectedRadio.className).toContain('dark:bg-blue-950/30');
      expect(selectedRadio.className).toContain('dark:border-blue-500');
    });
  });

  it('calls onChange when clicking an unselected method', async () => {
    const onChange = jest.fn();
    render(<PaymentMethodSelector {...defaultProps} onChange={onChange} />);
    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: /Rabbit LINE Pay/i })
      ).toBeInTheDocument();
    });
    const rabbitPay = screen.getByRole('radio', { name: /Rabbit LINE Pay/i });
    fireEvent.click(rabbitPay);
    expect(onChange).toHaveBeenCalledWith('Rabbit LINE Pay');
  });

  it('renders correctly across all 19 supported languages', async () => {
    const supportedLanguages = [
      'ar',
      'de',
      'en-GB',
      'en-US',
      'es',
      'fr',
      'hi',
      'id',
      'it',
      'ja',
      'ko',
      'pt-BR',
      'pt',
      'th',
      'tr',
      'ur',
      'vi',
      'zh-TW',
      'zh',
    ];

    for (const lang of supportedLanguages) {
      localStorage.setItem(
        LOCALE_STORAGE_KEY,
        JSON.stringify({ ...defaultPreferences, language: lang })
      );
      const { unmount } = render(<PaymentMethodSelector {...defaultProps} />);
      await waitFor(() => {
        const radios = screen.getAllByRole('radio');
        expect(radios.length).toBeGreaterThan(0);
      });
      unmount();
    }
  });
});
