/**
 * Affiliate Profile Page
 *
 * Displays and allows editing of affiliate profile information.
 * Shows personal details, social links, and account status.
 *
 * @module app/affiliate/dashboard/profile/page
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateProfile {
  id: string;
  fullName: string;
  country: string;
  status: string;
  paymentMethod: string;
  totalCodesDistributed: number;
  totalCodesUsed: number;
  totalEarnings: number;
  pendingCommissions: number;
  paidCommissions: number;
  createdAt: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Profile Page
 * View and edit affiliate profile
 */
export default function AffiliateProfilePage(): React.ReactElement {
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    country: '',
    twitterUrl: '',
    youtubeUrl: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
  });

  useEffect(() => {
    const fetchProfile = async (): Promise<void> => {
      try {
        const response = await fetch('/api/affiliate/profile');

        if (!response.ok) {
          throw new Error('Failed to load profile');
        }

        const data = await response.json();
        setProfile(data);
        setFormData({
          fullName: data.fullName || '',
          country: data.country || '',
          twitterUrl: data.twitterUrl || '',
          youtubeUrl: data.youtubeUrl || '',
          instagramUrl: data.instagramUrl || '',
          facebookUrl: data.facebookUrl || '',
          tiktokUrl: data.tiktokUrl || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/affiliate/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600">Manage your affiliate profile</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Personal Information
            </h2>
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            ) : (
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500">Full Name</dt>
                  <dd className="font-medium">{profile?.fullName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Country</dt>
                  <dd className="font-medium">{profile?.country}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        profile?.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : profile?.status === 'SUSPENDED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {profile?.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Member Since</dt>
                  <dd className="font-medium">
                    {profile?.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString()
                      : 'N/A'}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* Account Statistics */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Account Statistics
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Codes Distributed</dt>
                <dd className="font-medium">
                  {profile?.totalCodesDistributed || 0}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Codes Used</dt>
                <dd className="font-medium">{profile?.totalCodesUsed || 0}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Total Earnings</dt>
                <dd className="font-medium text-green-600">
                  ${(profile?.totalEarnings || 0).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Pending</dt>
                <dd className="font-medium text-yellow-600">
                  ${(profile?.pendingCommissions || 0).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Paid</dt>
                <dd className="font-medium">
                  ${(profile?.paidCommissions || 0).toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Social Media Links */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Social Media Links
        </h2>
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['twitter', 'youtube', 'instagram', 'facebook', 'tiktok'].map(
              (platform) => (
                <div key={platform}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {platform}
                  </label>
                  <input
                    type="url"
                    value={
                      formData[
                        `${platform}Url` as keyof typeof formData
                      ] as string
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [`${platform}Url`]: e.target.value,
                      })
                    }
                    placeholder={`https://${platform}.com/username`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'twitterUrl', label: 'Twitter' },
              { key: 'youtubeUrl', label: 'YouTube' },
              { key: 'instagramUrl', label: 'Instagram' },
              { key: 'facebookUrl', label: 'Facebook' },
              { key: 'tiktokUrl', label: 'TikTok' },
            ].map(({ key, label }) => (
              <div key={key}>
                <dt className="text-sm text-gray-500">{label}</dt>
                <dd className="font-medium">
                  {profile?.[key as keyof AffiliateProfile] ? (
                    <a
                      href={profile[key as keyof AffiliateProfile] as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {profile[key as keyof AffiliateProfile] as string}
                    </a>
                  ) : (
                    <span className="text-gray-400">Not set</span>
                  )}
                </dd>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Settings Link */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Payment Settings
            </h2>
            <p className="text-gray-600">
              Current method: {profile?.paymentMethod?.replace('_', ' ')}
            </p>
          </div>
          <Link
            href="/affiliate/dashboard/profile/payment"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
          >
            Manage Payment
          </Link>
        </div>
      </div>

      {/* Edit Actions */}
      {editing && (
        <div className="flex justify-end gap-4">
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
