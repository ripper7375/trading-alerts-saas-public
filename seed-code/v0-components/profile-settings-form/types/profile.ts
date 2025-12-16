export interface ProfileFormData {
  fullName: string;
  email: string;
  username?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  country: string;
  timezone: string;
  language: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  currency: string;
  profileVisibility: 'public' | 'private' | 'connections';
  showStats: boolean;
  showEmail: boolean;
  socialTwitter?: string;
  socialLinkedIn?: string;
  socialWebsite?: string;
  photoUrl?: string;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export interface Timezone {
  value: string;
  label: string;
  region: string;
}
