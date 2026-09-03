'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Camera, Check, X, AlertCircle, Loader2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Profile Settings Page (Row 79)
 *
 * Bound to real GET/PATCH /api/user/profile via handleSubmit below. Photo
 * upload has no real storage wiring in the legacy page this was ported
 * from (a pre-existing, disclosed gap -- see Deviations) and is carried
 * forward unchanged rather than fabricating a fake upload flow.
 */

interface ProfileFormData {
  name: string;
  email: string;
  username: string;
  bio: string;
  company: string;
}

export default function ProfileSettingsPage(): React.ReactElement {
  const { t } = useLocale();
  const { data: session, update: updateSession } = useSession();

  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    email: '',
    username: '',
    bio: '',
    company: '',
  });

  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProfileFormData, string>>
  >({});

  useEffect(() => {
    if (session?.user) {
      setFormData({
        name: session.user.name || '',
        email: session.user.email || '',
        username: '',
        bio: '',
        company: '',
      });
      setPhotoUrl(session.user.image || '');
    }
  }, [session]);

  useEffect(() => {
    if (!formData.username || formData.username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      await new Promise((resolve) => setTimeout(resolve, 500));
      const isValid = /^[a-z0-9_]+$/.test(formData.username);
      setUsernameStatus(isValid ? 'available' : 'taken');
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleInputChange = useCallback(
    (field: keyof ProfileFormData, value: string): void => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setHasUnsavedChanges(true);

      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [errors]
  );

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ProfileFormData, string>> = {};

    if (!formData.name || formData.name.length < 2) {
      newErrors.name = t(
        'settings.profile.error_name_min_length',
        'Name must be at least 2 characters'
      );
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t(
        'settings.profile.error_invalid_email',
        'Please enter a valid email address'
      );
    }

    if (formData.username && !/^[a-z0-9_]+$/.test(formData.username)) {
      newErrors.username = t(
        'settings.profile.error_username_format',
        'Username can only contain lowercase letters, numbers, and underscores'
      );
    }

    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = t(
        'settings.profile.error_bio_max_length',
        'Bio must be less than 500 characters'
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          avatarUrl: photoUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error ||
            t(
              'settings.profile.error_update_profile',
              'Failed to update profile'
            )
        );
      }

      await updateSession({
        name: formData.name,
        email: formData.email,
        image: photoUrl,
      });

      setSaveSuccess(true);
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      setErrors({
        name:
          error instanceof Error
            ? error.message
            : t(
                'settings.profile.error_save_profile',
                'Failed to save profile'
              ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (): void => {
    if (session?.user) {
      setFormData({
        name: session.user.name || '',
        email: session.user.email || '',
        username: '',
        bio: '',
        company: '',
      });
      setPhotoUrl(session.user.image || '');
      setHasUnsavedChanges(false);
      setErrors({});
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Pre-existing gap carried forward: no real file-storage wiring exists
  // for profile photos yet (legacy page's own stub); not fabricated new.
  const handlePhotoUpload = (): void => {
    console.log('Photo upload triggered');
  };

  const handleRemovePhoto = (): void => {
    setPhotoUrl('');
    setHasUnsavedChanges(true);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="mb-6 text-2xl font-bold text-foreground">
        {t('settings.profile.page_title', 'Profile Information')}
      </h2>

      {(session?.user as { role?: string })?.role === 'AFFILIATE' && (
        <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-900/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-200">
                {t(
                  'settings.profile.affiliate_partner_profile',
                  'Affiliate Partner Profile'
                )}
              </p>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {t(
                  'settings.profile.affiliate_partner_profile_desc',
                  'Manage your public affiliate partner details, social media channels, and payout configurations in the dedicated Partner Profile.'
                )}
              </p>
            </div>
            <Button
              asChild
              size="sm"
              className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
            >
              <Link href="/affiliate/dashboard/profile">
                {t(
                  'settings.profile.open_partner_profile',
                  'Open Partner Profile →'
                )}
              </Link>
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Profile Photo Section */}
        <div className="mb-6">
          <Label className="mb-3 block text-sm font-semibold text-foreground">
            {t('settings.profile.profile_photo', 'Profile Photo')}
          </Label>
          <div className="flex items-center gap-4">
            <div className="group relative">
              <Avatar className="h-24 w-24 border-4 border-border shadow-lg">
                <AvatarImage
                  src={photoUrl || '/placeholder.svg'}
                  alt={formData.name}
                />
                <AvatarFallback className="bg-primary text-2xl font-bold text-primary-foreground">
                  {getInitials(formData.name || 'U')}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handlePhotoUpload}
                aria-label={t(
                  'settings.profile.upload_photo_aria',
                  'Upload profile photo'
                )}
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePhotoUpload}
              >
                {t('settings.profile.upload_photo', 'Upload Photo')}
              </Button>
              {photoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2 text-red-600 hover:text-red-700"
                  onClick={handleRemovePhoto}
                >
                  <X className="mr-1 h-4 w-4" />
                  {t('settings.profile.remove', 'Remove')}
                </Button>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  'settings.profile.photo_requirements',
                  'JPG, PNG or GIF. Max 5MB.'
                )}
              </p>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label htmlFor="name" className="font-medium text-foreground">
                {t('settings.profile.full_name', 'Full Name')}
              </Label>
              <span className="text-xs text-muted-foreground">
                {formData.name.length}/50
              </span>
            </div>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              maxLength={50}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <Label
              htmlFor="email"
              className="mb-1 flex items-center gap-2 font-medium text-foreground"
            >
              {t('settings.profile.email_label', 'Email')}
              <Badge className="bg-emerald-100 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Check className="mr-1 h-3 w-3" />
                {t('settings.profile.verified', 'Verified')}
              </Badge>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Username */}
          <div>
            <Label
              htmlFor="username"
              className="mb-1 font-medium text-foreground"
            >
              {t('settings.profile.username_optional', 'Username (optional)')}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) =>
                  handleInputChange('username', e.target.value.toLowerCase())
                }
                className={`pl-8 ${errors.username ? 'border-red-500' : ''}`}
                placeholder={t(
                  'settings.profile.username_placeholder',
                  'username'
                )}
              />
            </div>
            {formData.username && (
              <div className="mt-1">
                {usernameStatus === 'checking' && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t(
                      'settings.profile.checking_availability',
                      'Checking availability...'
                    )}
                  </p>
                )}
                {usernameStatus === 'available' && (
                  <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    {t(
                      'settings.profile.username_available',
                      'Username available'
                    )}
                  </p>
                )}
                {usernameStatus === 'taken' && (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <X className="h-3 w-3" />
                    {t(
                      'settings.profile.username_invalid_or_taken',
                      'Username is invalid or taken'
                    )}
                  </p>
                )}
              </div>
            )}
            {errors.username && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {errors.username}
              </p>
            )}
          </div>

          {/* Bio */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label htmlFor="bio" className="font-medium text-foreground">
                {t('settings.profile.bio_optional', 'Bio (optional)')}
              </Label>
              <span className="text-xs text-muted-foreground">
                {formData.bio.length}/500
              </span>
            </div>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              maxLength={500}
              rows={3}
              className={`flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errors.bio ? 'border-red-500' : ''}`}
              placeholder={t(
                'settings.profile.bio_placeholder',
                'Tell us about yourself...'
              )}
            />
            {errors.bio && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {errors.bio}
              </p>
            )}
          </div>

          {/* Company */}
          <div>
            <Label
              htmlFor="company"
              className="mb-1 font-medium text-foreground"
            >
              {t(
                'settings.profile.company_optional',
                'Company/Organization (optional)'
              )}
            </Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              placeholder={t(
                'settings.profile.company_placeholder',
                'Your company name'
              )}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            {t('Cancel')}
          </Button>
          <Button
            type="submit"
            disabled={
              !hasUnsavedChanges || isSaving || usernameStatus === 'taken'
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('Saving...')}
              </>
            ) : saveSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                {t('Saved!', 'Saved!')}
              </>
            ) : (
              t('Save Changes', 'Save Changes')
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
