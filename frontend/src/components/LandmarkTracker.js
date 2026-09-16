import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { colors } from '../theme';

export default function LandmarkTracker({ onStatus, style }) {
  const [html, setHtml] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/landmark-tracker.html'));
        await asset.downloadAsync();
        const uri = asset.localUri || asset.uri;
        const content = await readAsStringAsync(uri);
        if (!cancelled) setHtml(content);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load tracker');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onMessage = useCallback((event) => {
    let data;
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (data.type === 'ready' || data.type === 'status') setReady(true);
    if (data.type === 'error') setLoadError(data.message || 'Tracker error');
    onStatus?.(data);
  }, [onStatus]);

  if (loadError && !html) {
    return (
      <View style={[styles.fill, styles.centred, style]}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }
  if (!html) {
    return (
      <View style={[styles.fill, styles.centred, style]}>
        <ActivityIndicator color={colors.blue} />
        <Text style={styles.hint}>Preparing landmark tracker…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.fill, style]}>
      <WebView
        style={styles.webview}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://cdn.jsdelivr.net/' }}
        onMessage={onMessage}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        mediaCapturePermissionGrantType="grant"
        setSupportMultipleWindows={false}
        mixedContentMode="always"
      />
      {!ready && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.overlayHint}>Starting camera & models…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', backgroundColor: '#1C1C1E' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  centred: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.35)' },
  overlayHint: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
  errorText: { color: '#FFFFFF', fontSize: 12, textAlign: 'center', paddingHorizontal: 12 },
});
