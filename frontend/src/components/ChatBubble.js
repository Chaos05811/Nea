import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createAudioPlayer } from 'expo-audio';
import Logo from './Logo';
import { colors } from '../theme';
import { synthesizeSpeechToFile } from '../api/voice';

export default function ChatBubble({ message, onPlayIsl }) {
  const user = message.role === 'user';
  const [speaking, setSpeaking] = useState(false);

  async function handleSpeak() {
    if (speaking) return;
    setSpeaking(true);
    try {
      const uri = await synthesizeSpeechToFile(message.text);
      const player = createAudioPlayer(uri);
      player.play();
    } catch (err) {
      console.warn('Speak failed:', err.message);
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <View style={[styles.row, user && styles.userRow]} testID={`message-${message.role}`}>
      {!user && <View style={styles.avatar}><Logo size={34} /></View>}
      <View style={[styles.bubble, user ? styles.userBubble : styles.assistantBubble, message.error && styles.errorBubble]}>
        <Text style={[styles.text, message.error && styles.errorText]} selectable>{message.text}</Text>
        <View style={styles.meta}>
          {!user && !message.error && (
            <View style={styles.actions}>
              <Pressable
                testID="speak-message"
                accessibilityRole="button"
                accessibilityLabel="Speak this message"
                onPress={handleSpeak}
                disabled={speaking}
                style={({ pressed }) => [styles.speakButton, pressed && styles.speakPressed]}
              >
                {speaking ? (
                  <ActivityIndicator size="small" color={colors.blue} />
                ) : (
                  <Ionicons name="volume-medium-outline" size={15} color={colors.blue} />
                )}
                <Text style={styles.speakText}>Speak</Text>
              </Pressable>
              {!!onPlayIsl && (
                <Pressable
                  testID="isl-message"
                  accessibilityRole="button"
                  accessibilityLabel="Play this message in ISL"
                  onPress={() => onPlayIsl(message.text)}
                  style={({ pressed }) => [styles.speakButton, pressed && styles.speakPressed]}
                >
                  <Ionicons name="hand-left-outline" size={15} color={colors.blue} />
                  <Text style={styles.speakText}>ISL</Text>
                </Pressable>
              )}
            </View>
          )}
          <Text style={styles.time}>{message.time || '9:41 AM'}</Text>
          {user && <Ionicons name="checkmark-done-outline" size={17} color={colors.blue} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, gap: 8 },
  userRow: { justifyContent: 'flex-end' },
  avatar: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#E4EDFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bubble: { paddingHorizontal: 13, paddingTop: 10, paddingBottom: 8, borderRadius: 17 },
  userBubble: { maxWidth: '80%', backgroundColor: colors.userBubble, borderBottomRightRadius: 4 },
  assistantBubble: { maxWidth: '80%', backgroundColor: colors.assistantBubble, borderBottomLeftRadius: 4 },
  errorBubble: { backgroundColor: '#FDECEC' },
  text: { fontSize: 16, lineHeight: 23, color: colors.navy, letterSpacing: -0.3 },
  errorText: { color: '#B3261E' },
  meta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 'auto' },
  speakButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: 'rgba(79,127,245,0.12)' },
  speakPressed: { opacity: 0.6 },
  speakText: { fontSize: 12, fontWeight: '600', color: colors.blue },
  time: { fontSize: 12, lineHeight: 17, color: colors.secondary },
});
