import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthScreen from './screens/AuthScreen';
import ContactsScreen from './screens/ContactsScreen';
import ChatScreen from './screens/ChatScreen';
import { API_BASE } from './lib/api';
import { getFCMToken, setupForegroundHandler } from './lib/notifications';

const Stack = createNativeStackNavigator();

global.__API_BASE__ = API_BASE;

export default function App() {
  useEffect(() => {
    // Request FCM token when app starts
    getFCMToken();

    // Setup foreground message handler
    setupForegroundHandler();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'Sign in' }} />
        <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Contacts' }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
