import {
  DEFAULT_APPEARANCE_SETTINGS,
  sanitizeAppearanceSettings,
} from '@/lib/appearance/types';

describe('sanitizeAppearanceSettings', () => {
  it('passes through a fully valid settings object unchanged', () => {
    const valid = {
      theme: 'light' as const,
      accent: 'purple' as const,
      chartUpColor: '#abcdef',
      chartDownColor: '#123abc',
      gridOpacity: 75,
    };
    expect(sanitizeAppearanceSettings(valid)).toEqual(valid);
  });

  it('falls back to defaults for every field when given null/undefined', () => {
    expect(sanitizeAppearanceSettings(undefined)).toEqual(
      DEFAULT_APPEARANCE_SETTINGS
    );
    expect(sanitizeAppearanceSettings(null)).toEqual(
      DEFAULT_APPEARANCE_SETTINGS
    );
  });

  it('rejects an invalid theme/accent and falls back per-field', () => {
    const result = sanitizeAppearanceSettings({
      theme: 'neon',
      accent: 'chartreuse',
      chartUpColor: '#00ff00',
      chartDownColor: '#ff0000',
      gridOpacity: 10,
    });
    expect(result.theme).toBe(DEFAULT_APPEARANCE_SETTINGS.theme);
    expect(result.accent).toBe(DEFAULT_APPEARANCE_SETTINGS.accent);
    expect(result.chartUpColor).toBe('#00ff00');
    expect(result.chartDownColor).toBe('#ff0000');
    expect(result.gridOpacity).toBe(10);
  });

  it('rejects non-hex or malformed color strings', () => {
    const result = sanitizeAppearanceSettings({
      chartUpColor: 'not-a-color',
      chartDownColor: '#zzzzzz',
    });
    expect(result.chartUpColor).toBe(DEFAULT_APPEARANCE_SETTINGS.chartUpColor);
    expect(result.chartDownColor).toBe(
      DEFAULT_APPEARANCE_SETTINGS.chartDownColor
    );
  });

  it('clamps gridOpacity into [0, 100] and rounds fractional values', () => {
    expect(sanitizeAppearanceSettings({ gridOpacity: -10 }).gridOpacity).toBe(
      0
    );
    expect(sanitizeAppearanceSettings({ gridOpacity: 250 }).gridOpacity).toBe(
      100
    );
    expect(sanitizeAppearanceSettings({ gridOpacity: 12.6 }).gridOpacity).toBe(
      13
    );
  });

  it('falls back to default gridOpacity for non-numeric input', () => {
    expect(
      sanitizeAppearanceSettings({ gridOpacity: 'fifty' }).gridOpacity
    ).toBe(DEFAULT_APPEARANCE_SETTINGS.gridOpacity);
    expect(
      sanitizeAppearanceSettings({ gridOpacity: Number.NaN }).gridOpacity
    ).toBe(DEFAULT_APPEARANCE_SETTINGS.gridOpacity);
  });
});
