import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { useAuth } from '../api/AuthContext';

const AGE_GROUPS = [
  { key: 'child', label: 'Child' },
  { key: 'teen', label: 'Teen' },
  { key: 'adult', label: 'Adult' },
  { key: 'senior', label: 'Senior' },
];

const LANGUAGE_LABELS = { en: 'English', hi: 'हिंदी' };

export default function ProfileScreen() {
  const { user, signOut, updateProfile } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [ageGroup, setAgeGroup] = useState(user?.ageGroup || 'adult');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDisplayName(user?.displayName || '');
      setAgeGroup(user?.ageGroup || 'adult');
      setError('');
    }
  }, [user, editing]);

  function startEditing() {
    setDisplayName(user?.displayName || '');
    setAgeGroup(user?.ageGroup || 'adult');
    setError('');
    setSavedFlash(false);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError('');
  }

  async function handleSave() {
    const name = displayName.trim();
    if (!name) {
      setError('Please enter a name.');
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    setError('');
    try {
      await updateProfile({ displayName: name, ageGroup });
      setEditing(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(err.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    setConfirming(true);
  }

  const ageLabel = AGE_GROUPS.find((g) => g.key === user?.ageGroup)?.label || 'Not set';
  const languageLabel = LANGUAGE_LABELS[user?.language] || user?.language || 'English';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(editing ? displayName : user?.displayName)?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.name}>{editing ? (displayName.trim() || 'Your name') : (user?.displayName || 'Your profile')}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {savedFlash ? <Text style={styles.savedText}>Profile saved</Text> : null}
        </View>

        {!editing ? (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Name</Text>
                <Text style={styles.rowValue}>{user?.displayName || 'Not set'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Age group</Text>
                <Text style={styles.rowValue}>{ageLabel}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Language</Text>
                <Text style={styles.rowValue}>{languageLabel}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Member since</Text>
                <Text style={styles.rowValue}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</Text>
              </View>
            </View>

            <Pressable testID="edit-profile" accessibilityRole="button" style={({ pressed }) => [styles.editButton, pressed && styles.pressed]} onPress={startEditing}>
              <Ionicons name="create-outline" size={20} color={colors.navy} />
              <Text style={styles.editButtonText}>Edit details</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.editCard}>
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                testID="profile-displayname"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="What should Nea call you?"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="words"
                editable={!saving}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Age group</Text>
              <View style={styles.chipRow}>
                {AGE_GROUPS.map((g) => {
                  const active = ageGroup === g.key;
                  return (
                    <Pressable
                      key={g.key}
                      testID={`age-${g.key}`}
                      onPress={() => !saving && setAgeGroup(g.key)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{g.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.editActions}>
              <Pressable testID="cancel-edit-profile" style={[styles.actionButton, styles.cancelEditButton]} onPress={cancelEditing} disabled={saving}>
                <Text style={styles.cancelEditText}>Cancel</Text>
              </Pressable>
              <Pressable testID="save-profile" style={[styles.actionButton, styles.saveButton]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        )}

        <Pressable testID="sign-out" accessibilityRole="button" style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#B3261E" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={confirming} transparent animationType="none" onRequestClose={() => setConfirming(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" style={StyleSheet.absoluteFillObject} onPress={() => setConfirming(false)} />
          <View style={styles.confirmPanel}>
            <Text style={styles.confirmTitle}>Sign out</Text>
            <Text style={styles.confirmBody}>Are you sure you want to sign out?</Text>
            <View style={styles.confirmActions}>
              <Pressable testID="cancel-sign-out" style={[styles.confirmButton, styles.cancelButton]} onPress={() => setConfirming(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable testID="confirm-sign-out" style={[styles.confirmButton, styles.destructiveButton]} onPress={() => { setConfirming(false); signOut(); }}>
                <Text style={styles.destructiveButtonText}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#E4EDFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText: { fontSize: 28, fontWeight: '600', color: colors.navy },
  name: { fontSize: 22, fontWeight: '600', color: colors.navy, letterSpacing: -0.5 },
  email: { fontSize: 14, color: colors.muted, marginTop: 4 },
  savedText: { marginTop: 8, fontSize: 13, fontWeight: '600', color: colors.green },
  card: { backgroundColor: '#F8FAFF', borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  rowLabel: { fontSize: 15, color: colors.muted },
  rowValue: { fontSize: 15, color: colors.navy, fontWeight: '500', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  editButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#CDDCF9', backgroundColor: colors.translation, marginBottom: 16 },
  editButtonText: { fontSize: 16, fontWeight: '600', color: colors.navy },
  editCard: { backgroundColor: '#F8FAFF', borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16, gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.navy },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontSize: 16, color: colors.navy },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 14, fontWeight: '500', color: colors.muted },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  errorText: { fontSize: 13, color: '#B3261E' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelEditButton: { backgroundColor: colors.understood },
  cancelEditText: { fontSize: 15, fontWeight: '600', color: colors.navy },
  saveButton: { backgroundColor: colors.navy },
  saveButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#F3D0CE', backgroundColor: '#FDECEC' },
  signOutText: { fontSize: 16, fontWeight: '600', color: '#B3261E' },
  pressed: { opacity: 0.75 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 38, 74, 0.22)', padding: 22 },
  confirmPanel: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border },
  confirmTitle: { fontSize: 18, fontWeight: '600', color: colors.navy, marginBottom: 6 },
  confirmBody: { fontSize: 14, color: colors.muted, marginBottom: 20 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmButton: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { backgroundColor: colors.understood },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: colors.navy },
  destructiveButton: { backgroundColor: '#B3261E' },
  destructiveButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
