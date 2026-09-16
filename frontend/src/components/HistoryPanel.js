import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { fetchSessions } from '../api/memory';

const MODALITY_ICON = {
  text: 'chatbubble-outline',
  voice: 'mic-outline',
  isl: 'hand-left-outline',
  video: 'videocam-outline',
};

export default function HistoryPanel({ visible, onClose, onSelectSession, onNewConversation, onBackHome }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchSessions()
      .then(setSessions)
      .catch((err) => console.warn('Failed to load history:', err.message))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Previous chats</Text>
          <Pressable testID="close-history" accessibilityRole="button" accessibilityLabel="Close history" onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close-outline" size={26} color={colors.navy} />
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable testID="reset-conversation" accessibilityRole="button" style={styles.actionRow} onPress={onNewConversation}>
            <Ionicons name="refresh-outline" size={21} color={colors.navy} />
            <Text style={styles.actionText}>Start a new conversation</Text>
          </Pressable>
          <Pressable testID="back-to-dashboard" accessibilityRole="button" style={styles.actionRow} onPress={onBackHome}>
            <Ionicons name="arrow-back-outline" size={21} color={colors.navy} />
            <Text style={styles.actionText}>Back to Home</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.blue} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="time-outline" size={32} color={colors.muted} />
            <Text style={styles.emptyText}>No previous conversations yet.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {sessions.map((s) => (
              <Pressable
                key={s.id}
                testID={`history-session-${s.id}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => onSelectSession(s)}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={MODALITY_ICON[s.modality] || 'chatbubble-outline'} size={18} color={colors.navy} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{s.title || `${capitalize(s.modality)} conversation`}</Text>
                  <Text style={styles.rowMeta}>{new Date(s.startedAt).toLocaleString()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.border} />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 20, fontWeight: '600', color: colors.navy },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  actionRow: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 52, paddingVertical: 10 },
  actionText: { fontSize: 17, color: colors.navy, flexShrink: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: colors.muted },
  list: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.understood },
  rowPressed: { opacity: 0.7 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 18, fontWeight: '600', color: colors.navy, lineHeight: 24 },
  rowMeta: { fontSize: 13, color: colors.muted, marginTop: 3 },
});
