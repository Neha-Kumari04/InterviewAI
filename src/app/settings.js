import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, Card, Input, Screen, SectionTitle } from '../components/ui';
import { loadSettings, saveSettings } from '../services/settings';
import { configureTts } from '../services/tts';
import { colors, radius, spacing, typography } from '../theme';

const LANGUAGES = ['en-US', 'en-IN', 'hi-IN', 'es-ES', 'fr-FR', 'de-DE'];
const RATES = [
  { label: '0.85×', value: 0.85 },
  { label: '1.0×', value: 1.0 },
  { label: '1.15×', value: 1.15 },
  { label: '1.3×', value: 1.3 },
];

export default function SettingsScreen() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then(setForm);
  }, []);

  if (!form) {
    return (
      <Screen>
        <Card>
          <Text style={typography.sub}>Loading settings…</Text>
        </Card>
      </Screen>
    );
  }

  function update(partial) {
    setForm((f) => ({ ...f, ...partial }));
    setSaved(false);
  }

  async function onSave() {
    const next = await saveSettings(form);
    configureTts(next);
    setSaved(true);
  }

  return (
    <Screen scroll>
      <Card>
        <SectionTitle>AI speech-to-text & answers</SectionTitle>
        <Text style={typography.sub}>
          Add an OpenAI API key to transcribe your spoken answers (Whisper) and get smarter AI scoring, follow-ups and
          summaries. Without a key, the app uses an offline scoring engine and typed answers.
        </Text>
        <Input
          value={form.apiKey}
          onChangeText={(v) => update({ apiKey: v })}
          placeholder="sk-…"
          secureTextEntry
          autoCapitalize="none"
        />
        <Text style={typography.caption}>Stored only on this device</Text>
      </Card>

      <Card>
        <SectionTitle>Interviewer voice (text-to-speech)</SectionTitle>
        <View style={styles.chipRow}>
          {LANGUAGES.map((lang) => (
            <Pressable
              key={lang}
              onPress={() => update({ speechLanguage: lang })}
              style={[styles.chip, form.speechLanguage === lang && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.speechLanguage === lang && styles.chipTextActive]}>{lang}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[typography.caption, { marginTop: spacing.sm }]}>Speaking rate</Text>
        <View style={styles.chipRow}>
          {RATES.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => update({ speechRate: r.value })}
              style={[styles.chip, Math.abs(form.speechRate - r.value) < 0.01 && styles.chipActive]}
            >
              <Text style={[styles.chipText, Math.abs(form.speechRate - r.value) < 0.01 && styles.chipTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={[typography.body, { flex: 1 }]}>Speak questions and feedback out loud</Text>
          <Switch
            value={form.voiceEnabled}
            onValueChange={(v) => update({ voiceEnabled: v })}
            trackColor={{ true: colors.primary, false: colors.cardAlt }}
            thumbColor="#fff"
          />
        </View>
      </Card>

      <Card>
        <SectionTitle>Fair-interview monitoring</SectionTitle>
        <Text style={typography.sub}>
          Periodically samples the camera to verify you stay in frame, the lens is not covered and the app stays open.
        </Text>
        <View style={styles.switchRow}>
          <Text style={[typography.body, { flex: 1 }]}>Enable camera monitoring</Text>
          <Switch
            value={form.monitoringEnabled}
            onValueChange={(v) => update({ monitoringEnabled: v })}
            trackColor={{ true: colors.primary, false: colors.cardAlt }}
            thumbColor="#fff"
          />
        </View>
      </Card>

      <AppButton title={saved ? 'Saved ✓' : 'Save settings'} variant={saved ? 'success' : 'primary'} onPress={onSave} />
      <AppButton title="Back to home" variant="ghost" onPress={() => router.replace('/home')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.textSub, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: colors.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
});
