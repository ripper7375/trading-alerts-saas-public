'use client';

// Cookie utility for theme persistence across apps
export function setThemeCookie(theme: string) {
  // Set cookie with SameSite=Lax to work across ports on localhost
  document.cookie = `davintrade-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

export function getThemeCookie(): string | null {
  const match = document.cookie.match(/davintrade-theme=([^;]+)/);
  return match ? match[1] : null;
}
