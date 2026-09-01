import {
  ArrowLeft,
  Check,
  Clock,
  DollarSign,
  Globe,
  Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import { toast } from 'sonner';
import { useLocaleSettings } from '@/hooks/useLocaleSettings';

// Curated to exactly the monolith's real dictionary-backed languages
// (`lib/i18n/dictionaries/*.json`: ar, de, en-GB, en-US, es, hi, id, ja,
// pt, th, tr, ur, vi — `en` here stands in for both English variants).
// Previously listed several languages (fr, it, zh, ko, ru, nl, pl) with no
// real translation anywhere in the app -- the same class of issue the
// locale/i18n compliance session's §0 fix addressed on the web Language
// page ("selecting either would silently degrade to English forever"),
// removed here for the same reason. `region` doubles as the display badge
// and, for Arabic, pins the UAE as its primary country/currency/timezone —
// matching the monolith's PRIMARY_COUNTRY_FOR_LANGUAGE correction
// (`ar -> ae`, not Saudi Arabia).
const languages = [
  { code: 'en', name: 'English', nativeName: 'English', region: 'US' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', region: 'ES' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', region: 'DE' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', region: 'BR' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', region: 'JP' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', region: 'AE' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', region: 'PK' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'IN' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', region: 'TR' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', region: 'VN' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', region: 'TH' },
  {
    code: 'id',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    region: 'ID',
  },
];

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Dubai', label: 'Dubai / UAE (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

const Language = () => {
  const navigate = useNavigate();
  const { language, timezone, currency, updateSettings } = useLocaleSettings();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLanguages = languages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLanguageChange = (code: string) => {
    const selected = languages.find((l) => l.code === code);
    updateSettings({ language: code });
    toast.success(`Language changed to ${selected?.name}`);
  };

  const currentLanguage = languages.find((l) => l.code === language);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Language</h1>
        </div>
      </div>

      <div className="space-y-6 p-4">
        {/* Current Language */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Current Language
                </p>
                <p className="font-medium">
                  {currentLanguage?.name} ({currentLanguage?.nativeName})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search languages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Language List */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Available Languages ({filteredLanguages.length})
          </h2>
          <div className="space-y-2">
            {filteredLanguages.map((lang) => (
              <Card
                key={lang.code}
                className={`cursor-pointer transition-all ${
                  language === lang.code
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => handleLanguageChange(lang.code)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {lang.region}
                      </div>
                      <div>
                        <p className="font-medium">{lang.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {lang.nativeName}
                        </p>
                      </div>
                    </div>
                    {language === lang.code && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {filteredLanguages.length === 0 && (
          <div className="py-8 text-center">
            <Globe className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No languages found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search term
            </p>
          </div>
        )}

        {/* Timezone */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            Timezone
          </h2>
          <Select
            value={timezone}
            onValueChange={(value) => updateSettings({ timezone: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {timezones.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Currency */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Currency
          </h2>
          <Select
            value={currency}
            onValueChange={(value) => updateSettings({ currency: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  {curr.code} {curr.symbol} — {curr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            Used for displaying prices and monetary values
          </p>
        </div>

        {/* Note */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Changing the language will translate the
              app interface. Some content may remain in its original language.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Language;
