import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Bell,
  Mail,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Newspaper,
  Moon,
  Clock,
  Volume2,
  VolumeX,
  Vibrate,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

const timeOptions = [
  '12:00 AM',
  '1:00 AM',
  '2:00 AM',
  '3:00 AM',
  '4:00 AM',
  '5:00 AM',
  '6:00 AM',
  '7:00 AM',
  '8:00 AM',
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
  '7:00 PM',
  '8:00 PM',
  '9:00 PM',
  '10:00 PM',
  '11:00 PM',
];

const daysOfWeek = [
  { id: 'mon', label: 'M' },
  { id: 'tue', label: 'T' },
  { id: 'wed', label: 'W' },
  { id: 'thu', label: 'T' },
  { id: 'fri', label: 'F' },
  { id: 'sat', label: 'S' },
  { id: 'sun', label: 'S' },
];

const notificationSounds = [
  { id: 'default', label: 'Default', frequency: 880, duration: 0.15 },
  { id: 'chime', label: 'Chime', frequency: 1200, duration: 0.2 },
  { id: 'ping', label: 'Ping', frequency: 1000, duration: 0.1 },
  { id: 'bell', label: 'Bell', frequency: 600, duration: 0.3 },
  { id: 'alert', label: 'Alert', frequency: 440, duration: 0.25 },
];

const vibrationPatterns = [
  { id: 'short', label: 'Short', pattern: [100] },
  { id: 'medium', label: 'Medium', pattern: [200] },
  { id: 'long', label: 'Long', pattern: [400] },
  { id: 'double', label: 'Double Tap', pattern: [100, 100, 100] },
  { id: 'pulse', label: 'Pulse', pattern: [100, 50, 100, 50, 100] },
];

const STORAGE_KEYS = {
  soundEnabled: 'notif-sound-enabled',
  selectedSound: 'notif-selected-sound',
  soundVolume: 'notif-sound-volume',
  vibrationEnabled: 'notif-vibration-enabled',
  selectedVibration: 'notif-selected-vibration',
  quietHoursEnabled: 'notif-quiet-hours-enabled',
  quietStartTime: 'notif-quiet-start-time',
  quietEndTime: 'notif-quiet-end-time',
  quietDays: 'notif-quiet-days',
  allowCritical: 'notif-allow-critical',
};

const Notifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Sound & Vibration State (with localStorage persistence)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.soundEnabled);
    return stored !== null ? stored === 'true' : true;
  });
  const [selectedSound, setSelectedSound] = useState(
    () => localStorage.getItem(STORAGE_KEYS.selectedSound) || 'default'
  );
  const [soundVolume, setSoundVolume] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.soundVolume);
    return stored ? [parseInt(stored)] : [70];
  });
  const [vibrationEnabled, setVibrationEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.vibrationEnabled);
    return stored !== null ? stored === 'true' : true;
  });
  const [selectedVibration, setSelectedVibration] = useState(
    () => localStorage.getItem(STORAGE_KEYS.selectedVibration) || 'short'
  );

  // Quiet Hours State (with localStorage persistence)
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.quietHoursEnabled);
    return stored !== null ? stored === 'true' : true;
  });
  const [quietStartTime, setQuietStartTime] = useState(
    () => localStorage.getItem(STORAGE_KEYS.quietStartTime) || '10:00 PM'
  );
  const [quietEndTime, setQuietEndTime] = useState(
    () => localStorage.getItem(STORAGE_KEYS.quietEndTime) || '7:00 AM'
  );
  const [quietDays, setQuietDays] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.quietDays);
    return stored
      ? JSON.parse(stored)
      : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  });
  const [allowCritical, setAllowCritical] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.allowCritical);
    return stored !== null ? stored === 'true' : true;
  });

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.soundEnabled, String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.selectedSound, selectedSound);
  }, [selectedSound]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.soundVolume, String(soundVolume[0]));
  }, [soundVolume]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.vibrationEnabled,
      String(vibrationEnabled)
    );
  }, [vibrationEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.selectedVibration, selectedVibration);
  }, [selectedVibration]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.quietHoursEnabled,
      String(quietHoursEnabled)
    );
  }, [quietHoursEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.quietStartTime, quietStartTime);
  }, [quietStartTime]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.quietEndTime, quietEndTime);
  }, [quietEndTime]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.quietDays, JSON.stringify(quietDays));
  }, [quietDays]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.allowCritical, String(allowCritical));
  }, [allowCritical]);

  const [pushSettings, setPushSettings] = useState<NotificationSetting[]>([
    {
      id: 'price_alerts',
      label: 'Price Alerts',
      description: 'When target prices are reached',
      icon: TrendingUp,
      enabled: true,
    },
    {
      id: 'trade_exec',
      label: 'Trade Execution',
      description: 'Order fills and executions',
      icon: Bell,
      enabled: true,
    },
    {
      id: 'margin_warning',
      label: 'Margin Warnings',
      description: 'Low margin level alerts',
      icon: AlertTriangle,
      enabled: true,
    },
    {
      id: 'news',
      label: 'Market News',
      description: 'Breaking news updates',
      icon: Newspaper,
      enabled: false,
    },
  ]);

  const [emailSettings, setEmailSettings] = useState<NotificationSetting[]>([
    {
      id: 'daily_summary',
      label: 'Daily Summary',
      description: 'Daily portfolio report',
      icon: Mail,
      enabled: true,
    },
    {
      id: 'weekly_report',
      label: 'Weekly Report',
      description: 'Weekly performance analysis',
      icon: Mail,
      enabled: true,
    },
    {
      id: 'promo',
      label: 'Promotions',
      description: 'Special offers and updates',
      icon: Mail,
      enabled: false,
    },
  ]);

  const [smsSettings, setSmsSettings] = useState<NotificationSetting[]>([
    {
      id: 'critical_alerts',
      label: 'Critical Alerts',
      description: 'Urgent account notifications',
      icon: MessageSquare,
      enabled: true,
    },
    {
      id: 'auth_codes',
      label: 'Authentication Codes',
      description: '2FA verification codes',
      icon: MessageSquare,
      enabled: true,
    },
  ]);

  const playSound = useCallback(
    (soundId?: string) => {
      const sound =
        notificationSounds.find((s) => s.id === (soundId || selectedSound)) ||
        notificationSounds[0];
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = sound.frequency;
      oscillator.type = 'sine';

      const volume = soundVolume[0] / 100;
      gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + sound.duration
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + sound.duration);
    },
    [selectedSound, soundVolume]
  );

  const triggerVibration = useCallback(
    (patternId?: string) => {
      if (!navigator.vibrate) return;
      const pattern =
        vibrationPatterns.find(
          (p) => p.id === (patternId || selectedVibration)
        ) || vibrationPatterns[0];
      navigator.vibrate(pattern.pattern);
    },
    [selectedVibration]
  );

  const testNotification = useCallback(() => {
    // Play sound if enabled
    if (soundEnabled) {
      playSound();
    }
    // Trigger vibration if enabled
    if (vibrationEnabled) {
      triggerVibration();
    }

    // Show toast notification
    const enabledFeatures = [];
    if (soundEnabled) enabledFeatures.push('Sound');
    if (vibrationEnabled) enabledFeatures.push('Vibration');

    toast({
      title: 'Test Notification',
      description:
        enabledFeatures.length > 0
          ? `${enabledFeatures.join(' & ')} triggered successfully!`
          : 'No feedback enabled. Enable sound or vibration to test.',
    });
  }, [soundEnabled, vibrationEnabled, playSound, triggerVibration, toast]);

  const toggleSetting = (
    settings: NotificationSetting[],
    setSettings: React.Dispatch<React.SetStateAction<NotificationSetting[]>>,
    id: string
  ) => {
    setSettings(
      settings.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const toggleQuietDay = (dayId: string) => {
    setQuietDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const renderSection = (
    title: string,
    settings: NotificationSetting[],
    setSettings: React.Dispatch<React.SetStateAction<NotificationSetting[]>>
  ) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-2">
        {settings.map((setting) => (
          <div
            key={setting.id}
            className="flex items-center gap-3 rounded-lg p-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <setting.icon className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <Label
                htmlFor={setting.id}
                className="cursor-pointer font-medium text-foreground"
              >
                {setting.label}
              </Label>
              <p className="text-xs text-muted-foreground">
                {setting.description}
              </p>
            </div>
            <Switch
              id={setting.id}
              checked={setting.enabled}
              onCheckedChange={() =>
                toggleSetting(settings, setSettings, setting.id)
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">Manage your alerts</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 space-y-4 p-4 pb-24">
        {/* Sound & Vibration */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                Sound & Vibration
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={testNotification}
                disabled={!soundEnabled && !vibrationEnabled}
                className="gap-1.5"
              >
                <Bell className="h-4 w-4" />
                Test
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {/* Sound Toggle */}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${soundEnabled ? 'bg-green-500/10' : 'bg-secondary'}`}
              >
                {soundEnabled ? (
                  <Volume2 className="h-5 w-5 text-green-500" />
                ) : (
                  <VolumeX className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <Label
                  htmlFor="sound-enabled"
                  className="cursor-pointer font-medium text-foreground"
                >
                  Notification Sounds
                </Label>
                <p className="text-xs text-muted-foreground">
                  Play sound for notifications
                </p>
              </div>
              <Switch
                id="sound-enabled"
                checked={soundEnabled}
                onCheckedChange={setSoundEnabled}
              />
            </div>

            {soundEnabled && (
              <>
                {/* Sound Selection */}
                <div className="pl-13 space-y-2">
                  <Label className="text-xs text-muted-foreground">Sound</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedSound}
                      onValueChange={setSelectedSound}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {notificationSounds.map((sound) => (
                          <SelectItem key={sound.id} value={sound.id}>
                            {sound.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => playSound()}
                      aria-label="Preview sound"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Volume Slider */}
                <div className="pl-13 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Volume
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {soundVolume[0]}%
                    </span>
                  </div>
                  <Slider
                    value={soundVolume}
                    onValueChange={setSoundVolume}
                    min={0}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                </div>
              </>
            )}

            <div className="border-t border-border pt-4">
              {/* Vibration Toggle */}
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${vibrationEnabled ? 'bg-purple-500/10' : 'bg-secondary'}`}
                >
                  <Vibrate
                    className={`h-5 w-5 ${vibrationEnabled ? 'text-purple-500' : 'text-muted-foreground'}`}
                  />
                </div>
                <div className="flex-1">
                  <Label
                    htmlFor="vibration-enabled"
                    className="cursor-pointer font-medium text-foreground"
                  >
                    Vibration
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Haptic feedback for notifications
                  </p>
                </div>
                <Switch
                  id="vibration-enabled"
                  checked={vibrationEnabled}
                  onCheckedChange={setVibrationEnabled}
                />
              </div>

              {vibrationEnabled && (
                <div className="pl-13 mt-4 space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Pattern
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedVibration}
                      onValueChange={setSelectedVibration}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vibrationPatterns.map((pattern) => (
                          <SelectItem key={pattern.id} value={pattern.id}>
                            {pattern.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => triggerVibration()}
                      aria-label="Preview vibration"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Note: Vibration requires device support
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Quiet Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {/* Enable Toggle */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Moon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <Label
                  htmlFor="quiet-hours"
                  className="cursor-pointer font-medium text-foreground"
                >
                  Enable Quiet Hours
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mute notifications during set times
                </p>
              </div>
              <Switch
                id="quiet-hours"
                checked={quietHoursEnabled}
                onCheckedChange={setQuietHoursEnabled}
              />
            </div>

            {quietHoursEnabled && (
              <>
                {/* Time Range */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Schedule</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="mb-1.5 block text-xs text-muted-foreground">
                        From
                      </Label>
                      <Select
                        value={quietStartTime}
                        onValueChange={setQuietStartTime}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="mt-5 text-muted-foreground">to</span>
                    <div className="flex-1">
                      <Label className="mb-1.5 block text-xs text-muted-foreground">
                        To
                      </Label>
                      <Select
                        value={quietEndTime}
                        onValueChange={setQuietEndTime}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Days Selection */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">
                    Active Days
                  </Label>
                  <div className="flex justify-between gap-2">
                    {daysOfWeek.map((day) => (
                      <Button
                        key={day.id}
                        variant={
                          quietDays.includes(day.id) ? 'default' : 'outline'
                        }
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => toggleQuietDay(day.id)}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Allow Critical */}
                <div className="flex items-center gap-3 border-t border-border pt-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <Label
                      htmlFor="allow-critical"
                      className="cursor-pointer font-medium text-foreground"
                    >
                      Allow Critical Alerts
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Margin warnings & urgent notifications
                    </p>
                  </div>
                  <Switch
                    id="allow-critical"
                    checked={allowCritical}
                    onCheckedChange={setAllowCritical}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {renderSection('Push Notifications', pushSettings, setPushSettings)}
        {renderSection('Email Notifications', emailSettings, setEmailSettings)}
        {renderSection('SMS Notifications', smsSettings, setSmsSettings)}
      </div>
    </div>
  );
};

export default Notifications;
