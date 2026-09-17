import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import ISLInput from '../components/ISLInput';
import TextToISLPlayer from '../components/TextToISLPlayer';
import { colors } from '../theme';
import { createSession, sendChatMessage } from '../api/chat';

const timeLabel = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Full-screen ISL session:
// input (sign camera OR type English) → Groq chat → Marc Text→ISL avatar → Next
export default function ISLScreen({ navigation, route }) {
  const [panel, setPanel] = useState('input'); // input | thinking | replyIsl
  const [inputMode, setInputMode] = useState('sign'); // sign | type
  const [typedText, setTypedText] = useState('');
  const [userText, setUserText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replayKey, setReplayKey] = useState(0);
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
    setUserText(trimmed);
    setTypedText('');
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
      setReplayKey(0);
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
    setUserText('');
    setPanel('input');
    setResetKey((k) => k + 1);
  }

  const title =
    panel === 'thinking' ? 'Nea is thinking…'
      : panel === 'replyIsl' ? "Nea's reply in ISL"
        : 'Talk with Nea in ISL';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
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
        {panel === 'input' && (
          <View style={styles.inputPane}>
            <View style={styles.modeRow}>
              <Pressable
                testID="isl-mode-sign"
                onPress={() => setInputMode('sign')}
                style={[styles.modeTab, inputMode === 'sign' && styles.modeTabActive]}
              >
                <Ionicons name="videocam" size={16} color={inputMode === 'sign' ? '#FFFFFF' : colors.navy} />
                <Text style={[styles.modeTabText, inputMode === 'sign' && styles.modeTabTextActive]}>Sign</Text>
              </Pressable>
              <Pressable
                testID="isl-mode-type"
                onPress={() => setInputMode('type')}
                style={[styles.modeTab, inputMode === 'type' && styles.modeTabActive]}
              >
                <Ionicons name="create-outline" size={16} color={inputMode === 'type' ? '#FFFFFF' : colors.navy} />
                <Text style={[styles.modeTabText, inputMode === 'type' && styles.modeTabTextActive]}>Type</Text>
              </Pressable>
            </View>

            {inputMode === 'sign' ? (
              <ISLInput resetKey={resetKey} onSend={handleSend} />
            ) : (
              <View style={styles.typePane}>
                <Text style={styles.typeHint}>Type English. Nea replies in text and the Marc avatar signs it in ISL.</Text>
                <View style={styles.typeBox}>
                  <TextInput
                    testID="isl-type-input"
                    style={styles.typeInput}
                    placeholder="What do you want to tell Nea?"
                    placeholderTextColor={colors.muted}
                    value={typedText}
                    onChangeText={setTypedText}
                    multiline
                    autoFocus
                  />
                  <Pressable
                    testID="send-typed-isl"
                    accessibilityRole="button"
                    accessibilityLabel="Send typed message"
                    disabled={!typedText.trim()}
                    onPress={() => handleSend({ text: typedText })}
                    style={({ pressed }) => [styles.typeSend, pressed && styles.pressed, !typedText.trim() && styles.typeSendDisabled]}
                  >
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        {panel === 'thinking' && (
          <View style={styles.thinking}>
            <ActivityIndicator color={colors.blue} size="large" />
            <Text style={styles.thinkingTitle}>Sending to Nea…</Text>
            <Text style={styles.thinkingHint} numberOfLines={3}>{userText}</Text>
          </View>
        )}

        {panel === 'replyIsl' && (
          <View style={styles.reply}>
            <View style={styles.ioCard}>
              <Text style={styles.ioLabel}>You</Text>
              <Text style={styles.ioText}>{userText}</Text>
            </View>
            <View style={styles.ioCard}>
              <Text style={styles.ioLabel}>Nea (text)</Text>
              <Text style={styles.ioText}>{replyText}</Text>
            </View>
            <View style={styles.player}>
              <TextToISLPlayer text={replyText} replayKey={replayKey} />
            </View>
            <View style={styles.actionRow}>
              <Pressable
                testID="isl-replay"
                accessibilityRole="button"
                accessibilityLabel="Replay ISL"
                style={({ pressed }) => [styles.replayBtn, pressed && styles.pressed]}
                onPress={() => setReplayKey((k) => k + 1)}
              >
                <Ionicons name="refresh" size={18} color={colors.navy} />
                <Text style={styles.replayText}>Replay ISL</Text>
              </Pressable>
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
            </View>
            <Text style={styles.nextHint}>Next returns to Sign / Type. ✕ saves this as text in chat.</Text>
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
  inputPane: { flex: 1 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modeTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CDDCF9',
    backgroundColor: colors.translation,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modeTabActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  modeTabText: { fontSize: 14, fontWeight: '700', color: colors.navy },
  modeTabTextActive: { color: '#FFFFFF' },
  typePane: { flex: 1, gap: 12 },
  typeHint: { fontSize: 13, lineHeight: 19, color: colors.muted },
  typeBox: {
    backgroundColor: colors.understood,
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  typeInput: { flex: 1, minHeight: 88, maxHeight: 160, fontSize: 16, lineHeight: 22, color: colors.navy, padding: 8 },
  typeSend: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSendDisabled: { opacity: 0.4 },
  thinking: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  thinkingTitle: { fontSize: 17, fontWeight: '600', color: colors.navy, textAlign: 'center' },
  thinkingHint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  reply: { flex: 1, gap: 8 },
  ioCard: { backgroundColor: colors.understood, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  ioLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  ioText: { fontSize: 15, lineHeight: 21, color: colors.navy },
  player: { flex: 1, minHeight: 280, borderRadius: 16, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  replayBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.translation,
    borderWidth: 1,
    borderColor: '#CDDCF9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  replayText: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  nextBtn: {
    flex: 1,
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
