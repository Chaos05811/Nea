import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Metro origin (Expo Go / web). Phone traffic is proxied through this host.
export function metroOrigin() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;
  if (hostUri) {
    return hostUri.startsWith('http') ? hostUri : `http://${hostUri}`;
  }
  return 'http://192.168.0.110:8082';
}

export function expoGoApiBaseUrl() {
  return metroOrigin();
}

export const API_BASE_URL = Platform.select({
  web: 'http://localhost:4000',
  default: expoGoApiBaseUrl(),
});

export function islPlayerUrl() {
  return `${metroOrigin()}/isl-player/player.html`;
}

export function islVocabUrl() {
  return `${metroOrigin()}/isl-player/words.txt`;
}
