import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { fetchCapsules, fetchTraits } from '../api/memory';

export default function InsightsScreen() {
  const [capsules, setCapsules] = useState([]);
  const [traits, setTraits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCapsules(), fetchTraits()])
      .then(([c, t]) => {
        setCapsules(c);
        setTraits(t);
      })
      .catch((err) => console.warn('Insights load failed:', err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.sub}>Built from your real conversations over time</Text>

        {!loading && capsules.length === 0 && traits.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={32} color={colors.muted} />
            <Text style={styles.emptyText}>
              Nea builds insights after a few conversations. Keep chatting and check back here — this is an early MVP feature.
            </Text>
          </View>
        )}

        {traits.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Patterns Nea has noticed</Text>
            {traits.map((t) => (
              <View key={t.id} style={styles.traitRow}>
                <Text style={styles.traitName}>{t.trait}</Text>
                <View style={styles.traitBarTrack}>
                  <View style={[styles.traitBarFill, { width: `${Math.round(((t.score + 1) / 2) * 100)}%` }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {capsules.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Weekly summaries</Text>
            {capsules.map((c) => (
              <View key={c.id} style={styles.capsuleCard}>
                <Text style={styles.capsuleDate}>
                  {new Date(c.periodStart).toLocaleDateString()} – {new Date(c.periodEnd).toLocaleDateString()}
                </Text>
                <Text style={styles.capsuleSummary}>{c.summary}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '600', color: colors.navy, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 24 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 40, paddingHorizontal: 16 },
  emptyText: { fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  section: { marginBottom: 28 },
  sectionHeading: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  traitRow: { marginBottom: 14 },
  traitName: { fontSize: 14, color: colors.navy, fontWeight: '500', marginBottom: 6, textTransform: 'capitalize' },
  traitBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  traitBarFill: { height: 6, borderRadius: 3, backgroundColor: colors.blue },
  capsuleCard: { backgroundColor: colors.understood, borderRadius: 14, padding: 14, marginBottom: 10 },
  capsuleDate: { fontSize: 12, color: colors.muted, marginBottom: 6 },
  capsuleSummary: { fontSize: 14, lineHeight: 21, color: colors.navy },
});
