// Capacitor Native Mobile Bridge (StatusBar, Splash, FCM Push)
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export const initCapacitor = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[DavinTrade Mobile] Running in Web / PWA mode');
    return;
  }

  console.log(
    '[DavinTrade Mobile] Native Platform Detected:',
    Capacitor.getPlatform()
  );

  try {
    // Register Push Notifications permissions
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive === 'granted') {
      await PushNotifications.register();

      PushNotifications.addListener('registration', (token) => {
        console.log('[DavinTrade FCM] Token Registered:', token.value);
      });

      PushNotifications.addListener(
        'pushNotificationReceived',
        (notification) => {
          console.log(
            '[DavinTrade FCM] Push Received Foreground:',
            notification
          );
        }
      );

      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action) => {
          console.log('[DavinTrade FCM] Action Performed:', action);
        }
      );
    }
  } catch (e) {
    console.warn('[DavinTrade Capacitor] Push setup notice:', e);
  }
};
