// lib/auth.js
import auth from '@react-native-firebase/auth';

export async function loginWithPhone(phoneNumber) {
  try {
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    return confirmation; // use this to verify OTP
  } catch (error) {
    console.error("Firebase login error:", error);
    throw error;
  }
}

export async function confirmOTP(confirmation, code) {
  try {
    const userCredential = await confirmation.confirm(code);
    return userCredential; // user logged in
  } catch (error) {
    console.error("OTP verification error:", error);
    throw error;
  }
}
