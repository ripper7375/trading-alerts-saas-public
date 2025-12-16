// Mock API functions for the profile settings

export async function checkUsernameAvailability(
  username: string
): Promise<boolean> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock taken usernames
  const takenUsernames = [
    'admin',
    'user',
    'test',
    'trading_pro',
    'market_guru',
  ];

  return !takenUsernames.includes(username.toLowerCase());
}

export async function uploadProfilePhoto(file: File): Promise<{ url: string }> {
  // Simulate upload delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // In production, this would upload to a storage service
  // For now, create a local URL
  const url = URL.createObjectURL(file);

  return { url };
}

export async function saveProfile(data: any): Promise<{ success: boolean }> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('Saving profile data:', data);

  // Mock successful save
  return { success: true };
}
