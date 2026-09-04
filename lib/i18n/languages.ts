export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

/**
 * Single source of truth for the app's language-picker options, shared by
 * Settings -> Language & Region (`app/settings/language/page.tsx`) and the
 * public landing-page language modal
 * (`components/marketing/language-selector-modal.tsx`) so both surfaces
 * always offer the exact same set of languages.
 */
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ar', name: 'Arabic (العربية)', flag: '🇦🇪' },
  { code: 'fr', name: 'French (Français)', flag: '🇫🇷' },
  { code: 'ko', name: 'Korean (한국어)', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese (Simplified) (简体中文)', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Chinese (Traditional) (繁體中文)', flag: '🇹🇼' },
  { code: 'ur', name: 'Urdu (اردو)', flag: '🇵🇰' },
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)', flag: '🇻🇳' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)', flag: '🇮🇩' },
  { code: 'th', name: 'Thai (ภาษาไทย)', flag: '🇹🇭' },
  { code: 'tr', name: 'Turkish (Türkçe)', flag: '🇹🇷' },
];
