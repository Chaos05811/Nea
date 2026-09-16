import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';

// No backend concept of "plans" exists yet — rather than showing fabricated
// sample plans, this is an honest empty state. Ask Nea (Dashboard -> Plan mode)
// already lets users talk through a plan in chat; a saved/structured Plans
// feature is a natural next backend addition, not yet built (MVP stage).
export default function PlanScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.orbTopRight} />
        <View style={styles.orbTopLeft} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Plans</Text>
          <Text style={styles.subtitle}>Created with Nea</Text>
        </View>

        <View style={styles.empty}>
          <Ionicons name="map-outline" size={32} color={colors.muted} />
          <Text style={styles.emptyTitle}>No saved plans yet</Text>
          <Text style={styles.emptyText}>
            Saved, structured plans are an upcoming MVP feature. For now, choose "Plan" from the Home
            screen to talk through a plan with Nea in chat.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCFDFF' },
  orbTopRight: { position: 'absolute', top: -120, right: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: '#EAF2FF', opacity: 0.6 },
  orbTopLeft: { position: 'absolute', top: 60, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: '#F3F6FC', opacity: 0.7 },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 24 },
  header: { marginBottom: 32, paddingTop: 10 },
  title: { fontSize: 26, fontWeight: '600', color: colors.navy, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 4 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 60, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.navy },
  emptyText: { fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center' },
});
