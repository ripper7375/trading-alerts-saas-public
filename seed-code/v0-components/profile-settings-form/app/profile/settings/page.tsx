'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { profileSchema, type ProfileSchemaType } from '@/lib/profile-schema';
import {
  mockUserData,
  countries,
  timezones,
  languages,
  currencies,
} from '@/lib/mock-data';
import {
  checkUsernameAvailability,
  uploadProfilePhoto,
  saveProfile,
} from '@/lib/mock-api';
import { PhotoUploadModal } from '@/components/photo-upload-modal';
import { UnsavedChangesModal } from '@/components/unsaved-changes-modal';
import { useToast } from '@/hooks/use-toast';

export default function ProfileSettingsPage() {
  const { toast } = useToast();
  const [photoUrl, setPhotoUrl] = useState(mockUserData.photoUrl);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProfileSchemaType>({
    resolver: zodResolver(profileSchema),
    defaultValues: mockUserData,
  });

  const watchedFields = watch();
  const fullNameLength = watchedFields.fullName?.length || 0;
  const bioLength = watchedFields.bio?.length || 0;
  const usernameValue = watchedFields.username || '';

  // Check username availability
  useEffect(() => {
    if (!usernameValue || usernameValue === mockUserData.username) {
      setUsernameStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      const isAvailable = await checkUsernameAvailability(usernameValue);
      setUsernameStatus(isAvailable ? 'available' : 'taken');
    }, 500);

    return () => clearTimeout(timer);
  }, [usernameValue]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handlePhotoUpload = async (file: File) => {
    const result = await uploadProfilePhoto(file);
    setPhotoUrl(result.url);
    setValue('photoUrl', result.url, { shouldDirty: true });

    toast({
      title: 'Photo uploaded successfully!',
      description: 'Your profile photo has been updated.',
      duration: 3000,
    });
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    setValue('photoUrl', '', { shouldDirty: true });
  };

  const onSubmit = async (data: ProfileSchemaType) => {
    setIsSaving(true);
    try {
      await saveProfile({ ...data, photoUrl });
      setSaveSuccess(true);
      setHasUnsavedChanges(false);

      toast({
        title: '✓ Profile updated successfully!',
        description: 'Your changes have been saved.',
        duration: 3000,
      });

      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      toast({
        title: 'Failed to save profile',
        description: 'Please try again later.',
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setIsUnsavedModalOpen(true);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCurrentTime = (timezone: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: watchedFields.timeFormat === '12h',
      }).format(new Date());
    } catch {
      return '--:--';
    }
  };

  const getDatePreview = (format: string) => {
    const date = new Date(2025, 0, 15);
    const month = '01';
    const day = '15';
    const year = '2025';

    switch (format) {
      case 'MDY':
        return `${month}/${day}/${year}`;
      case 'DMY':
        return `${day}/${month}/${year}`;
      case 'YMD':
        return `${year}-${month}-${day}`;
      default:
        return 'January 15, 2025';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto mb-20">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">
            Profile Information
          </h1>

          {/* Profile Photo Section */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Profile Photo
            </h2>
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="relative group">
                <Avatar className="w-32 h-32 border-4 border-gray-200 shadow-lg">
                  <AvatarImage
                    src={photoUrl || '/placeholder.svg'}
                    alt={watchedFields.fullName}
                  />
                  <AvatarFallback className="bg-blue-600 text-white text-4xl font-bold">
                    {getInitials(watchedFields.fullName || 'JT')}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <div className="text-center text-white">
                    <Camera className="w-8 h-8 mx-auto mb-1 opacity-80" />
                    <p className="text-xs font-medium">Change Photo</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <p className="text-sm text-gray-600">
                  Upload a professional photo to personalize your profile
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => setIsPhotoModalOpen(true)}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Upload New Photo
                  </Button>
                  {photoUrl && (
                    <Button
                      type="button"
                      onClick={handleRemovePhoto}
                      variant="outline"
                      className="border-gray-300 text-gray-700 hover:border-red-500 hover:text-red-600 bg-transparent"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove Photo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information Section */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Personal Information
            </h2>
            <div className="space-y-6">
              {/* Full Name */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label
                    htmlFor="fullName"
                    className="font-medium text-gray-700"
                  >
                    Full Name
                  </Label>
                  <span className="text-xs text-gray-500">
                    {fullNameLength}/50
                  </span>
                </div>
                <Input
                  id="fullName"
                  placeholder="John Trader"
                  {...register('fullName')}
                  className={errors.fullName ? 'border-red-500' : ''}
                />
                {errors.fullName && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <Label
                  htmlFor="email"
                  className="font-medium text-gray-700 mb-2 flex items-center gap-2"
                >
                  Email Address
                  {mockUserData.emailVerified && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  className={errors.email ? 'border-red-500' : ''}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used for login and notifications
                </p>
                <button
                  type="button"
                  className="text-blue-600 text-sm hover:underline mt-1"
                >
                  Change email address
                </button>
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Username */}
              <div>
                <Label
                  htmlFor="username"
                  className="font-medium text-gray-700 mb-2"
                >
                  Username (optional)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    @
                  </span>
                  <Input
                    id="username"
                    placeholder="john_trader"
                    {...register('username')}
                    className={`pl-8 ${errors.username ? 'border-red-500' : ''}`}
                  />
                </div>
                {usernameValue && usernameValue !== mockUserData.username && (
                  <div className="mt-1">
                    {usernameStatus === 'checking' && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking...
                      </p>
                    )}
                    {usernameStatus === 'available' && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Available
                      </p>
                    )}
                    {usernameStatus === 'taken' && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <X className="w-3 h-3" />
                        Username taken
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Your profile URL: tradingalerts.com/@
                  {usernameValue || 'your_username'}
                </p>
                {errors.username && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.username.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Professional Information Section */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Professional Information
            </h2>
            <div className="space-y-6">
              <div>
                <Label
                  htmlFor="company"
                  className="font-medium text-gray-700 mb-2"
                >
                  Company or Organization (optional)
                </Label>
                <Input
                  id="company"
                  placeholder="Acme Trading Co."
                  {...register('company')}
                />
              </div>

              <div>
                <Label
                  htmlFor="jobTitle"
                  className="font-medium text-gray-700 mb-2"
                >
                  Job Title (optional)
                </Label>
                <Input
                  id="jobTitle"
                  placeholder="Professional Trader"
                  {...register('jobTitle')}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="bio" className="font-medium text-gray-700">
                    Bio (optional)
                  </Label>
                  <span className="text-xs text-gray-500">{bioLength}/500</span>
                </div>
                <Textarea
                  id="bio"
                  rows={4}
                  placeholder="Tell us about yourself and your trading experience..."
                  {...register('bio')}
                  className={errors.bio ? 'border-red-500' : ''}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be visible on your public profile (if enabled)
                </p>
                {errors.bio && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.bio.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Location & Timezone Section */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Location & Timezone
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label
                  htmlFor="country"
                  className="font-medium text-gray-700 mb-2"
                >
                  Country/Region
                </Label>
                <Select
                  value={watchedFields.country}
                  onValueChange={(value) =>
                    setValue('country', value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.flag} {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.country.message}
                  </p>
                )}
              </div>

              <div>
                <Label
                  htmlFor="timezone"
                  className="font-medium text-gray-700 mb-2"
                >
                  Timezone
                </Label>
                <Select
                  value={watchedFields.timezone}
                  onValueChange={(value) =>
                    setValue('timezone', value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(
                      timezones.reduce(
                        (acc, tz) => {
                          if (!acc[tz.region]) acc[tz.region] = [];
                          acc[tz.region].push(tz);
                          return acc;
                        },
                        {} as Record<string, typeof timezones>
                      )
                    ).map(([region, tzs]) => (
                      <div key={region}>
                        <div className="px-2 py-1.5 text-sm font-semibold text-gray-900">
                          {region}
                        </div>
                        {tzs.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Current time: {getCurrentTime(watchedFields.timezone)}
                </p>
                {errors.timezone && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.timezone.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Preferences
            </h2>
            <div className="space-y-6">
              <div>
                <Label
                  htmlFor="language"
                  className="font-medium text-gray-700 mb-2"
                >
                  Language
                </Label>
                <Select
                  value={watchedFields.language}
                  onValueChange={(value) =>
                    setValue('language', value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-medium text-gray-700 mb-2 block">
                  Date Format
                </Label>
                <RadioGroup
                  value={watchedFields.dateFormat}
                  onValueChange={(value) =>
                    setValue('dateFormat', value as 'MDY' | 'DMY' | 'YMD', {
                      shouldDirty: true,
                    })
                  }
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="MDY" id="mdy" />
                    <Label htmlFor="mdy" className="font-normal cursor-pointer">
                      MM/DD/YYYY (01/15/2025)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DMY" id="dmy" />
                    <Label htmlFor="dmy" className="font-normal cursor-pointer">
                      DD/MM/YYYY (15/01/2025)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="YMD" id="ymd" />
                    <Label htmlFor="ymd" className="font-normal cursor-pointer">
                      YYYY-MM-DD (2025-01-15)
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-gray-500 mt-2">
                  Preview: {getDatePreview(watchedFields.dateFormat)}
                </p>
              </div>

              <div>
                <Label className="font-medium text-gray-700 mb-2 block">
                  Time Format
                </Label>
                <RadioGroup
                  value={watchedFields.timeFormat}
                  onValueChange={(value) =>
                    setValue('timeFormat', value as '12h' | '24h', {
                      shouldDirty: true,
                    })
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="12h" id="12h" />
                    <Label htmlFor="12h" className="font-normal cursor-pointer">
                      12-hour (2:30 PM)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="24h" id="24h" />
                    <Label htmlFor="24h" className="font-normal cursor-pointer">
                      24-hour (14:30)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label
                  htmlFor="currency"
                  className="font-medium text-gray-700 mb-2"
                >
                  Currency
                </Label>
                <Select
                  value={watchedFields.currency}
                  onValueChange={(value) =>
                    setValue('currency', value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((curr) => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.code} {curr.symbol} - {curr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Privacy Settings Section */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Privacy Settings
            </h2>
            <div className="space-y-6">
              <div>
                <Label className="font-medium text-gray-700 mb-2 block">
                  Profile Visibility
                </Label>
                <RadioGroup
                  value={watchedFields.profileVisibility}
                  onValueChange={(value) =>
                    setValue(
                      'profileVisibility',
                      value as 'public' | 'private' | 'connections',
                      { shouldDirty: true }
                    )
                  }
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem
                      value="public"
                      id="public"
                      className="mt-1"
                    />
                    <div>
                      <Label
                        htmlFor="public"
                        className="font-normal cursor-pointer"
                      >
                        Public
                      </Label>
                      <p className="text-sm text-gray-600 ml-0">
                        Anyone can view your profile and trading stats
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem
                      value="private"
                      id="private"
                      className="mt-1"
                    />
                    <div>
                      <Label
                        htmlFor="private"
                        className="font-normal cursor-pointer"
                      >
                        Private
                      </Label>
                      <p className="text-sm text-gray-600 ml-0">
                        Only you can see your profile
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem
                      value="connections"
                      id="connections"
                      className="mt-1"
                    />
                    <div>
                      <Label
                        htmlFor="connections"
                        className="font-normal cursor-pointer"
                      >
                        Connections Only
                      </Label>
                      <p className="text-sm text-gray-600 ml-0">
                        Only users you follow can view your profile
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="showStats"
                    checked={watchedFields.showStats}
                    onCheckedChange={(checked) =>
                      setValue('showStats', checked as boolean, {
                        shouldDirty: true,
                      })
                    }
                  />
                  <div>
                    <Label
                      htmlFor="showStats"
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      Show my trading statistics on public profile
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Includes total alerts, chart views, and join date
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="showEmail"
                    checked={watchedFields.showEmail}
                    onCheckedChange={(checked) =>
                      setValue('showEmail', checked as boolean, {
                        shouldDirty: true,
                      })
                    }
                  />
                  <div>
                    <Label
                      htmlFor="showEmail"
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      Make my email address public
                    </Label>
                    <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Not recommended for privacy reasons
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Social Links Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Social Links (Optional)
            </h2>
            <div className="space-y-6">
              <div>
                <Label
                  htmlFor="socialTwitter"
                  className="font-medium text-gray-700 mb-2"
                >
                  Twitter/X (optional)
                </Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    https://twitter.com/
                  </span>
                  <Input
                    id="socialTwitter"
                    placeholder="username"
                    {...register('socialTwitter')}
                    className="rounded-l-none"
                  />
                </div>
                {errors.socialTwitter && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.socialTwitter.message}
                  </p>
                )}
              </div>

              <div>
                <Label
                  htmlFor="socialLinkedIn"
                  className="font-medium text-gray-700 mb-2"
                >
                  LinkedIn (optional)
                </Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    https://linkedin.com/in/
                  </span>
                  <Input
                    id="socialLinkedIn"
                    placeholder="username"
                    {...register('socialLinkedIn')}
                    className="rounded-l-none"
                  />
                </div>
                {errors.socialLinkedIn && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.socialLinkedIn.message}
                  </p>
                )}
              </div>

              <div>
                <Label
                  htmlFor="socialWebsite"
                  className="font-medium text-gray-700 mb-2"
                >
                  Website (optional)
                </Label>
                <Input
                  id="socialWebsite"
                  placeholder="https://yourwebsite.com"
                  {...register('socialWebsite')}
                />
                {errors.socialWebsite && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.socialWebsite.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-6 shadow-lg z-10">
          <div className="max-w-4xl mx-auto flex justify-end gap-4">
            <Button
              type="button"
              onClick={handleCancel}
              variant="outline"
              className="px-6 py-3 bg-transparent"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 font-semibold shadow-lg"
              disabled={!isDirty || isSaving || usernameStatus === 'taken'}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Saved!
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </form>

      <PhotoUploadModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onUpload={handlePhotoUpload}
      />

      <UnsavedChangesModal
        isOpen={isUnsavedModalOpen}
        onStayAndSave={() => {
          setIsUnsavedModalOpen(false);
          handleSubmit(onSubmit)();
        }}
        onLeave={() => {
          setIsUnsavedModalOpen(false);
          window.location.reload();
        }}
        onCancel={() => setIsUnsavedModalOpen(false)}
      />
    </div>
  );
}
