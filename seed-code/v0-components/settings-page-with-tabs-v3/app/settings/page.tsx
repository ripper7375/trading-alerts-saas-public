'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  CheckCircle,
  Copy,
  CreditCard,
  Globe,
  Download,
  Lock,
  User,
  Bell,
  Palette,
  HelpCircle,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  Laptop,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type TabType =
  | 'profile'
  | 'security'
  | 'notifications'
  | 'billing'
  | 'appearance'
  | 'language'
  | 'help';

interface AffiliateDiscount {
  active: boolean;
  code: string;
  totalSaved: number;
  cyclesSaved: number;
}

interface SettingsPageProps {
  initialTab?: TabType;
  affiliateDiscount?: AffiliateDiscount | null;
}

export default function SettingsPage({
  initialTab = 'profile',
  affiliateDiscount = {
    active: true,
    code: 'SAVE20',
    totalSaved: 17.4,
    cyclesSaved: 3,
  },
}: SettingsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const { toast } = useToast();

  // ✅ CRITICAL: Use SystemConfig hook for dynamic percentages
  const {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice,
    config,
    isLoading,
  } = useAffiliateConfig();

  // Profile form state
  const [profileData, setProfileData] = useState({
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    username: 'johndoe',
    bio: 'Trading enthusiast and market analyst',
    company: 'Acme Trading Co.',
  });

  // Security form state
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false,
  });

  // Notification preferences
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    tradingTips: true,
    productUpdates: true,
    promotionalOffers: false,
    frequency: 'instant',
  });

  // Appearance preferences
  const [appearancePrefs, setAppearancePrefs] = useState({
    theme: 'light',
    colorScheme: 'blue',
  });

  // Language preferences
  const [languagePrefs, setLanguagePrefs] = useState({
    language: 'en-US',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12',
    currency: 'USD',
  });

  // Password visibility
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Price constants
  const basePrice = 29.0;

  // Calculate prices using helper
  const discountedPrice = calculateDiscountedPrice(basePrice);
  const monthlySavings = basePrice - discountedPrice;

  // Billing data
  const hasDiscount = affiliateDiscount?.active || false;

  // Sync activeTab with URL
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (tab: TabType) => {
    if (unsavedChanges) {
      const confirmed = confirm('You have unsaved changes. Discard them?');
      if (!confirmed) return;
    }
    setActiveTab(tab);
    router.push(`/settings?tab=${tab}`);
    setUnsavedChanges(false);
  };

  // Handle form input changes
  const handleInputChange = (section: string, field: string, value: any) => {
    setUnsavedChanges(true);

    if (section === 'profile') {
      setProfileData((prev) => ({ ...prev, [field]: value }));
    } else if (section === 'security') {
      setSecurityData((prev) => ({ ...prev, [field]: value }));
    } else if (section === 'notifications') {
      setNotificationPrefs((prev) => ({ ...prev, [field]: value }));
    } else if (section === 'appearance') {
      setAppearancePrefs((prev) => ({ ...prev, [field]: value }));
    } else if (section === 'language') {
      setLanguagePrefs((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Save handlers
  const handleSaveProfile = () => {
    // Simulate API call
    setTimeout(() => {
      setUnsavedChanges(false);
      toast({
        title: '✓ Profile saved successfully',
        description: 'Your profile information has been updated.',
        className: 'bg-green-500 text-white',
      });
    }, 500);
  };

  const handleSaveSecurity = () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast({
        title: "⚠️ Passwords don't match",
        description: 'New password and confirmation must match.',
        className: 'bg-red-500 text-white',
      });
      return;
    }

    setTimeout(() => {
      setUnsavedChanges(false);
      setSecurityData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      toast({
        title: '✓ Security settings saved',
        description: 'Your password has been updated successfully.',
        className: 'bg-green-500 text-white',
      });
    }, 500);
  };

  const handleSaveNotifications = () => {
    setTimeout(() => {
      setUnsavedChanges(false);
      toast({
        title: '✓ Notification preferences saved',
        description: 'Your notification settings have been updated.',
        className: 'bg-green-500 text-white',
      });
    }, 500);
  };

  const handleSaveAppearance = () => {
    setTimeout(() => {
      setUnsavedChanges(false);
      toast({
        title: '✓ Appearance settings saved',
        description: 'Your theme preferences have been applied.',
        className: 'bg-green-500 text-white',
      });
    }, 500);
  };

  const handleSaveLanguage = () => {
    setTimeout(() => {
      setUnsavedChanges(false);
      toast({
        title: '✓ Language settings saved',
        description: 'Your language and region preferences have been updated.',
        className: 'bg-green-500 text-white',
      });
    }, 500);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', icon: '👤', label: 'Profile' },
    { id: 'security', icon: '🔒', label: 'Security' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'billing', icon: '💳', label: 'Billing' },
    { id: 'appearance', icon: '🎨', label: 'Appearance' },
    { id: 'language', icon: '🌐', label: 'Language' },
    { id: 'help', icon: '❓', label: 'Help & Support' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <nav className="text-sm text-gray-500 mb-4">
          Dashboard &gt; Settings
        </nav>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">⚙️ Settings</h1>
        <p className="text-gray-600 mb-8">
          Manage your account settings and preferences
        </p>

        {/* Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Tabs (Desktop) */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-md p-4 sticky top-4">
              <nav className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as TabType)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-xl">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="lg:hidden overflow-x-auto">
            <div className="flex gap-2 pb-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as TabType)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border-2 border-gray-200 text-gray-700'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="text-sm">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-md p-6 md:p-8 min-h-[600px]">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">
                    Profile Information
                  </h2>

                  {/* Profile Photo */}
                  <div className="mb-6">
                    <Label className="text-sm font-semibold mb-3 block">
                      Profile Photo
                    </Label>
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-3xl overflow-hidden">
                          <User className="w-12 h-12 text-blue-600" />
                        </div>
                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <span className="text-white text-xs font-semibold">
                            Change
                          </span>
                        </div>
                      </div>
                      <div>
                        <Button variant="outline" size="sm">
                          Upload Photo
                        </Button>
                        <p className="text-xs text-gray-500 mt-1">
                          JPG, PNG or GIF. Max 2MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  {/* Form Fields */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        value={profileData.fullName}
                        onChange={(e) =>
                          handleInputChange(
                            'profile',
                            'fullName',
                            e.target.value
                          )
                        }
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">Email</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="email"
                          type="email"
                          value={profileData.email}
                          onChange={(e) =>
                            handleInputChange(
                              'profile',
                              'email',
                              e.target.value
                            )
                          }
                          className="flex-1"
                        />
                        <Badge className="bg-green-100 text-green-800 self-center">
                          ✓ Verified
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={profileData.username}
                        onChange={(e) =>
                          handleInputChange(
                            'profile',
                            'username',
                            e.target.value
                          )
                        }
                        className="mt-1"
                      />
                      <p className="text-xs text-green-600 mt-1">✓ Available</p>
                    </div>

                    <div>
                      <Label htmlFor="bio">Bio (Optional)</Label>
                      <Textarea
                        id="bio"
                        value={profileData.bio}
                        onChange={(e) =>
                          handleInputChange('profile', 'bio', e.target.value)
                        }
                        className="mt-1"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="company">
                        Company/Organization (Optional)
                      </Label>
                      <Input
                        id="company"
                        value={profileData.company}
                        onChange={(e) =>
                          handleInputChange(
                            'profile',
                            'company',
                            e.target.value
                          )
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 mt-8">
                    <Button
                      variant="outline"
                      onClick={() => setUnsavedChanges(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveProfile}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">Security Settings</h2>

                  {/* Change Password */}
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">
                      Change Password
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="currentPassword">
                          Current Password
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            id="currentPassword"
                            type={showPasswords.current ? 'text' : 'password'}
                            value={securityData.currentPassword}
                            onChange={(e) =>
                              handleInputChange(
                                'security',
                                'currentPassword',
                                e.target.value
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowPasswords((prev) => ({
                                ...prev,
                                current: !prev.current,
                              }))
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPasswords.current ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative mt-1">
                          <Input
                            id="newPassword"
                            type={showPasswords.new ? 'text' : 'password'}
                            value={securityData.newPassword}
                            onChange={(e) =>
                              handleInputChange(
                                'security',
                                'newPassword',
                                e.target.value
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowPasswords((prev) => ({
                                ...prev,
                                new: !prev.new,
                              }))
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPasswords.new ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {securityData.newPassword && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">
                                Password strength:
                              </span>
                              <span className="text-green-600 font-semibold">
                                Strong
                              </span>
                            </div>
                            <Progress value={75} className="h-1" />
                          </div>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="confirmPassword">
                          Confirm New Password
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            id="confirmPassword"
                            type={showPasswords.confirm ? 'text' : 'password'}
                            value={securityData.confirmPassword}
                            onChange={(e) =>
                              handleInputChange(
                                'security',
                                'confirmPassword',
                                e.target.value
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowPasswords((prev) => ({
                                ...prev,
                                confirm: !prev.confirm,
                              }))
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPasswords.confirm ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <Button
                        onClick={handleSaveSecurity}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Update Password
                      </Button>
                    </div>
                  </section>

                  <Separator className="my-8" />

                  {/* Two-Factor Authentication */}
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">
                      Two-Factor Authentication
                    </h3>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-semibold">2FA Status</p>
                        <p className="text-sm text-gray-600">
                          {securityData.twoFactorEnabled
                            ? 'Enabled'
                            : 'Disabled'}
                        </p>
                      </div>
                      <Switch
                        checked={securityData.twoFactorEnabled}
                        onCheckedChange={(checked) =>
                          handleInputChange(
                            'security',
                            'twoFactorEnabled',
                            checked
                          )
                        }
                      />
                    </div>
                    {!securityData.twoFactorEnabled && (
                      <Button variant="outline" className="mt-4">
                        Enable 2FA
                      </Button>
                    )}
                  </section>

                  <Separator className="my-8" />

                  {/* Active Sessions */}
                  <section>
                    <h3 className="text-lg font-semibold mb-4">
                      Active Sessions
                    </h3>
                    <div className="space-y-3">
                      {[
                        {
                          device: 'Chrome on MacOS',
                          location: 'New York, US',
                          lastActive: 'Current session',
                        },
                        {
                          device: 'Safari on iPhone',
                          location: 'New York, US',
                          lastActive: '2 hours ago',
                        },
                      ].map((session, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Laptop className="w-5 h-5 text-gray-500" />
                            <div>
                              <p className="font-semibold text-sm">
                                {session.device}
                              </p>
                              <p className="text-xs text-gray-600">
                                {session.location} • {session.lastActive}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button variant="destructive" className="mt-4">
                      Sign Out All Devices
                    </Button>
                  </section>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">
                    Notification Preferences
                  </h2>

                  {/* Alert Notifications */}
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">
                      Alert Notifications
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label
                            htmlFor="emailNotifications"
                            className="font-semibold"
                          >
                            Email notifications
                          </Label>
                          <p className="text-sm text-gray-600">
                            Receive notifications via email
                          </p>
                        </div>
                        <Switch
                          id="emailNotifications"
                          checked={notificationPrefs.emailNotifications}
                          onCheckedChange={(checked) =>
                            handleInputChange(
                              'notifications',
                              'emailNotifications',
                              checked
                            )
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label
                            htmlFor="pushNotifications"
                            className="font-semibold"
                          >
                            Push notifications
                          </Label>
                          <p className="text-sm text-gray-600">
                            Receive push notifications in your browser
                          </p>
                        </div>
                        <Switch
                          id="pushNotifications"
                          checked={notificationPrefs.pushNotifications}
                          onCheckedChange={(checked) =>
                            handleInputChange(
                              'notifications',
                              'pushNotifications',
                              checked
                            )
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <Label className="font-semibold flex items-center gap-2">
                            SMS notifications
                            <Badge variant="secondary">🔒 PRO</Badge>
                          </Label>
                          <p className="text-sm text-gray-600">
                            Receive notifications via SMS
                          </p>
                        </div>
                        <Switch
                          disabled
                          checked={notificationPrefs.smsNotifications}
                        />
                      </div>
                    </div>
                  </section>

                  <Separator className="my-8" />

                  {/* Newsletter */}
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Newsletter</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label
                            htmlFor="tradingTips"
                            className="font-semibold"
                          >
                            Trading tips & market insights
                          </Label>
                          <p className="text-sm text-gray-600">
                            Get expert trading advice
                          </p>
                        </div>
                        <Switch
                          id="tradingTips"
                          checked={notificationPrefs.tradingTips}
                          onCheckedChange={(checked) =>
                            handleInputChange(
                              'notifications',
                              'tradingTips',
                              checked
                            )
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label
                            htmlFor="productUpdates"
                            className="font-semibold"
                          >
                            Product updates
                          </Label>
                          <p className="text-sm text-gray-600">
                            Stay updated on new features
                          </p>
                        </div>
                        <Switch
                          id="productUpdates"
                          checked={notificationPrefs.productUpdates}
                          onCheckedChange={(checked) =>
                            handleInputChange(
                              'notifications',
                              'productUpdates',
                              checked
                            )
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label
                            htmlFor="promotionalOffers"
                            className="font-semibold"
                          >
                            Promotional offers
                          </Label>
                          <p className="text-sm text-gray-600">
                            Receive special deals and discounts
                          </p>
                        </div>
                        <Switch
                          id="promotionalOffers"
                          checked={notificationPrefs.promotionalOffers}
                          onCheckedChange={(checked) =>
                            handleInputChange(
                              'notifications',
                              'promotionalOffers',
                              checked
                            )
                          }
                        />
                      </div>
                    </div>
                  </section>

                  <Separator className="my-8" />

                  {/* Frequency */}
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">
                      Notification Frequency
                    </h3>
                    <Select
                      value={notificationPrefs.frequency}
                      onValueChange={(value) =>
                        handleInputChange('notifications', 'frequency', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instant">Instant</SelectItem>
                        <SelectItem value="daily">Daily digest</SelectItem>
                        <SelectItem value="weekly">Weekly summary</SelectItem>
                      </SelectContent>
                    </Select>
                  </section>

                  <Button
                    onClick={handleSaveNotifications}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Save Preferences
                  </Button>
                </div>
              )}

              {/* Billing Tab - ENHANCED WITH SYSTEMCONFIG */}
              {activeTab === 'billing' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">
                    Billing & Subscription
                  </h2>

                  {/* Current Plan Card */}
                  <Card className="border-2 border-blue-600 rounded-xl mb-6">
                    <CardContent className="p-6">
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge className="bg-blue-100 text-blue-800">
                          Current Plan
                        </Badge>
                        {hasDiscount && (
                          <Badge className="bg-green-100 text-green-800">
                            🎉 {discountPercent}% AFFILIATE DISCOUNT
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-2xl font-bold mt-4">Pro Plan</h3>

                      {/* Pricing */}
                      <div className="flex items-baseline gap-3 mt-2">
                        {hasDiscount && (
                          <span className="text-2xl text-gray-400 line-through">
                            ${basePrice.toFixed(2)}
                          </span>
                        )}
                        <span
                          className={`text-4xl font-bold ${hasDiscount ? 'text-green-600' : ''}`}
                        >
                          $
                          {hasDiscount
                            ? discountedPrice.toFixed(2)
                            : basePrice.toFixed(2)}
                        </span>
                        <span className="text-gray-600">/month</span>
                      </div>

                      {hasDiscount && (
                        <p className="text-sm text-green-600 mt-1">
                          You save ${monthlySavings.toFixed(2)}/month with
                          referral code
                        </p>
                      )}

                      {/* Features */}
                      <ul className="space-y-2 mt-4">
                        <li className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          15 Symbols
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />9
                          Timeframes (M5-D1)
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          20 Alerts
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Advanced charting tools
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Priority support
                        </li>
                      </ul>

                      <p className="text-sm text-gray-600 mt-4">
                        Next billing date: January 15, 2025
                        {hasDiscount &&
                          ` ($${basePrice.toFixed(2)} without new code, or $${discountedPrice.toFixed(2)} if you apply a new code at renewal)`}
                      </p>

                      {/* Affiliate discount details */}
                      {hasDiscount && (
                        <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-lg mt-4">
                          <div className="flex items-start gap-2">
                            <span>ℹ️</span>
                            <div>
                              <p className="font-semibold text-green-800 text-sm">
                                Discount Applied This Month
                              </p>
                              <p className="text-green-700 text-xs mt-1">
                                Applied with code: {affiliateDiscount!.code}
                              </p>
                              <p className="text-green-600 text-xs italic mt-1">
                                Your code gave you {discountPercent}% off this
                                payment. Find new codes on social media monthly
                                to keep saving!
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Affiliate Benefits Section */}
                  {hasDiscount && (
                    <section className="mb-6">
                      <h3 className="text-lg font-semibold mb-4">
                        🎁 Your Affiliate Benefits
                      </h3>
                      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
                        <CardContent className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Stat 1 - Total Saved */}
                            <div>
                              <p className="text-sm text-gray-600 mb-1">
                                Total Saved So Far
                              </p>
                              <p className="text-3xl font-bold text-green-600">
                                ${affiliateDiscount!.totalSaved.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Across {affiliateDiscount!.cyclesSaved} billing
                                cycles
                              </p>
                            </div>

                            {/* Stat 2 - Monthly Savings */}
                            <div>
                              <p className="text-sm text-gray-600 mb-1">
                                Monthly Savings
                              </p>
                              <p className="text-3xl font-bold text-blue-600">
                                ${monthlySavings.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {discountPercent}% off regular price
                              </p>
                            </div>

                            {/* Stat 3 - Code Used */}
                            <div>
                              <p className="text-sm text-gray-600 mb-1">
                                Code Used This Month
                              </p>
                              <div className="bg-white px-3 py-2 rounded-lg font-mono text-sm border border-gray-300 flex items-center justify-between">
                                <span>{affiliateDiscount!.code}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      affiliateDiscount!.code
                                    );
                                    toast({
                                      title: 'Code copied!',
                                      description:
                                        'Affiliate code copied to clipboard.',
                                    });
                                  }}
                                  className="ml-2"
                                >
                                  <Copy className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Find new codes on social media for next month's
                                discount
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  )}

                  {/* Payment Method */}
                  <section className="mb-6">
                    <h3 className="text-lg font-semibold mb-4">
                      💳 Payment Method
                    </h3>
                    <Card>
                      <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">💳</div>
                          <div>
                            <div className="text-lg font-semibold">
                              Visa ending in ****4242
                            </div>
                            <div className="text-sm text-gray-600">
                              Expires: 12/2026
                            </div>
                          </div>
                        </div>
                        <Button variant="outline">Update Card</Button>
                      </CardContent>
                    </Card>
                  </section>

                  {/* Usage Statistics */}
                  <section className="mb-6">
                    <h3 className="text-lg font-semibold mb-4">
                      📊 Usage Statistics
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-semibold">API Calls</span>
                          <span className="text-gray-600">8,456 / 10,000</span>
                        </div>
                        <Progress value={84.56} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-semibold">Alerts Sent</span>
                          <span className="text-gray-600">234 / Unlimited</span>
                        </div>
                        <Progress value={100} className="bg-green-100" />
                      </div>
                    </div>
                  </section>

                  {/* Billing History */}
                  <section className="mb-6">
                    <h3 className="text-lg font-semibold mb-4">
                      📋 Billing History
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                                Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                                Description
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                                Amount
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                                Invoice
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {[
                              { date: 'Dec 15, 2024', hasDiscount: true },
                              { date: 'Nov 15, 2024', hasDiscount: true },
                              { date: 'Oct 15, 2024', hasDiscount: true },
                            ].map((row, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm">
                                  {row.date}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {row.hasDiscount ? (
                                    <span className="flex items-center gap-1">
                                      Pro Plan ({discountPercent}% off)
                                      <span
                                        className="inline-block cursor-help"
                                        title={`Original: $${basePrice.toFixed(2)} | Discount: -$${monthlySavings.toFixed(2)} | Paid: $${discountedPrice.toFixed(2)}`}
                                      >
                                        ℹ️
                                      </span>
                                    </span>
                                  ) : (
                                    'Pro Plan'
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold">
                                  $
                                  {row.hasDiscount
                                    ? discountedPrice.toFixed(2)
                                    : basePrice.toFixed(2)}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className="bg-green-100 text-green-800">
                                    Paid
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <Button variant="ghost" size="sm">
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>

                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Manage Subscription
                  </Button>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">
                    Appearance Settings
                  </h2>

                  {/* Theme Selector */}
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Theme</h3>
                    <RadioGroup
                      value={appearancePrefs.theme}
                      onValueChange={(value) =>
                        handleInputChange('appearance', 'theme', value)
                      }
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Light Theme */}
                        <label
                          className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${appearancePrefs.theme === 'light' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold">Light</span>
                            <RadioGroupItem value="light" />
                          </div>
                          <div className="bg-white border rounded-lg p-4 space-y-2">
                            <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </label>

                        {/* Dark Theme */}
                        <label
                          className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${appearancePrefs.theme === 'dark' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold">Dark</span>
                            <RadioGroupItem value="dark" />
                          </div>
                          <div className="bg-gray-900 border rounded-lg p-4 space-y-2">
                            <div className="h-2 bg-gray-700 rounded w-3/4"></div>
                            <div className="h-2 bg-gray-700 rounded w-1/2"></div>
                          </div>
                        </label>

                        {/* System Theme */}
                        <label
                          className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${appearancePrefs.theme === 'system' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold">System</span>
                            <RadioGroupItem value="system" />
                          </div>
                          <div className="bg-gradient-to-r from-white to-gray-900 border rounded-lg p-4 space-y-2">
                            <div className="h-2 bg-gray-400 rounded w-3/4"></div>
                            <div className="h-2 bg-gray-400 rounded w-1/2"></div>
                          </div>
                        </label>
                      </div>
                    </RadioGroup>
                  </section>

                  <Separator className="my-8" />

                  {/* Color Scheme */}
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Color Scheme</h3>
                    <div className="flex gap-3">
                      {[
                        { name: 'blue', color: 'bg-blue-600' },
                        { name: 'purple', color: 'bg-purple-600' },
                        { name: 'green', color: 'bg-green-600' },
                        { name: 'orange', color: 'bg-orange-600' },
                      ].map((scheme) => (
                        <button
                          key={scheme.name}
                          onClick={() =>
                            handleInputChange(
                              'appearance',
                              'colorScheme',
                              scheme.name
                            )
                          }
                          className={`w-12 h-12 rounded-full ${scheme.color} ${appearancePrefs.colorScheme === scheme.name ? 'ring-4 ring-offset-2 ring-blue-600' : ''}`}
                        />
                      ))}
                    </div>
                  </section>

                  <Separator className="my-8" />

                  {/* Chart Preferences */}
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">
                      Chart Preferences
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label>Candlestick Colors</Label>
                        <div className="flex gap-4 mt-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-500 rounded"></div>
                            <span className="text-sm">Up</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-red-500 rounded"></div>
                            <span className="text-sm">Down</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label>Grid Line Opacity</Label>
                          <span className="text-sm text-gray-600">50%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          defaultValue="50"
                          className="w-full"
                        />
                      </div>
                    </div>
                  </section>

                  <Button
                    onClick={handleSaveAppearance}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Apply Changes
                  </Button>
                </div>
              )}

              {/* Language Tab */}
              {activeTab === 'language' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">Language & Region</h2>

                  <div className="space-y-6">
                    {/* Language */}
                    <div>
                      <Label htmlFor="language">Language</Label>
                      <Select
                        value={languagePrefs.language}
                        onValueChange={(value) =>
                          handleInputChange('language', 'language', value)
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
                          <SelectItem value="en-GB">🇬🇧 English (UK)</SelectItem>
                          <SelectItem value="es">🇪🇸 Español</SelectItem>
                          <SelectItem value="fr">🇫🇷 Français</SelectItem>
                          <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                          <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Timezone */}
                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select
                        value={languagePrefs.timezone}
                        onValueChange={(value) =>
                          handleInputChange('language', 'timezone', value)
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">
                            Eastern Time (ET)
                          </SelectItem>
                          <SelectItem value="America/Chicago">
                            Central Time (CT)
                          </SelectItem>
                          <SelectItem value="America/Denver">
                            Mountain Time (MT)
                          </SelectItem>
                          <SelectItem value="America/Los_Angeles">
                            Pacific Time (PT)
                          </SelectItem>
                          <SelectItem value="Europe/London">
                            London (GMT)
                          </SelectItem>
                          <SelectItem value="Europe/Paris">
                            Paris (CET)
                          </SelectItem>
                          <SelectItem value="Asia/Tokyo">
                            Tokyo (JST)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-600 mt-1">
                        Auto-detected from your browser
                      </p>
                    </div>

                    {/* Date Format */}
                    <div>
                      <Label htmlFor="dateFormat">Date Format</Label>
                      <Select
                        value={languagePrefs.dateFormat}
                        onValueChange={(value) =>
                          handleInputChange('language', 'dateFormat', value)
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Time Format */}
                    <div>
                      <Label htmlFor="timeFormat">Time Format</Label>
                      <Select
                        value={languagePrefs.timeFormat}
                        onValueChange={(value) =>
                          handleInputChange('language', 'timeFormat', value)
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12-hour</SelectItem>
                          <SelectItem value="24">24-hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Currency */}
                    <div>
                      <Label htmlFor="currency">Currency Display</Label>
                      <Select
                        value={languagePrefs.currency}
                        onValueChange={(value) =>
                          handleInputChange('language', 'currency', value)
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="JPY">JPY (¥)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveLanguage}
                    className="bg-blue-600 hover:bg-blue-700 mt-8"
                  >
                    Save Settings
                  </Button>
                </div>
              )}

              {/* Help & Support Tab */}
              {activeTab === 'help' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">Help & Support</h2>

                  {/* Quick Links */}
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📖</span>
                          <div className="text-left">
                            <div className="font-semibold">Documentation</div>
                            <div className="text-xs text-gray-600">
                              Browse our comprehensive guides
                            </div>
                          </div>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        className="justify-start h-auto py-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">💬</span>
                          <div className="text-left">
                            <div className="font-semibold">Live Chat</div>
                            <div className="text-xs text-gray-600">
                              Chat with our support team
                            </div>
                          </div>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        className="justify-start h-auto py-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📧</span>
                          <div className="text-left">
                            <div className="font-semibold">Email Support</div>
                            <div className="text-xs text-gray-600">
                              Send us a message
                            </div>
                          </div>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        className="justify-start h-auto py-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🐛</span>
                          <div className="text-left">
                            <div className="font-semibold">Report a Bug</div>
                            <div className="text-xs text-gray-600">
                              Help us improve
                            </div>
                          </div>
                        </div>
                      </Button>
                    </div>
                  </section>

                  <Separator className="my-8" />

                  {/* FAQ */}
                  <section className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">
                      Frequently Asked Questions
                    </h3>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger>
                          How do I upgrade to PRO?
                        </AccordionTrigger>
                        <AccordionContent>
                          You can upgrade to PRO by navigating to the Billing
                          tab and selecting the upgrade option. The process is
                          instant and you'll gain access to all PRO features
                          immediately.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-2">
                        <AccordionTrigger>How do alerts work?</AccordionTrigger>
                        <AccordionContent>
                          Alerts are triggered when specific market conditions
                          are met. You can set up custom alerts based on price
                          movements, technical indicators, or volume changes.
                          You'll receive notifications via your preferred
                          channels (email, push, or SMS for PRO users).
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-3">
                        <AccordionTrigger>
                          Can I change my email?
                        </AccordionTrigger>
                        <AccordionContent>
                          Yes, you can update your email address in the Profile
                          tab. After changing your email, you'll need to verify
                          the new address by clicking the link sent to your
                          inbox.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-4">
                        <AccordionTrigger>
                          How do I cancel my subscription?
                        </AccordionTrigger>
                        <AccordionContent>
                          You can cancel your subscription anytime from the
                          Billing tab by clicking "Manage Subscription". Your
                          access will continue until the end of your current
                          billing period.
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </section>

                  <Separator className="my-8" />

                  {/* Contact Form */}
                  <section>
                    <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="subject">Subject</Label>
                        <Select>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select a topic" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="technical">
                              Technical Issue
                            </SelectItem>
                            <SelectItem value="billing">
                              Billing Question
                            </SelectItem>
                            <SelectItem value="feature">
                              Feature Request
                            </SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                          id="message"
                          placeholder="Describe your issue or question..."
                          className="mt-1"
                          rows={5}
                        />
                      </div>

                      <Button className="bg-blue-600 hover:bg-blue-700">
                        Send Message
                      </Button>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
