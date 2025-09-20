// app.config.js
import 'dotenv/config';
import appJson from './app.json';

export default () => ({
  ...appJson,
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      // Use EAS secret for google-services.json
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON
    },
    ios: {
      ...appJson.expo.ios,
      // Keep static path for iOS plist
      googleServicesFile: "./ios/GoogleService-Info.plist"
    }
  }
});
