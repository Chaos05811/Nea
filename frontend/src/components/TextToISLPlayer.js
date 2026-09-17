import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { englishToIslTokens } from '../api/textToIsl';
import { islPlayerUrl } from '../api/config';

// CWASA Marc avatar + SignFiles from text_to_isl-main, served by Metro at /isl-player.
export default function TextToISLPlayer({ text, replayKey = 0, onReady }) {
  const webRef = useRef(null);
  const [tokens, setTokens] = useState([]);
  const [status, setStatus] = useState('Preparing ISL avatar…');
  const playerReady = useRef(false);
  const pendingTokens = useRef(null);
  const playerUri = tokens.length
    ? `${islPlayerUrl()}?r=${replayKey}#${encodeURIComponent(JSON.stringify(tokens))}`
    : islPlayerUrl();

  function playInWeb(list) {
    const payload = JSON.stringify(list || []);
    webRef.current?.injectJavaScript(
      `window.__neaPlayIsl && window.__neaPlayIsl(${payload}); true;`
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!text?.trim()) {
        setTokens([]);
        return;
      }
      setStatus('Converting text → ISL gloss…');
      try {
        const next = await englishToIslTokens(text);
        if (cancelled) return;
        setTokens(next);
        pendingTokens.current = next;
        if (playerReady.current) playInWeb(next);
      } catch (err) {
        if (!cancelled) setStatus(err.message || 'Text→ISL failed');
      }
    })();
    return () => { cancelled = true; };
  }, [text, replayKey]);

  function onMessage(event) {
    let data = event?.nativeEvent?.data;
    try {
      if (typeof data === 'string') data = JSON.parse(data);
    } catch { return; }
    if (!data || typeof data !== 'object') return;
    if (data.type === 'ready' || data.type === 'boot') {
      playerReady.current = true;
      setStatus(data.avatar ? 'Avatar ready — signing…' : (data.error || 'Avatar unavailable'));
      onReady?.(data);
      if (pendingTokens.current?.length) playInWeb(pendingTokens.current);
    }
    if (data.type === 'gloss') setStatus(`Signing ${data.index + 1}/${data.total}: ${data.token}`);
    if (data.type === 'done') setStatus('ISL playback finished');
  }

  return (
    <View style={styles.fill}>
      <WebView
        ref={webRef}
        style={styles.webview}
        originWhitelist={['*']}
        source={{ uri: playerUri }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
      />
      <View style={styles.meta}>
        <Text style={styles.metaStatus} numberOfLines={1}>{status}</Text>
        {!!tokens.length && (
          <Text style={styles.metaGloss} numberOfLines={3}>ISL: {tokens.join(' · ')}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', backgroundColor: '#111827', borderRadius: 16, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  meta: { paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  metaStatus: { color: '#7DD3FC', fontSize: 12, fontWeight: '600' },
  metaGloss: { color: '#CBD5E1', fontSize: 12, marginTop: 4 },
});
