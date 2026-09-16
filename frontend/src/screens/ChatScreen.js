import React, { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import Logo from '../components/Logo';
import ISLInput from '../components/ISLInput';
import ChatBubble from '../components/ChatBubble';
import Composer from '../components/Composer';
import HistoryPanel from '../components/HistoryPanel';
import { colors } from '../theme';
import { createSession, sendChatMessage } from '../api/chat';
import { fetchSessionMessages } from '../api/memory';
import { transcribeAudio } from '../api/voice';

const timeLabel = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Conversation starters shown from the Dashboard's "Ask Nea" shortcuts — these only
// prefill the composer, they never inject a fake assistant reply. Every reply the
// user sees still comes from a real /api/chat call to Groq.
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
  const [showCamera, setShowCamera] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const scroll = useRef(null);
  const sessionId = useRef(null);
  const nextId = useRef(1);
  const locked = useRef(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

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

  function sendFromCamera({ text }) {
    setShowCamera(false);
    sendMessage(text, 'ISL');
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
        <Pressable testID="camera-button" accessibilityRole="button" accessibilityLabel="Open ISL / Video camera" style={styles.iconButton} onPress={() => setShowCamera(true)}>
          <Ionicons name="videocam-outline" size={22} color={colors.navy} />
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
              <Text style={styles.emptyBody}>Write below, tap the mic, or use ISL / Video.</Text>
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

      <Modal visible={showCamera} animationType="slide" onRequestClose={() => setShowCamera(false)}>
        <SafeAreaView style={styles.cameraScreen}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>ISL / Video</Text>
            <Pressable testID="close-camera" accessibilityRole="button" accessibilityLabel="Close camera" onPress={() => setShowCamera(false)} style={styles.iconButton}>
              <Ionicons name="close-outline" size={26} color={colors.navy} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.cameraContent} keyboardShouldPersistTaps="handled">
            <ISLInput onSend={sendFromCamera} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
  body: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 14, paddingBottom: 22, justifyContent: 'flex-end' },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.navy, marginTop: 6 },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  replying: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingLeft: 51, marginTop: 12, marginBottom: 5 },
  permText: { color: '#B3261E', fontSize: 12, textAlign: 'center', paddingVertical: 6, backgroundColor: '#FDECEC' },
  cameraScreen: { flex: 1, backgroundColor: colors.background },
  cameraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  cameraTitle: { fontSize: 20, fontWeight: '600', color: colors.navy },
  cameraContent: { padding: 16 },
});
