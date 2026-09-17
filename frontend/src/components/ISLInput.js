import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCameraPermissions } from 'expo-camera';
import { colors } from '../theme';
import LandmarkTracker from './LandmarkTracker';
import { recognizeIslToText } from '../api/islToText';

// Full-height camera panel for ISLScreen. LandmarkTracker = live face/hand mesh.
// Phases: idle -> recording -> translating -> review -> done
export default function ISLInput({ onSend, resetKey = 0 }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState('idle');
  const [signedText, setSignedText] = useState('');
  const [sent, setSent] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [handsDetected, setHandsDetected] = useState(false);
  const recordStartedAt = useRef(0);
  const lastFace = useRef(false);
  const lastHands = useRef(false);

  useEffect(() => {
    setPhase('idle');
    setSent(false);
    setSignedText('');
    setFaceDetected(false);
    setHandsDetected(false);
  }, [resetKey]);

  const onTrackerStatus = useCallback((data) => {
    if (data.type === 'status') {
      const face = !!data.face;
      const hands = (data.hands || 0) > 0;
      setFaceDetected(face);
      setHandsDetected(hands);
      lastFace.current = face;
      lastHands.current = hands;
    }
  }, []);

  function startRecording() {
    recordStartedAt.current = Date.now();
    setPhase('recording');
  }

  function stopRecording() {
    setPhase('translating');
    const durationMs = Date.now() - recordStartedAt.current;
    setTimeout(() => {
      const guessed = recognizeIslToText({
        faceDetected: lastFace.current,
        handsDetected: lastHands.current,
        durationMs,
      });
      setSignedText(guessed);
      setPhase('review');
    }, 900);
  }

  function handleSend() {
    if (sent || !signedText.trim()) return;
    setSent(true);
    setPhase('done');
    onSend({ text: signedText.trim() });
  }

  if (!permission) {
    return (
      <View style={[styles.camera, styles.centred]}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.camera, styles.centred]}>
        <Ionicons name="videocam-off-outline" size={40} color="#FFFFFF" />
        <Text style={styles.permText}>Camera access is needed for ISL.</Text>
        <Pressable style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Grant Access</Text>
        </Pressable>
      </View>
    );
  }

  const showCamera = phase === 'idle' || phase === 'recording' || phase === 'translating';

  return (
    <View style={styles.root}>
      <View style={styles.camera} testID="isl-video-window">
        {showCamera ? (
          <View style={styles.cameraWrap}>
            <LandmarkTracker onStatus={onTrackerStatus} />
            {phase === 'translating' && (
              <View style={styles.translatingOverlay}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.translatingText}>Converting ISL → text…</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.frozenCamera}>
            <Ionicons name="pause-circle-outline" size={48} color="rgba(255,255,255,0.55)" />
            <Text style={styles.frozenLabel}>Camera paused</Text>
          </View>
        )}

        <View style={[styles.livePill, phase === 'recording' && styles.livePillRecording, (phase === 'review' || phase === 'done') && styles.livePillPaused]}>
          <View style={[styles.dot, phase === 'recording' && styles.dotRed, (phase === 'review' || phase === 'done') && styles.dotGrey]} />
          <Text style={styles.liveText}>
            {phase === 'recording' ? 'Recording' : phase === 'translating' ? 'Translating' : phase === 'idle' ? 'Sign now' : 'Paused'}
          </Text>
        </View>

        {showCamera && phase !== 'translating' && (
          <View style={styles.detectionStatus}>
            <View style={[styles.detectionItem, faceDetected && styles.detected]}>
              <Ionicons name="happy-outline" size={14} color={faceDetected ? '#34C759' : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.detectionLabel, faceDetected && styles.detectedLabel]}>{faceDetected ? 'Face' : 'Face?'}</Text>
            </View>
            <View style={[styles.detectionItem, handsDetected && styles.detected]}>
              <Ionicons name="hand-left-outline" size={14} color={handsDetected ? '#34C759' : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.detectionLabel, handsDetected && styles.detectedLabel]}>{handsDetected ? 'Hands' : 'Hands?'}</Text>
            </View>
          </View>
        )}

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
            <Text style={styles.controlLabel}>{phase === 'idle' ? 'Tap to start signing' : 'Tap to stop'}</Text>
          </View>
        )}
      </View>

      {phase === 'review' && (
        <View style={styles.understood} testID="understood-panel">
          <View style={styles.sectionHeading}>
            <Text style={styles.sparkle} accessible={false}>✦</Text>
            <Text style={styles.heading}>Your signs as text (edit if needed)</Text>
          </View>
          <View style={styles.translation}>
            <TextInput
              testID="isl-text-input"
              style={styles.translationInput}
              placeholder="What you signed…"
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
              <Ionicons name="send-outline" size={26} color={signedText.trim() ? colors.blue : colors.muted} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  camera: { flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#1C1C1E', minHeight: 420 },
  cameraWrap: { flex: 1, width: '100%' },
  centred: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  frozenCamera: { flex: 1, backgroundColor: '#2A2A2C', alignItems: 'center', justifyContent: 'center', gap: 10 },
  frozenLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '500' },
  permText: { color: '#FFFFFF', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  permButton: { backgroundColor: colors.blue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  permButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  livePill: { position: 'absolute', top: 10, left: 10, minHeight: 36, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: 'rgba(50,50,55,0.7)', zIndex: 3 },
  livePillRecording: { backgroundColor: 'rgba(200,30,30,0.75)' },
  livePillPaused: { backgroundColor: 'rgba(60,60,64,0.85)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, borderWidth: 1.5, borderColor: '#D4FFCA' },
  dotRed: { backgroundColor: '#FF4444', borderColor: '#FFBCBC' },
  dotGrey: { backgroundColor: '#888', borderColor: '#555' },
  liveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' },
  detectionStatus: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6, zIndex: 3 },
  detectionItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)' },
  detected: { backgroundColor: 'rgba(52,199,89,0.22)' },
  detectionLabel: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  detectedLabel: { color: '#34C759', fontWeight: '600' },
  controls: { position: 'absolute', bottom: 18, left: 0, right: 0, alignItems: 'center', gap: 6, zIndex: 3 },
  recordButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  recordDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF3B30' },
  stopButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 22, height: 22, borderRadius: 4, backgroundColor: '#FFFFFF' },
  controlLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', opacity: 0.9 },
  translatingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 4 },
  translatingText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  understood: { marginTop: 10, backgroundColor: colors.understood, padding: 10, borderRadius: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  sparkle: { fontSize: 20, color: colors.blue },
  heading: { color: colors.navy, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  translation: { backgroundColor: colors.translation, borderRadius: 13, paddingLeft: 12, paddingRight: 4, paddingVertical: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  translationInput: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.navy, minHeight: 44, maxHeight: 100 },
  send: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  pressed: { opacity: 0.6 },
});
