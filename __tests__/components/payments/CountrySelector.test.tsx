/**
 * CountrySelector Component Tests
 *
 * Tests the CountrySelector:
 * - Renders dLocal supported countries
 * - Verifies eye-catching blue frame and light-blue background in light mode
 * - Verifies eye-catching blue frame in dark mode
 * - Tests onChange callback
 * - Tests all 19 supported languages
 *
 * @module __tests__/components/payments/CountrySelector.test
 */

import React from 'react';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { CountrySelector } from '@/components/payments/CountrySelector';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/checkout',
}));

// Mock geo detect API
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ country: 'TH' }),
});

beforeEach(() => {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(defaultPreferences));
  jest.clearAllMocks();
});

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

describe('CountrySelector', () => {
  const defaultProps = {
    value: 'TH' as const,
    onChange: jest.fn(),
    autoDetect: false,
  };

  it('renders country selector with selected country', () => {
    render(<CountrySelector {...defaultProps} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('TH');
  });

  it('applies eye-catching blue border and light-blue background for light mode and blue border for dark mode', () => {
    render(<CountrySelector {...defaultProps} />);
    const select = screen.getByRole('combobox');
    expect(select.className).toContain('border-2');
    expect(select.className).toContain('border-blue-500');
    expect(select.className).toContain('bg-blue-50');
    expect(select.className).toContain('dark:border-blue-500');
    expect(select.className).toContain('dark:bg-background');
  });

  it('triggers onChange when user selects another country', () => {
    const onChange = jest.fn();
    render(<CountrySelector {...defaultProps} onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'NG' } });
    expect(onChange).toHaveBeenCalledWith('NG');
  });

  it('renders in all 19 supported languages without crashing', () => {
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

    supportedLanguages.forEach((lang) => {
      localStorage.setItem(
        LOCALE_STORAGE_KEY,
        JSON.stringify({ ...defaultPreferences, language: lang })
      );
      const { unmount } = render(<CountrySelector {...defaultProps} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      unmount();
    });
  });
});
