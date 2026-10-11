import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/terminal',
  useRouter: () => ({ push: mockPush }),
}));

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import { MtfToggle } from '@/components/charts/mtf/MtfToggle';

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('MtfToggle Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('renders locked state when user is not PRO and navigates to pricing on click', () => {
    renderWithLocale(
      <MtfToggle isPro={false} enabled={false} onToggle={jest.fn()} />
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('PRO');

    fireEvent.click(button);
    expect(mockPush).toHaveBeenCalledWith('/pricing');
  });

  it('renders PRO toggle and calls onToggle on click', () => {
    const handleToggle = jest.fn();
    renderWithLocale(
      <MtfToggle isPro={true} enabled={false} onToggle={handleToggle} />
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(handleToggle).toHaveBeenCalledWith(true);
  });

  it('disables button and displays loader when isLoading is true without expanding text with ellipsis', () => {
    renderWithLocale(
      <MtfToggle
        isPro={true}
        enabled={true}
        isLoading={true}
        onToggle={jest.fn()}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    // Verify that literal "…" is NOT appended to avoid layout shift and scrollbars
    expect(button.textContent).not.toContain('…');
    // Verify loader is rendered (svg with animate-spin)
    const spinner = button.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
