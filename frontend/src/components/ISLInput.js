import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../theme';
import SciFiTrackingHUD from './SciFiTrackingHUD';

const FRAME_WIDTH = 340;
const FRAME_HEIGHT = 453; // 3:4

// ISL / Video camera panel — shown inside a modal from ChatScreen's top icon.
// The overlay (SciFiTrackingHUD) is a purely decorative sci-fi HUD graphic, NOT
// real hand/face detection — no ML, no frame capture, see that component's own
// header comment. Users manually drag the two HUD groups over their own
// face/hand since nothing here actually tracks them.
//
// Phases: idle -> recording -> review (type what you want to say) -> done
export default function ISLInput({ onSend }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState('idle');
  const [signedText, setSignedText] = useState('');
  const [sent, setSent] = useState(false);

  function startRecording() {
    setPhase('recording');
  }

  function stopRecording() {
    setPhase('review');
  }

  function handleSend() {
    if (sent || !signedText.trim()) return;
    setSent(true);
    setPhase('done');
    onSend({ text: signedText.trim() });
  }

  if (!permission) {
    return (
      <View style={[styles.frame, styles.centred]}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.frame, styles.centred]}>
        <Ionicons name="videocam-off-outline" size={36} color="#FFFFFF" />
        <Text style={styles.permText}>Camera access is needed for ISL / Video input.</Text>
        <Pressable style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Grant Access</Text>
        </Pressable>
      </View>
    );
  }

  const showCamera = phase === 'idle' || phase === 'recording';

  return (
    <View>
      <View style={styles.frame} testID="isl-video-window">
        {showCamera ? (
          <View style={styles.cameraWrap}>
            <CameraView style={styles.camera} facing="front" />
            <SciFiTrackingHUD width={FRAME_WIDTH} height={FRAME_HEIGHT} />
          </View>
        ) : (
          <View style={styles.frozenCamera}>
            <Ionicons name="pause-circle-outline" size={44} color="rgba(255,255,255,0.55)" />
            <Text style={styles.frozenLabel}>Video paused</Text>
          </View>
        )}

        <View style={[styles.livePill, phase === 'recording' && styles.livePillRecording, (phase === 'review' || phase === 'done') && styles.livePillPaused]}>
          <View style={[styles.dot, phase === 'recording' && styles.dotRed, (phase === 'review' || phase === 'done') && styles.dotGrey]} />
          <Text style={styles.liveText}>{phase === 'recording' ? 'Recording' : phase === 'idle' ? 'ISL / Video' : 'Paused'}</Text>
        </View>

        {(phase === 'idle' || phase === 'recording') && (
          <View style={styles.controls}>
            {phase === 'idle' ? (
              <Pressable testID="start-recording" accessibilityRole="button" accessibilityLabel="Start recording" style={styles.recordButton} onPress={startRecording}>
                <View style={styles.recordDot} />
              </Pressable>
            ) : (
              <Pressable testID="stop-recording" accessibilityRole="button" accessibilityLabel="Stop recording" style={styles.stopButton} onPress={stopRecording}>
                <View style={styles.stopSquare} />
              </Pressable>
            )}
            <Text style={styles.controlLabel}>{phase === 'idle' ? 'Tap to start' : 'Tap to stop'}</Text>
          </View>
        )}
      </View>

      {phase === 'review' && (
        <View style={styles.understood} testID="understood-panel">
          <View style={styles.sectionHeading}>
            <Text style={styles.sparkle} accessible={false}>✦</Text>
            <Text style={styles.heading}>What did you want to say?</Text>
          </View>
          <View style={styles.translation}>
            <TextInput
              testID="isl-text-input"
              style={styles.translationInput}
              placeholder="Type your message…"
              placeholderTextColor={colors.muted}
              value={signedText}
              onChangeText={setSignedText}
              multiline
              autoFocus
            />
            <Pressable
              testID="send-isl"
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!signedText.trim()}
              onPress={handleSend}
              style={({ pressed }) => [styles.send, pressed && styles.pressed]}
            >
              <Ionicons name="send-outline" size={28} color={signedText.trim() ? colors.blue : colors.muted} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 3 / 4, borderRadius: 18, overflow: 'hidden', backgroundColor: '#1C1C1E' },
  cameraWrap: { flex: 1, width: '100%' },
  camera: { flex: 1, width: '100%' },
  centred: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  frozenCamera: { flex: 1, backgroundColor: '#2A2A2C', alignItems: 'center', justifyContent: 'center', gap: 10 },
  frozenLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '500' },
  permText: { color: '#FFFFFF', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  permButton: { backgroundColor: colors.blue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  permButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  livePill: { position: 'absolute', top: 8, left: 6, minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, backgroundColor: 'rgba(50,50,55,0.7)' },
  livePillRecording: { backgroundColor: 'rgba(200,30,30,0.75)' },
  livePillPaused: { backgroundColor: 'rgba(60,60,64,0.85)' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.green, borderWidth: 1.5, borderColor: '#D4FFCA' },
  dotRed: { backgroundColor: '#FF4444', borderColor: '#FFBCBC' },
  dotGrey: { backgroundColor: '#888', borderColor: '#555' },
  liveText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  controls: { position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center', gap: 6 },
  recordButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  recordDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF3B30' },
  stopButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 22, height: 22, borderRadius: 4, backgroundColor: '#FFFFFF' },
  controlLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', opacity: 0.85 },
  understood: { marginTop: 8, backgroundColor: colors.understood, padding: 8, borderRadius: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2, paddingBottom: 6 },
  sparkle: { fontSize: 24, lineHeight: 28, color: colors.blue },
  heading: { color: colors.navy, fontSize: 16, lineHeight: 22, fontWeight: '600', flexShrink: 1, letterSpacing: -0.4 },
  translation: { backgroundColor: colors.translation, borderRadius: 13, paddingLeft: 12, paddingRight: 4, paddingVertical: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  translationInput: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.navy, letterSpacing: -0.35, minHeight: 42, maxHeight: 110 },
  send: { minWidth: 40, minHeight: 42, justifyContent: 'center', alignItems: 'center' },
  pressed: { opacity: 0.6 },
});
