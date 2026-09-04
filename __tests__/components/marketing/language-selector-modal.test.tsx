import React from 'react';
import {
  render as rtlRender,
  screen,
  type RenderOptions,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import { LanguageSelectorModal } from '@/components/marketing/language-selector-modal';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';

// LanguageSelectorModal calls useLocale() -- needs a LocaleProvider ancestor,
// same shadow-render pattern as __tests__/components/economic-calendar-widget.test.tsx
// (LESSONS-LEARNED.md L40).
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>{children}</LocaleProvider>
    ),
    ...options,
  });
}

// LocaleProvider calls usePathname() directly (L40's own stub).
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('LanguageSelectorModal', () => {
  beforeEach(() => {
    // Seeding skips LocaleProvider's real geo-IP fetch(), which otherwise
    // races jsdom teardown (LESSONS-LEARNED.md L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('renders every supported language when open', () => {
    render(<LanguageSelectorModal open onOpenChange={() => {}} />);

    for (const lang of SUPPORTED_LANGUAGES) {
      expect(screen.getByText(lang.name)).toBeInTheDocument();
    }
  });

  it('renders nothing when closed', () => {
    render(<LanguageSelectorModal open={false} onOpenChange={() => {}} />);

    expect(screen.queryByText('English (US)')).not.toBeInTheDocument();
  });

  it('selecting a language applies it and closes the modal', async () => {
    const user = userEvent.setup();
    let open = true;
    const handleOpenChange = (next: boolean): void => {
      open = next;
    };

    render(
      <LanguageSelectorModal open={open} onOpenChange={handleOpenChange} />
    );

    await user.click(screen.getByText('French (Français)'));

    expect(open).toBe(false);
    expect(
      JSON.parse(localStorage.getItem(LOCALE_STORAGE_KEY) || '{}').language
    ).toBe('fr');
  });

  it('marks the active language as pressed', () => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify({ ...defaultPreferences, language: 'ko' })
    );

    render(<LanguageSelectorModal open onOpenChange={() => {}} />);

    const koreanOption = screen.getByText('Korean (한국어)').closest('button');
    expect(koreanOption).toHaveAttribute('aria-pressed', 'true');
  });
});
