// lib/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your backend URL (ngrok or production)
export const API_BASE = 'https://9e63b27423f1.ngrok-free.app';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export async function setToken(token){
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    await AsyncStorage.setItem('pizuna_token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    await AsyncStorage.removeItem('pizuna_token');
  }
}

export async function loadToken(){
  const token = await AsyncStorage.getItem('pizuna_token');
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  return token;
}
