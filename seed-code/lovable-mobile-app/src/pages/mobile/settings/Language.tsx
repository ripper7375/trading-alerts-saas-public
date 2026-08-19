import { ArrowLeft, Check, Globe, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English', region: 'US' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', region: 'ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', region: 'FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', region: 'DE' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', region: 'IT' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', region: 'BR' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', region: 'CN' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', region: 'JP' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', region: 'KR' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', region: 'SA' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'IN' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', region: 'RU' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', region: 'NL' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', region: 'PL' },
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

const Language = () => {
  const navigate = useNavigate();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLanguages = languages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLanguageChange = (code: string) => {
    setSelectedLanguage(code);
    const language = languages.find((l) => l.code === code);
    toast.success(`Language changed to ${language?.name}`);
  };

  const currentLanguage = languages.find((l) => l.code === selectedLanguage);

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
            {filteredLanguages.map((language) => (
              <Card
                key={language.code}
                className={`cursor-pointer transition-all ${
                  selectedLanguage === language.code
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => handleLanguageChange(language.code)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {language.region}
                      </div>
                      <div>
                        <p className="font-medium">{language.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {language.nativeName}
                        </p>
                      </div>
                    </div>
                    {selectedLanguage === language.code && (
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
