// Native Mobile Haptic Feedback Engine

export const haptics = {
  /**
   * Light tap (button clicks, chip switches)
   */
  light: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium impact (drawer opens, price offsets)
   */
  medium: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(25);
    }
  },

  /**
   * Heavy impact (deleting an alert, 2FA confirm)
   */
  heavy: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([40, 30, 40]);
    }
  },

  /**
   * Success burst (alert armed, trade setup copied)
   */
  success: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([15, 50, 25]);
    }
  },

  /**
   * Price breach warning burst
   */
  warning: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([60, 40, 60, 40, 100]);
    }
  },
};
