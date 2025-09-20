// screens/AuthScreen.js
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Alert, Platform } from 'react-native';
import { api, setToken } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // auto-login if token exists
    (async () => {
      const token = await AsyncStorage.getItem('pizuna_token');
      if (token) {
        // optional: validate token by hitting /api/users/me if you add that endpoint
        navigation.replace('Contacts');
      }
    })();
  }, []);

  const onSubmit = async () => {
    try {
      if (!phone) return Alert.alert('Phone required', 'Enter a phone number in E.164 format, e.g. +234801xxxxxxx');
      setLoading(true);
      // Demo auth endpoint on server: POST /api/auth/demo { phone, name }
      const res = await api.post('/api/auth/demo', { phone: phone.trim(), name: name.trim() });
      const { token, user } = res.data;
      await setToken(token);
      navigation.replace('Contacts', { user });
    } catch (err) {
      console.error(err);
      Alert.alert('Auth error', err.response?.data || err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.h}>Pizuna — demo sign in</Text>
      <TextInput
        placeholder="+2348010..."
        keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'phone-pad'}
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput placeholder="Your name" style={styles.input} value={name} onChangeText={setName} />
      <Button title={loading ? 'Signing in...' : 'Sign in (demo)'} onPress={onSubmit} disabled={loading} />
      <Text style={styles.note}>This demo flow creates a user by phone locally. Replace with Firebase/Twilio for real OTP.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:16, justifyContent:'center' },
  input: { borderWidth:1, borderColor:'#ddd', padding:12, marginVertical:8, borderRadius:6 },
  h: { fontSize:20, marginBottom:12, textAlign:'center' },
  note: { marginTop:12, color:'#666', fontSize:12, textAlign:'center' }
});
