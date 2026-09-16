import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { useAuth } from '../api/AuthContext';
import { fetchCapsules, fetchSessions, fetchWeekCheckIns, submitCheckIn } from '../api/memory';

const CHECK_IN_OPTIONS = [
  { key: 'good', label: 'Good', icon: 'sunny-outline' },
  { key: 'okay', label: 'Okay', icon: 'partly-sunny-outline' },
  { key: 'low', label: 'Low', icon: 'cloudy-outline' },
  { key: 'stressed', label: 'Stressed', icon: 'thunderstorm-outline' },
];

const SUPPORT_MODES = [
  { key: 'talk', label: 'Talk', icon: 'chatbubble-outline' },
  { key: 'calm', label: 'Calm', icon: 'leaf-outline' },
  { key: 'reflect', label: 'Reflect', icon: 'bulb-outline' },
  { key: 'plan', label: 'Plan', icon: 'map-outline' },
];

const MOOD_LEVEL = { stressed: 0, low: 1, okay: 2, good: 3 };
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function initialsOf(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

const serifFontRegular = 'PlayfairDisplay_400Regular';
const serifFontBold = 'PlayfairDisplay_600SemiBold';

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [checkIn, setCheckIn] = useState(null);
  const [weekCheckIns, setWeekCheckIns] = useState([]);
  const [latestCapsule, setLatestCapsule] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [checkIns, capsules, sessions] = await Promise.all([
        fetchWeekCheckIns(),
        fetchCapsules(),
        fetchSessions(),
      ]);
      setWeekCheckIns(checkIns);
      const today = new Date().toISOString().slice(0, 10);
      const todays = checkIns.find(c => c.day.slice(0, 10) === today);
      if (todays) setCheckIn(todays.mood);
      setLatestCapsule(capsules[0] || null);
      setRecentSessions(sessions.slice(0, 3));
    } catch (err) {
      console.warn('Dashboard load failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCheckIn(mood) {
    setCheckIn(mood);
    try {
      await submitCheckIn(mood);
      loadData();
    } catch (err) {
      console.warn('Check-in save failed:', err.message);
    }
  }

  function handleNavigate() {
    navigation.navigate('Chat');
  }

  const trendByDay = weekCheckIns.reduce((acc, c) => {
    acc[c.day.slice(0, 10)] = c.mood;
    return acc;
  }, {});
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.orbTopRight} />
        <View style={styles.orbTopLeft} />
        <View style={styles.orbBottomRight} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name}>{user?.displayName || 'there'}</Text>
            <Text style={styles.feelingPrompt}>How are you feeling today?</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(user?.displayName)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.checkInRow}>
            {CHECK_IN_OPTIONS.map((opt) => {
              const active = checkIn === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => handleCheckIn(opt.key)}
                  style={[styles.checkInOption, active && styles.checkInActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.checkInLabel, active && styles.checkInLabelActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {checkIn ? (
          <View style={styles.wellbeingSection}>
            <Text style={styles.insightPrimary}>
              {checkIn === 'good' && "Glad you're doing well today."}
              {checkIn === 'okay' && 'Thanks for checking in — okay is a fine place to be.'}
              {checkIn === 'low' && "Thanks for letting Nea know you're feeling low."}
              {checkIn === 'stressed' && "Noted — today's been a stressed one."}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.modesRow}>
            {SUPPORT_MODES.map((mode) => (
              <Pressable
                key={mode.key}
                onPress={() => navigation.navigate('Chat', { supportMode: mode.key })}
                style={({ pressed }) => [styles.modeCircleItem, pressed && styles.pressedMode]}
              >
                <View style={styles.modeIconCircle}>
                  <Ionicons name={mode.icon} size={22} color={colors.navy} />
                </View>
                <Text style={styles.modeLabel}>{mode.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionHeadingMuted}>Weekly Pattern</Text>
          <View style={styles.patternContainer}>
            <View style={styles.patternDaysRow}>
              {last7Days.map((d, i) => {
                const key = d.toISOString().slice(0, 10);
                const mood = trendByDay[key];
                const level = mood ? MOOD_LEVEL[mood] : null;
                const isLow = level === 0 || level === 1;
                return (
                  <View key={key} style={styles.patternDayCol}>
                    <Text style={[styles.patternDayLabel, isLow && styles.patternDayLabelActive]}>{DAY_LETTERS[d.getDay()]}</Text>
                    <View style={[styles.patternCircle, level != null && (isLow ? styles.patternCircleStressed : styles.patternCircleOk)]} />
                  </View>
                );
              })}
            </View>
            {weekCheckIns.length === 0 && !loading && (
              <View style={styles.patternInsightBox}>
                <Ionicons name="sparkles" size={16} color={colors.navy} style={{ marginTop: 2 }} />
                <Text style={styles.patternInsightText}>Check in daily to build up your weekly pattern here.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionHeadingMuted}>A note from Nea</Text>
          <Text style={styles.insightBody}>
            {latestCapsule ? latestCapsule.summary : 'As you share more, Nea will leave gentle reflections here — little things worth noticing.'}
          </Text>
        </View>

        {recentSessions.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionHeadingMuted}>Recent conversations</Text>
              {recentSessions.map((s) => (
                <View key={s.id} style={styles.recentRow}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.muted} />
                  <Text style={styles.recentText}>
                    {s.modality.charAt(0).toUpperCase() + s.modality.slice(1)} · {new Date(s.startedAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Pressable onPress={handleNavigate} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
        <Ionicons name="chatbubbles" size={20} color={colors.navy} />
        <Text style={styles.fabText}>Ask Nea</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FCFDFF' },
  orbTopRight: { position: 'absolute', top: -120, right: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: '#EAF2FF', opacity: 0.6 },
  orbTopLeft: { position: 'absolute', top: 60, left: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: '#F3F6FC', opacity: 0.7 },
  orbBottomRight: { position: 'absolute', bottom: -150, right: -100, width: 450, height: 450, borderRadius: 225, backgroundColor: '#F1F6FF', opacity: 0.6 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40, paddingTop: 10 },
  headerText: { flex: 1 },
  greeting: { fontSize: 22, fontFamily: serifFontRegular, color: colors.secondary, marginBottom: 4 },
  name: { fontSize: 40, fontFamily: serifFontBold, color: colors.navy, letterSpacing: -1 },
  feelingPrompt: { fontSize: 18, fontFamily: serifFontRegular, color: colors.secondary, marginTop: 10, lineHeight: 26 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E4EDFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '600', color: colors.navy },
  section: { marginBottom: 28 },
  wellbeingSection: { marginBottom: 42 },
  sectionHeadingMuted: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  divider: { height: 1, backgroundColor: 'rgba(232, 238, 248, 0.6)', marginVertical: 28 },
  checkInRow: { flexDirection: 'row', gap: 8 },
  checkInOption: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.6)', borderWidth: 1, borderColor: 'rgba(232, 238, 248, 0.8)' },
  checkInActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  checkInLabel: { fontSize: 14, fontWeight: '500', color: colors.muted },
  checkInLabelActive: { color: '#FFFFFF', fontWeight: '600' },
  insightPrimary: { fontSize: 28, fontFamily: serifFontBold, lineHeight: 36, color: colors.navy, letterSpacing: -0.5, marginBottom: 12 },
  modesRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  modeCircleItem: { alignItems: 'center', gap: 8 },
  modeIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: colors.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  modeLabel: { fontSize: 13, fontWeight: '500', color: colors.navy },
  pressedMode: { opacity: 0.6 },
  patternContainer: { marginTop: 4 },
  patternDaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 12 },
  patternDayCol: { alignItems: 'center', gap: 8 },
  patternDayLabel: { fontSize: 13, color: '#A0B0D0', fontWeight: '600' },
  patternDayLabelActive: { color: colors.navy },
  patternCircle: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E4EDFF' },
  patternCircleStressed: { backgroundColor: colors.navy },
  patternCircleOk: { backgroundColor: '#9FB8EC' },
  patternInsightBox: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.6)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(232, 238, 248, 0.8)', gap: 12 },
  patternInsightText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.navy, fontWeight: '400' },
  insightBody: { fontSize: 16, lineHeight: 24, color: colors.navy },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  recentText: { fontSize: 14, color: colors.secondary },
  fab: { position: 'absolute', bottom: 24, right: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 28, backgroundColor: colors.translation, shadowColor: colors.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  fabPressed: { opacity: 0.8 },
  fabText: { color: colors.navy, fontSize: 16, fontWeight: '600' },
});
