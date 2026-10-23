import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../services/auth';
import { DEMO_HINT } from '../data/credentials';
import { AppButton, Card, Input, Screen, SectionTitle } from '../components/ui';
import { colors, radius, spacing, typography } from '../theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await signIn(username, password);
      if (result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace('/home');
      } else {
        setError(result.error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.logoWrap}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoGlyph}>AI</Text>
          </View>
          <Text style={[typography.title, { marginTop: spacing.lg }]}>InterviewAI</Text>
          <Text style={[typography.sub, { textAlign: 'center', marginTop: spacing.xs }]}>
            Voice + video AI interviewer for real job interviews
          </Text>
        </View>

        <Card style={{ marginTop: spacing.xl }}>
          <SectionTitle>Candidate login</SectionTitle>
          <Text style={typography.sub}>Use the username and password issued by your recruiter.</Text>
          <Input
            value={username}
            onChangeText={setUsername}
            placeholder="Recruiter username"
            autoCapitalize="none"
          />
          <Input value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <AppButton title={loading ? 'Verifying…' : 'Verify & continue'} onPress={onSubmit} loading={loading} />
        </Card>

        <Text style={[typography.sub, { color: colors.textFaint, textAlign: 'center', marginTop: spacing.lg }]}>
          {DEMO_HINT}
        </Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoWrap: { alignItems: 'center', marginTop: spacing.xxl, gap: 2 },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: { color: colors.primary, fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger + '55',
  },
  errorText: { color: colors.danger, fontSize: 13.5, lineHeight: 19 },
});
