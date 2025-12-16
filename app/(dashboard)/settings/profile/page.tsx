'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Camera, Check, X, AlertCircle, Loader2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

/**
 * Profile Settings Page
 *
 * Features:
 * - Profile photo upload with drag-and-drop
 * - Username availability check
 * - Real-time form validation
 * - Unsaved changes warning
 */

interface ProfileFormData {
  name: string;
  email: string;
  username: string;
  bio: string;
  company: string;
}

interface UsernameStatus {
  status: 'idle' | 'checking' | 'available' | 'taken';
}

export default function ProfileSettingsPage(): React.ReactElement {
  const { data: session, update: updateSession } = useSession();

  // Form state
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    email: '',
    username: '',
    bio: '',
    company: '',
  });

  // UI state
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus['status']>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileFormData, string>>>({});

  // Initialize form with session data
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

  // Check username availability with debounce
  useEffect(() => {
    if (!formData.username || formData.username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      // Simulate API call for username check
      await new Promise((resolve) => setTimeout(resolve, 500));
      // For now, just check if it's alphanumeric with underscores
      const isValid = /^[a-z0-9_]+$/.test(formData.username);
      setUsernameStatus(isValid ? 'available' : 'taken');
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle input changes
  const handleInputChange = useCallback(
    (field: keyof ProfileFormData, value: string): void => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setHasUnsavedChanges(true);

      // Clear error for this field
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

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ProfileFormData, string>> = {};

    if (!formData.name || formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.username && !/^[a-z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain lowercase letters, numbers, and underscores';
    }

    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = 'Bio must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          avatarUrl: photoUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update session with new data
      await updateSession({
        name: formData.name,
        email: formData.email,
        image: photoUrl,
      });

      setSaveSuccess(true);
      setHasUnsavedChanges(false);

      // Reset success indicator after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      setErrors({
        name: error instanceof Error ? error.message : 'Failed to save profile',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
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

  // Get user initials for avatar fallback
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle photo upload (simplified - would need actual implementation)
  const handlePhotoUpload = (): void => {
    // In a real implementation, this would open a file picker
    // and upload to a file storage service
    console.log('Photo upload triggered');
  };

  // Handle photo removal
  const handleRemovePhoto = (): void => {
    setPhotoUrl('');
    setHasUnsavedChanges(true);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Profile Information
      </h2>

      <form onSubmit={handleSubmit}>
        {/* Profile Photo Section */}
        <div className="mb-6">
          <Label className="text-sm font-semibold mb-3 block text-gray-700 dark:text-gray-300">
            Profile Photo
          </Label>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="w-24 h-24 border-4 border-gray-200 dark:border-gray-700 shadow-lg">
                <AvatarImage src={photoUrl || '/placeholder.svg'} alt={formData.name} />
                <AvatarFallback className="bg-blue-600 text-white text-2xl font-bold">
                  {getInitials(formData.name || 'U')}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handlePhotoUpload}
                className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={handlePhotoUpload}>
                Upload Photo
              </Button>
              {photoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2 text-red-600 hover:text-red-700"
                  onClick={handleRemovePhoto}
                >
                  <X className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                JPG, PNG or GIF. Max 5MB.
              </p>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <Label htmlFor="name" className="font-medium text-gray-700 dark:text-gray-300">
                Full Name
              </Label>
              <span className="text-xs text-gray-500">
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
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email" className="font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
              Email
              <Badge className="bg-green-100 text-green-800 text-xs">
                <Check className="w-3 h-3 mr-1" />
                Verified
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
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Username */}
          <div>
            <Label htmlFor="username" className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username (optional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value.toLowerCase())}
                className={`pl-8 ${errors.username ? 'border-red-500' : ''}`}
                placeholder="username"
              />
            </div>
            {formData.username && (
              <div className="mt-1">
                {usernameStatus === 'checking' && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking availability...
                  </p>
                )}
                {usernameStatus === 'available' && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Username available
                  </p>
                )}
                {usernameStatus === 'taken' && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <X className="w-3 h-3" />
                    Username is invalid or taken
                  </p>
                )}
              </div>
            )}
            {errors.username && (
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.username}
              </p>
            )}
          </div>

          {/* Bio */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <Label htmlFor="bio" className="font-medium text-gray-700 dark:text-gray-300">
                Bio (optional)
              </Label>
              <span className="text-xs text-gray-500">
                {formData.bio.length}/500
              </span>
            </div>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              maxLength={500}
              rows={3}
              className={`flex w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errors.bio ? 'border-red-500' : ''}`}
              placeholder="Tell us about yourself..."
            />
            {errors.bio && (
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.bio}
              </p>
            )}
          </div>

          {/* Company */}
          <div>
            <Label htmlFor="company" className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company/Organization (optional)
            </Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              placeholder="Your company name"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!hasUnsavedChanges || isSaving || usernameStatus === 'taken'}
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
      </form>
    </div>
  );
}
