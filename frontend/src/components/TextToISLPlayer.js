import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { englishToIslTokens } from '../api/textToIsl';
import { colors } from '../theme';

// CWASA signing avatar from https://github.com/shoebham/text_to_isl
export default function TextToISLPlayer({ text, onReady }) {
  const webRef = useRef(null);
  const [html, setHtml] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [status, setStatus] = useState('Preparing ISL avatar…');
  const [error, setError] = useState('');
  const playerReady = useRef(false);
  const pendingTokens = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/text-to-isl-player.html'));
        await asset.downloadAsync();
        const content = await readAsStringAsync(asset.localUri || asset.uri);
        if (!cancelled) setHtml(content);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load Text→ISL player');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function playInWeb(list) {
    const payload = JSON.stringify(list || []);
    webRef.current?.injectJavaScript(
      `window.__neaPlayIsl && window.__neaPlayIsl(${payload}); true;`
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!text?.trim()) { setTokens([]); return; }
      setStatus('Converting text → ISL gloss…');
      try {
        const next = await englishToIslTokens(text);
        if (cancelled) return;
        setTokens(next);
        pendingTokens.current = next;
        if (playerReady.current) playInWeb(next);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Text→ISL failed');
      }
    })();
    return () => { cancelled = true; };
  }, [text]);

  function onMessage(event) {
    let data;
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (data.type === 'ready' || data.type === 'boot') {
      playerReady.current = true;
      setStatus(data.avatar ? 'Avatar ready — signing…' : (data.error || 'Avatar unavailable'));
      onReady?.(data);
      if (pendingTokens.current?.length) playInWeb(pendingTokens.current);
    }
    if (data.type === 'gloss') setStatus(`Signing ${data.index + 1}/${data.total}: ${data.token}`);
    if (data.type === 'done') setStatus('ISL playback finished');
  }

  if (error && !html) {
    return (
      <View style={[styles.fill, styles.centred]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!html) {
    return (
      <View style={[styles.fill, styles.centred]}>
        <ActivityIndicator color={colors.blue} />
        <Text style={styles.hint}>Loading signing avatar…</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <WebView
        ref={webRef}
        style={styles.webview}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://cdn.jsdelivr.net/' }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        allowFileAccess
        allowUniversalAccessFromFileURLs
      />
      <View style={styles.meta}>
        <Text style={styles.metaStatus} numberOfLines={1}>{status}</Text>
        {!!tokens.length && (
          <Text style={styles.metaGloss} numberOfLines={2}>{tokens.join(' · ')}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', backgroundColor: '#111827', borderRadius: 16, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  centred: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  error: { color: '#FCA5A5', fontSize: 13, textAlign: 'center', paddingHorizontal: 12 },
  meta: { paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  metaStatus: { color: '#7DD3FC', fontSize: 12, fontWeight: '600' },
  metaGloss: { color: '#CBD5E1', fontSize: 12, marginTop: 4 },
});
