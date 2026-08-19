import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, Sun, Moon, Monitor, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const themes = [
  { id: 'light', label: 'Light', icon: Sun, description: 'Bright and clean' },
  { id: 'dark', label: 'Dark', icon: Moon, description: 'Easy on the eyes' },
  {
    id: 'system',
    label: 'System',
    icon: Monitor,
    description: 'Match device settings',
  },
];

const accentColors = [
  { id: 'blue', name: 'Blue', value: 'hsl(221, 83%, 53%)' },
  { id: 'green', name: 'Green', value: 'hsl(142, 71%, 45%)' },
  { id: 'purple', name: 'Purple', value: 'hsl(262, 83%, 58%)' },
  { id: 'orange', name: 'Orange', value: 'hsl(24, 95%, 53%)' },
  { id: 'pink', name: 'Pink', value: 'hsl(330, 81%, 60%)' },
  { id: 'teal', name: 'Teal', value: 'hsl(175, 77%, 40%)' },
];

const fontSizes = [
  { id: 'small', label: 'Small', scale: 0.875 },
  { id: 'medium', label: 'Medium', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.125 },
  { id: 'xlarge', label: 'Extra Large', scale: 1.25 },
];

const STORAGE_KEYS = {
  accentColor: 'app-accent-color',
  fontSize: 'app-font-size',
  chartLineWidth: 'app-chart-line-width',
};

const Appearance = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [selectedColor, setSelectedColor] = useState(
    () => localStorage.getItem(STORAGE_KEYS.accentColor) || 'blue'
  );
  const [selectedFontSize, setSelectedFontSize] = useState(
    () => localStorage.getItem(STORAGE_KEYS.fontSize) || 'medium'
  );
  const [chartLineWidth, setChartLineWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.chartLineWidth);
    return stored ? [parseFloat(stored)] : [2];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.accentColor, selectedColor);
  }, [selectedColor]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.fontSize, selectedFontSize);
  }, [selectedFontSize]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.chartLineWidth,
      chartLineWidth[0].toString()
    );
  }, [chartLineWidth]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Appearance</h1>
            <p className="text-sm text-muted-foreground">
              Customize your experience
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 space-y-4 p-4 pb-24">
        {/* Theme Selection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Theme
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <RadioGroup value={theme || 'system'} onValueChange={setTheme}>
              <div className="grid grid-cols-3 gap-3">
                {themes.map((themeOption) => (
                  <label
                    key={themeOption.id}
                    className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                      theme === themeOption.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <RadioGroupItem
                      value={themeOption.id}
                      className="sr-only"
                    />
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        theme === themeOption.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      <themeOption.icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {themeOption.label}
                    </span>
                    <span className="text-center text-xs text-muted-foreground">
                      {themeOption.description}
                    </span>
                    {theme === themeOption.id && (
                      <div className="absolute right-2 top-2">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Accent Color */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Accent Color
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-6 gap-3">
              {accentColors.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setSelectedColor(color.id)}
                  className={`relative aspect-square rounded-full transition-transform hover:scale-110 ${
                    selectedColor === color.id
                      ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                      : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {selectedColor === color.id && (
                    <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Selected:{' '}
              <span className="font-medium text-foreground">
                {accentColors.find((c) => c.id === selectedColor)?.name}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Font Size */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Font Size
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <RadioGroup
              value={selectedFontSize}
              onValueChange={setSelectedFontSize}
            >
              <div className="space-y-2">
                {fontSizes.map((size) => (
                  <label
                    key={size.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors ${
                      selectedFontSize === size.id
                        ? 'border border-primary bg-primary/10'
                        : 'bg-secondary/50 hover:bg-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={size.id} />
                      <span
                        className="font-medium text-foreground"
                        style={{ fontSize: `${size.scale}rem` }}
                      >
                        {size.label}
                      </span>
                    </div>
                    <span
                      className="text-muted-foreground"
                      style={{ fontSize: `${size.scale * 0.875}rem` }}
                    >
                      Aa
                    </span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Chart Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Chart Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground">Line Thickness</Label>
                <span className="text-sm text-muted-foreground">
                  {chartLineWidth[0]}px
                </span>
              </div>
              <Slider
                value={chartLineWidth}
                onValueChange={setChartLineWidth}
                min={1}
                max={5}
                step={0.5}
                className="w-full"
              />
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-secondary/50 p-4">
              <p className="mb-2 text-xs text-muted-foreground">Preview</p>
              <svg className="h-16 w-full" viewBox="0 0 200 60">
                <path
                  d="M0,40 L20,35 L40,45 L60,30 L80,35 L100,20 L120,25 L140,15 L160,20 L180,10 L200,15"
                  fill="none"
                  stroke={
                    accentColors.find((c) => c.id === selectedColor)?.value
                  }
                  strokeWidth={chartLineWidth[0]}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Appearance;
