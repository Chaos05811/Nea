import React, { useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Logo from '../components/Logo';
import { colors } from '../theme';
import { useAuth } from '../api/AuthContext';

const AGE_GROUPS = [
  { key: 'child', label: 'Child' },
  { key: 'teen', label: 'Teen' },
  { key: 'adult', label: 'Adult' },
  { key: 'senior', label: 'Senior' },
];

export default function WelcomeScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ageGroup, setAgeGroup] = useState('adult');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (mode === 'signup' && !displayName.trim()) {
      setError('Please tell us what to call you.');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp({ email: email.trim(), password, displayName: displayName.trim(), ageGroup, language: 'en' });
      } else {
        await signIn({ email: email.trim(), password });
      }
    } catch (err) {
      setError(friendlyAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Logo size={64} />
            <Text style={styles.title}>Nea</Text>
            <Text style={styles.tagline}>Your everyday companion</Text>
          </View>

          <View style={styles.tabs}>
            <Pressable
              testID="tab-signin"
              onPress={() => setMode('signin')}
              style={[styles.tab, mode === 'signin' && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>Sign in</Text>
            </Pressable>
            <Pressable
              testID="tab-signup"
              onPress={() => setMode('signup')}
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Sign up</Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={styles.label}>What should Nea call you?</Text>
                <TextInput
                  testID="input-displayname"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your name"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="input-email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="input-password"
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                placeholderTextColor={colors.muted}
                style={styles.input}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={styles.label}>Age group</Text>
                <View style={styles.chipRow}>
                  {AGE_GROUPS.map((g) => (
                    <Pressable
                      key={g.key}
                      onPress={() => setAgeGroup(g.key)}
                      style={[styles.chip, ageGroup === g.key && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, ageGroup === g.key && styles.chipTextActive]}>{g.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              testID="submit-auth"
              accessibilityRole="button"
              disabled={loading}
              onPress={handleSubmit}
              style={({ pressed }) => [styles.button, (pressed || loading) && styles.pressed]}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function friendlyAuthError(message) {
  if (!message) return 'Something went wrong. Please try again.';
  if (message.includes('auth/email-already-in-use')) return 'An account with this email already exists — try signing in instead.';
  if (message.includes('auth/invalid-email')) return 'That email address looks invalid.';
  if (message.includes('auth/weak-password')) return 'Password should be at least 6 characters.';
  if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password') || message.includes('auth/user-not-found')) {
    return 'Incorrect email or password.';
  }
  return message;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 28, paddingBottom: 60 },
  brand: { alignItems: 'center', marginBottom: 36 },
  title: { color: colors.navy, fontSize: 36, lineHeight: 46, fontWeight: '600', letterSpacing: -1, marginTop: 14 },
  tagline: { color: colors.secondary, fontSize: 16, lineHeight: 22, marginTop: 4, textAlign: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: colors.understood, borderRadius: 14, padding: 4, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.navy },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.navy },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: colors.navy, backgroundColor: '#FFFFFF' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 14, color: colors.navy, fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF' },
  error: { color: '#B3261E', fontSize: 14, textAlign: 'center' },
  button: { minHeight: 54, borderRadius: 16, backgroundColor: colors.navy, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  pressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
