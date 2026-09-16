import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';

export default function Composer({
  value,
  onChange,
  onSend,
  pending,
  variant = 'default',
  onMicPress,
  recording,
  transcribing,
}) {
  const disabled = !value.trim() || pending;
  return (
    <View style={[styles.container, variant === 'sky' && styles.skyContainer]}>
      <View style={[styles.field, variant === 'sky' && styles.skyField]}>
        <TextInput
          testID="message-input"
          accessibilityLabel="Your message"
          placeholder={recording ? 'Listening…' : 'Share what’s on your mind…'}
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={value}
          onChangeText={onChange}
          multiline
          maxLength={2000}
          textAlignVertical="center"
          selectionColor={colors.blue}
        />
        {!!onMicPress && (
          <Pressable
            testID="mic-toggle"
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop recording' : 'Speak your message'}
            onPress={onMicPress}
            disabled={transcribing}
            style={({ pressed }) => [styles.mic, recording && styles.micActive, (pressed || transcribing) && styles.pressed]}
          >
            {transcribing ? (
              <ActivityIndicator size="small" color={recording ? '#FFFFFF' : colors.navy} />
            ) : (
              <Ionicons name={recording ? 'stop' : 'mic-outline'} color={recording ? '#FFFFFF' : colors.navy} size={20} />
            )}
          </Pressable>
        )}
        <Pressable testID="send-text" accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{ disabled }} disabled={disabled} onPress={onSend} style={({ pressed }) => [styles.send, disabled && styles.disabled, pressed && styles.pressed]}>
          <Ionicons name="arrow-up" color="#FFFFFF" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.border },
  skyContainer: { backgroundColor: '#F0F7FF', borderTopColor: '#DCE9FA' },
  field: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: '#F8FAFF', padding: 6, gap: 5 },
  skyField: { backgroundColor: '#FFFFFF', borderColor: '#CFDFF5', shadowColor: '#315C96', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  input: { flex: 1, fontSize: 17, color: colors.navy, minHeight: 44, maxHeight: 120, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10 },
  mic: { minWidth: 44, height: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.translation },
  micActive: { backgroundColor: '#FF4444' },
  send: { minWidth: 44, height: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
