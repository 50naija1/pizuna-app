import React, { useState, useRef } from 'react';
import {
  View,
  Button,
  Text,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import PhoneInput from 'react-native-phone-number-input';
import OTPTextView from 'react-native-otp-textinput';
import { loginWithPhone, confirmOTP } from '../lib/auth';

export default function AuthScreen({ navigation }) {
  const phoneInput = useRef(null);
  const otpInput = useRef(null); // ref for clearing OTP

  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const [status, setStatus] = useState(null); // null | "loading" | "success" | "error"

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const [resendTimer, setResendTimer] = useState(0);

  const startResendTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    if (!phoneInput.current?.isValidNumber(phone)) {
      return Alert.alert('Invalid phone', 'Enter a valid phone number.');
    }

    try {
      const confirmationResult = await loginWithPhone(formattedPhone);
      setConfirmation(confirmationResult);
      Alert.alert('OTP sent!', `Check your phone (${formattedPhone}) for the code.`);
      startResendTimer();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send OTP');
    }
  };

  const runShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleVerifyOTP = async (code = otp) => {
    if (code.length < 6) {
      return Alert.alert('Invalid code', 'OTP must be 6 digits.');
    }

    try {
      setStatus('loading');
      if (!confirmation) return Alert.alert('Error', 'No OTP sent yet');
      await confirmOTP(confirmation, code);

      // Success → fade in ✅
      setStatus('success');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => navigation.replace('Contacts'), 800);
      });
    } catch (e) {
      // Error → ❌ + shake + auto-clear
      setStatus('error');
      runShake();

      // Clear OTP input + reset state
      otpInput.current?.clear();
      setOtp('');

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          setStatus(null);
          fadeAnim.setValue(0);
        }, 1200);
      });

      Alert.alert('Error', e.message || 'Invalid OTP');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {confirmation ? 'Verify your code' : 'Enter your phone number'}
      </Text>

      <View style={styles.card}>
        {!confirmation ? (
          <>
            <PhoneInput
              ref={phoneInput}
              defaultCode="NG"
              layout="first"
              value={phone}
              onChangeText={(text) => setPhone(text)}
              onChangeFormattedText={(text) => setFormattedPhone(text)}
              autoFocus
              containerStyle={styles.phoneInputContainer}
              textContainerStyle={styles.textContainer}
            />

            <Button title="Send OTP" onPress={handleSendOTP} />
          </>
        ) : (
          <>
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              <OTPTextView
                ref={otpInput}
                handleTextChange={(val) => {
                  setOtp(val);
                  if (val.length === 6) {
                    handleVerifyOTP(val);
                  }
                }}
                inputCount={6}
                keyboardType="number-pad"
                autoFocus
                containerStyle={styles.otpContainer}
                textInputStyle={styles.otpInput}
              />
            </Animated.View>

            {/* Loader + Status feedback */}
            {status === 'loading' && (
              <ActivityIndicator size="large" color="#1a73e8" style={{ marginTop: 15 }} />
            )}

            {status === 'success' && (
              <Animated.Text style={[styles.statusIcon, { opacity: fadeAnim }]}>
                ✅
              </Animated.Text>
            )}

            {status === 'error' && (
              <Animated.Text style={[styles.statusIcon, { opacity: fadeAnim, color: 'red' }]}>
                ❌
              </Animated.Text>
            )}

            {/* fallback button */}
            <Button title="Verify OTP" onPress={() => handleVerifyOTP()} disabled={status === 'loading'} />

            {resendTimer > 0 ? (
              <Text style={styles.resendText}>Resend available in {resendTimer}s</Text>
            ) : (
              <TouchableOpacity onPress={handleSendOTP} style={{ marginTop: 10 }}>
                <Text style={styles.resendLink}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'flex-end', backgroundColor: '#fff' },
  title: { fontSize: 20, textAlign: 'center', marginBottom: 'auto', marginTop: 60, fontWeight: '500' },
  card: { padding: 20, borderRadius: 12, backgroundColor: '#f9f9f9', elevation: 4 },
  phoneInputContainer: {
    width: '100%',
    height: 60,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  textContainer: { paddingVertical: 0, borderRadius: 8, backgroundColor: '#fff' },
  otpContainer: { marginVertical: 15, justifyContent: 'center' },
  otpInput: {
    borderBottomWidth: 2,
    borderColor: '#1a73e8',
    fontSize: 20,
    width: 40,
    height: 50,
    textAlign: 'center',
    marginHorizontal: 5,
    color: '#000',
  },
  statusIcon: { fontSize: 40, textAlign: 'center', marginTop: 15 },
  resendText: { textAlign: 'center', marginTop: 10, color: '#666' },
  resendLink: { textAlign: 'center', marginTop: 10, color: '#1a73e8', fontWeight: '500' },
});
