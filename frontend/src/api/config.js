import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Base URL for the Nea backend's node-api (see backend/README.md).
//
// - Web preview talks to node-api on localhost:4000.
// - Expo Go on a phone talks to Metro (already reachable) and metro.config.js
//   proxies /api and /health to node-api :4000. That avoids Windows Firewall
//   dropping direct connections to :4000.
function expoGoApiBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;
  if (hostUri) return `http://${hostUri}`;
  // Fallback if Constants aren't ready yet — same LAN IP Metro shows.
  return 'http://192.168.0.119:8082';
}

export const API_BASE_URL = Platform.select({
  web: 'http://localhost:4000',
  default: expoGoApiBaseUrl(),
});
