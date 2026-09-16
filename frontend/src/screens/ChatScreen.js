import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import Logo from '../components/Logo';
import ChatBubble from '../components/ChatBubble';
import Composer from '../components/Composer';
import HistoryPanel from '../components/HistoryPanel';
import { colors } from '../theme';
import { createSession, sendChatMessage } from '../api/chat';
import { fetchSessionMessages } from '../api/memory';
import { transcribeAudio } from '../api/voice';

const timeLabel = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const STARTER_PROMPTS = {
  talk: "I want to talk about what's on my mind today.",
  calm: "I'm feeling a bit anxious and could use help calming down.",
  reflect: "I'd like to reflect on how things have been going lately.",
  plan: "I want to figure out a plan for something I'm dealing with.",
};

export default function ChatScreen({ route, navigation }) {
  const supportMode = route?.params?.supportMode;

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(supportMode ? STARTER_PROMPTS[supportMode] || '' : '');
  const [pending, setPending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const scroll = useRef(null);
  const sessionId = useRef(null);
  const nextId = useRef(1);
  const locked = useRef(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Merge ISL session turns when returning from ISLScreen
  useEffect(() => {
    const history = route?.params?.islHistory;
    if (!history?.length) return;
    if (route?.params?.sessionId) sessionId.current = route.params.sessionId;
    const appended = [];
    history.forEach((turn) => {
      appended.push({
        id: nextId.current++,
        role: 'user',
        text: turn.userText,
        time: turn.time || timeLabel(),
      });
      appended.push({
        id: nextId.current++,
        role: 'assistant',
        text: turn.replyText,
        time: turn.time || timeLabel(),
        error: !!turn.error,
      });
    });
    setMessages((prev) => [...prev, ...appended]);
    navigation.setParams({ islHistory: undefined, sessionId: undefined });
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
  }, [route?.params?.islHistory]);

  async function ensureSession() {
    if (!sessionId.current) {
      sessionId.current = await createSession('Text');
    }
    return sessionId.current;
  }

  async function sendMessage(text, modality = 'Text') {
    const trimmed = text.trim();
    if (!trimmed || locked.current) return;
    locked.current = true;
    setPending(true);
    const userMessage = { id: nextId.current++, role: 'user', text: trimmed, time: timeLabel() };
    setMessages((prev) => [...prev, userMessage]);
    scroll.current?.scrollToEnd({ animated: true });

    try {
      const sid = await ensureSession();
      const result = await sendChatMessage(sid, trimmed, modality);
      const replyText = result.assistantMessage.content;
      const answer = { id: nextId.current++, role: 'assistant', text: replyText, time: timeLabel() };
      setMessages((prev) => [...prev, answer]);
    } catch (err) {
      const answer = { id: nextId.current++, role: 'assistant', text: err.message, time: timeLabel(), error: true };
      setMessages((prev) => [...prev, answer]);
    } finally {
      locked.current = false;
      setPending(false);
      scroll.current?.scrollToEnd({ animated: true });
    }
  }

  function sendText() {
    if (!draft.trim() || locked.current) return;
    Keyboard.dismiss();
    sendMessage(draft, 'Text');
    setDraft('');
  }

  async function openIsl() {
    try {
      const sid = await ensureSession();
      navigation.navigate('ISL', { sessionId: sid });
    } catch (err) {
      // Still open ISL — it can create its own session
      navigation.navigate('ISL', {});
    }
  }

  async function handleMicPress() {
    if (transcribing) return;
    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        if (recorder.uri) {
          const { transcript } = await transcribeAudio(recorder.uri);
          if (transcript?.trim()) {
            setDraft((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
          }
        }
      } catch (err) {
        console.warn('Voice-to-text failed:', err.message);
      } finally {
        setTranscribing(false);
      }
      return;
    }

    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }

  function resetChat() {
    locked.current = false;
    sessionId.current = null;
    setMessages([]);
    setDraft('');
    setPending(false);
    setShowHistory(false);
  }

  async function handleSelectSession(session) {
    setShowHistory(false);
    try {
      const { messages: history } = await fetchSessionMessages(session.id);
      sessionId.current = session.id;
      setMessages(
        history.map((m) => ({
          id: nextId.current++,
          role: m.role,
          text: m.content,
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          error: false,
        }))
      );
      scroll.current?.scrollTo({ y: 0, animated: false });
    } catch (err) {
      console.warn('Failed to load session history:', err.message);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.orbTopRight} />
        <View style={styles.orbTopLeft} />
        <View style={styles.orbBottomRight} />
      </View>

      <View style={styles.header}>
        <Logo size={34} />
        <View style={styles.brandText}>
          <Text style={styles.title}>Nea</Text>
          <Text style={styles.tagline}>Your feelings matter.</Text>
        </View>
        <Pressable testID="history-button" accessibilityRole="button" accessibilityLabel="Previous chats" style={styles.iconButton} onPress={() => setShowHistory(true)}>
          <Ionicons name="time-outline" size={22} color={colors.navy} />
        </Pressable>
        <Pressable
          testID="camera-button"
          accessibilityRole="button"
          accessibilityLabel="Open ISL screen"
          style={styles.islButton}
          onPress={openIsl}
        >
          <Ionicons name="videocam" size={18} color={colors.navy} />
          <Text style={styles.islButtonText}>ISL</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}>
        <ScrollView
          ref={scroll}
          testID="chat-scroll"
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <Logo size={56} />
              <Text style={styles.emptyTitle}>Ask Nea anything</Text>
              <Text style={styles.emptyBody}>Write below, tap the mic, or open ISL.</Text>
            </View>
          )}
          <View accessibilityLiveRegion="polite" testID="conversation">
            {messages.map((message) => <ChatBubble key={message.id} message={message} />)}
            {pending && <Text style={styles.replying} accessibilityLiveRegion="polite">Nea is replying…</Text>}
          </View>
        </ScrollView>

        {!!permissionDenied && (
          <Text style={styles.permText}>Microphone access is needed to speak with Nea.</Text>
        )}
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={sendText}
          pending={pending}
          variant="sky"
          onMicPress={handleMicPress}
          recording={recording}
          transcribing={transcribing}
        />
      </KeyboardAvoidingView>

      <HistoryPanel
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectSession={handleSelectSession}
        onNewConversation={resetChat}
        onBackHome={() => {
          setShowHistory(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCFDFF' },
  orbTopRight: { position: 'absolute', top: -120, right: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: '#EAF2FF', opacity: 0.6 },
  orbTopLeft: { position: 'absolute', top: 60, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: '#F3F6FC', opacity: 0.7 },
  orbBottomRight: { position: 'absolute', bottom: -150, right: -100, width: 450, height: 450, borderRadius: 225, backgroundColor: '#F1F6FF', opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  brandText: { flex: 1, paddingLeft: 6 },
  title: { fontSize: 20, lineHeight: 25, color: colors.navy, fontWeight: '600', letterSpacing: -0.8 },
  tagline: { fontSize: 11, lineHeight: 15, color: colors.secondary, marginTop: 0 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  islButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.translation,
    borderWidth: 1,
    borderColor: '#CDDCF9',
  },
  islButtonText: { fontSize: 13, fontWeight: '700', color: colors.navy, letterSpacing: 0.3 },
  body: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 14, paddingBottom: 22, justifyContent: 'flex-end' },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.navy, marginTop: 6 },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  replying: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingLeft: 51, marginTop: 12, marginBottom: 5 },
  permText: { color: '#B3261E', fontSize: 12, textAlign: 'center', paddingVertical: 6, backgroundColor: '#FDECEC' },
});
