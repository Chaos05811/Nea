import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import ISLInput from '../components/ISLInput';
import TextToISLPlayer from '../components/TextToISLPlayer';
import { colors } from '../theme';
import { createSession, sendChatMessage } from '../api/chat';

const timeLabel = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Full-screen ISL session (not a popup):
// camera (big) → ISL→text → Groq chat → CWASA Text→ISL avatar → Next → camera again
export default function ISLScreen({ navigation, route }) {
  const [panel, setPanel] = useState('camera'); // camera | thinking | replyIsl
  const [replyText, setReplyText] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const sessionId = useRef(route?.params?.sessionId || null);
  const pendingTurns = useRef([]);

  async function ensureSession() {
    if (!sessionId.current) {
      sessionId.current = await createSession('ISL');
    }
    return sessionId.current;
  }

  function closeAndSync() {
    const turns = pendingTurns.current.slice();
    pendingTurns.current = [];
    navigation.navigate({
      name: 'Chat',
      params: {
        islHistory: turns,
        sessionId: sessionId.current || undefined,
      },
      merge: true,
    });
  }

  async function handleSend({ text }) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPanel('thinking');
    try {
      const sid = await ensureSession();
      const result = await sendChatMessage(sid, trimmed, 'ISL');
      const reply = result.assistantMessage.content;
      pendingTurns.current.push({
        userText: trimmed,
        replyText: reply,
        time: timeLabel(),
      });
      setReplyText(reply);
      setPanel('replyIsl');
    } catch (err) {
      const msg = err.message || 'Chat failed';
      pendingTurns.current.push({
        userText: trimmed,
        replyText: msg,
        time: timeLabel(),
        error: true,
      });
      setReplyText(msg);
      setPanel('replyIsl');
    }
  }

  function nextTurn() {
    setReplyText('');
    setPanel('camera');
    setResetKey((k) => k + 1);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {panel === 'camera' && 'Sign with Nea'}
          {panel === 'thinking' && 'Nea is thinking…'}
          {panel === 'replyIsl' && "Nea's reply in ISL"}
        </Text>
        <Pressable
          testID="close-isl"
          accessibilityRole="button"
          accessibilityLabel="Close ISL"
          onPress={closeAndSync}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={26} color={colors.navy} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {panel === 'camera' && (
          <ISLInput resetKey={resetKey} onSend={handleSend} />
        )}

        {panel === 'thinking' && (
          <View style={styles.thinking}>
            <ActivityIndicator color={colors.blue} size="large" />
            <Text style={styles.thinkingTitle}>Sending your ISL text to Nea…</Text>
            <Text style={styles.thinkingHint}>Your chat history is saved as text.</Text>
          </View>
        )}

        {panel === 'replyIsl' && (
          <View style={styles.reply}>
            <Text style={styles.replyLabel}>Text reply</Text>
            <Text style={styles.replyText}>{replyText}</Text>
            <View style={styles.player}>
              <TextToISLPlayer text={replyText} />
            </View>
            <Pressable
              testID="isl-next"
              accessibilityRole="button"
              accessibilityLabel="Next ISL turn"
              style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}
              onPress={nextTurn}
            >
              <Text style={styles.nextText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.nextHint}>Opens camera again. Tap ✕ to return to chat.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCFDFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.navy, letterSpacing: -0.3 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, padding: 12 },
  thinking: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  thinkingTitle: { fontSize: 17, fontWeight: '600', color: colors.navy, textAlign: 'center' },
  thinkingHint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  reply: { flex: 1, gap: 8 },
  replyLabel: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  replyText: { fontSize: 15, lineHeight: 22, color: colors.navy, backgroundColor: colors.understood, padding: 12, borderRadius: 12, maxHeight: 110 },
  player: { flex: 1, minHeight: 320, borderRadius: 16, overflow: 'hidden' },
  nextBtn: {
    marginTop: 4,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  nextHint: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
