import messaging from '@react-native-firebase/messaging';

// Get the current device's FCM token
export async function getFCMToken() {
  try {
    const token = await messaging().getToken();
    console.log("📲 FCM Token:", token);
    return token;
  } catch (err) {
    console.error("❌ Error getting FCM token", err);
  }
}

// Listen for foreground push notifications
export function setupForegroundHandler() {
  messaging().onMessage(async remoteMessage => {
    console.log("📩 Received foreground message:", remoteMessage);
    // here you can show an Alert, Toast, or update state
  });
}
