import Constants from 'expo-constants';

/**
 * Centralized API URL for backend requests.
 * Falls back to a default production URL if no env variable is provided.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.API_URL ||
  'https://labsync-1090.onrender.com';