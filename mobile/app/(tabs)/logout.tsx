import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function LogoutScreen() {
  useEffect(() => {
    const logout = async () => {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('nombre');
      await SecureStore.deleteItemAsync('usuario');
      router.replace('/login');
    };
    logout();
  }, []);

  return <View />;
}