import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Camera,
  Save,
  Loader2,
  Bell,
  Palette,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const profileSchema = z.object({
  displayName: z
    .string()
    .max(100, 'Display name must be less than 100 characters')
    .optional(),
  phone: z.string().max(20, 'Phone must be less than 20 characters').optional(),
});

interface PersonalPreferences {
  phone?: string;
  theme?: string;
  fontSize?: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    settings: notificationSettings,
    updateSettings: updateNotificationSettings,
  } = useNotifications();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [personalPrefs, setPersonalPrefs] = useState<PersonalPreferences>({
    phone: '',
    theme: 'system',
    fontSize: 'medium',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, preferences')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        const storedPrefs = (data?.preferences as PersonalPreferences) || {};

        setDisplayName(data?.display_name || '');
        setEmail(user.email || '');
        setPersonalPrefs({
          phone: storedPrefs.phone || '',
          theme: storedPrefs.theme || theme || 'system',
          fontSize:
            storedPrefs.fontSize ||
            localStorage.getItem('app-font-size') ||
            'medium',
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user, theme]);

  const handleSave = async () => {
    if (!user) return;

    const validation = profileSchema.safeParse({
      displayName,
      phone: personalPrefs.phone,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsSaving(true);
    try {
      // Build complete preferences object
      const fullPreferences = {
        ...personalPrefs,
        notificationsEnabled: notificationSettings.notificationsEnabled,
        emailNotifications: notificationSettings.emailNotifications,
        pushNotifications: notificationSettings.pushNotifications,
        priceAlerts: notificationSettings.priceAlerts,
        tradeConfirmations: notificationSettings.tradeConfirmations,
        marketNews: notificationSettings.marketNews,
      };

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName || null,
          preferences: JSON.parse(JSON.stringify(fullPreferences)),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Apply theme preference
      if (personalPrefs.theme) {
        setTheme(personalPrefs.theme);
      }

      // Apply font size preference
      if (personalPrefs.fontSize) {
        localStorage.setItem('app-font-size', personalPrefs.fontSize);
        const scales: Record<string, number> = {
          small: 0.875,
          medium: 1,
          large: 1.125,
          xlarge: 1.25,
        };
        document.documentElement.style.fontSize = `${(scales[personalPrefs.fontSize] || 1) * 16}px`;
      }

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationToggle = async (
    key: keyof typeof notificationSettings,
    value: boolean
  ) => {
    await updateNotificationSettings({ [key]: value });
  };

  const getInitials = () => {
    if (displayName) {
      const parts = displayName.split(' ');
      return parts.length > 1
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : displayName.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Profile</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account settings
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 space-y-4 p-4">
        {/* Avatar Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary">
                  <span className="text-3xl font-bold text-primary-foreground">
                    {getInitials()}
                  </span>
                </div>
                <button className="absolute bottom-0 right-0 rounded-full border-2 border-background bg-secondary p-2">
                  <Camera className="h-4 w-4 text-secondary-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Tap to change photo
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different settings */}
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal" className="gap-1">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Personal</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Theme</span>
            </TabsTrigger>
          </TabsList>

          {/* Personal Info Tab */}
          <TabsContent value="personal" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed here
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={personalPrefs.phone}
                    onChange={(e) =>
                      setPersonalPrefs((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Master toggle for all notifications
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.notificationsEnabled}
                    onCheckedChange={(checked) =>
                      handleNotificationToggle('notificationsEnabled', checked)
                    }
                  />
                </div>

                <div className="space-y-4 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive updates via email
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) =>
                        handleNotificationToggle('emailNotifications', checked)
                      }
                      disabled={!notificationSettings.notificationsEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Push Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive push alerts on device
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.pushNotifications}
                      onCheckedChange={(checked) =>
                        handleNotificationToggle('pushNotifications', checked)
                      }
                      disabled={!notificationSettings.notificationsEnabled}
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t border-border pt-4">
                  <p className="text-sm font-medium">Alert Types</p>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Price Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        When prices hit your targets
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.priceAlerts}
                      onCheckedChange={(checked) =>
                        handleNotificationToggle('priceAlerts', checked)
                      }
                      disabled={!notificationSettings.notificationsEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Trade Confirmations</Label>
                      <p className="text-xs text-muted-foreground">
                        Order execution updates
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.tradeConfirmations}
                      onCheckedChange={(checked) =>
                        handleNotificationToggle('tradeConfirmations', checked)
                      }
                      disabled={!notificationSettings.notificationsEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Market News</Label>
                      <p className="text-xs text-muted-foreground">
                        Breaking market updates
                      </p>
                    </div>
                    <Switch
                      checked={notificationSettings.marketNews}
                      onCheckedChange={(checked) =>
                        handleNotificationToggle('marketNews', checked)
                      }
                      disabled={!notificationSettings.notificationsEnabled}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  Appearance Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={personalPrefs.theme}
                    onValueChange={(value) =>
                      setPersonalPrefs((prev) => ({ ...prev, theme: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select
                    value={personalPrefs.fontSize}
                    onValueChange={(value) =>
                      setPersonalPrefs((prev) => ({ ...prev, fontSize: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="xlarge">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Adjust text size for readability
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          className="w-full gap-2"
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export default Profile;
