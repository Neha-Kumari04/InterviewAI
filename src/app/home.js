import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuth } from '../services/auth';
import { getJob, countQuestions } from '../data/jobs';
import { listSessions } from '../services/session';
import { hasApiKey, useSettings } from '../services/settings';
import { AppButton, Card, Divider, Screen, SectionTitle, Tag } from '../components/ui';
import { colors, spacing, typography } from '../theme';

function formatDate(ts) {
  return new Date(ts).toLocaleDateString();
}

export default function HomeScreen() {
  const { auth, signOut } = useAuth();
  const settings = useSettings();
  const job = auth ? getJob(auth.jobId) : null;
  const [recent, setRecent] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      listSessions().then((list) => {
        if (mounted) setRecent(list.slice(0, 3));
      });
      return () => {
        mounted = false;
      };
    }, [])
  );

  if (!auth) return <Redirect href="/login" />;

  return (
    <Screen scroll>
      <Card>
        <SectionTitle>Signed in as</SectionTitle>
        <Text style={typography.h2}>{auth.candidateName}</Text>
        <Text style={typography.sub}>
          @{auth.username} · {auth.email}
        </Text>
      </Card>

      <Card>
        <SectionTitle>Assigned interview</SectionTitle>
        <Text style={typography.h2}>{job ? job.title : auth.jobTitle}</Text>
        <Text style={typography.sub}>
          {job ? job.company : auth.company} · {job ? job.location : ''}
        </Text>
        <Text style={[typography.body, { marginTop: spacing.xs }]}>{job ? job.description : ''}</Text>
        <View style={styles.tagRow}>
          <Tag>{`${countQuestions(job)} questions`}</Tag>
          <Tag color={colors.accent}>{`${job ? job.topics.length : 0} topics`}</Tag>
          <Tag color={colors.success}>{job ? job.experience : ''}</Tag>
        </View>
        <Divider />
        <Text style={typography.sub}>
          Your interview includes voice and camera pre-checks, an AI interviewer that speaks each question, answer
          recording with AI analysis, and proctoring for fairness.
        </Text>
      </Card>

      {!hasApiKey(settings) ? (
        <Card style={{ borderColor: colors.warn + '55' }}>
          <Text style={[typography.sub, { color: colors.warn }]}>
            Speech-to-text and AI answers are running in offline demo mode. Add an OpenAI API key in Settings for live
            transcription and smarter feedback.
          </Text>
        </Card>
      ) : null}

      <AppButton title="Run pre-interview checks" onPress={() => router.push('/preflight')} />
      <AppButton title="Past interviews" variant="secondary" onPress={() => router.push('/sessions')} />
      <AppButton title="Settings" variant="secondary" onPress={() => router.push('/settings')} />
      <AppButton title="Sign out" variant="danger" onPress={signOut} />

      {recent.length ? (
        <Card>
          <SectionTitle>Recent sessions</SectionTitle>
          {recent.map((s) => (
            <Text
              key={s.id}
              style={[typography.sub, styles.recentRow]}
              onPress={() => router.push({ pathname: '/report', params: { id: s.id } })}
            >
              {s.jobTitle} · {s.overallScore != null ? `${s.overallScore}/100` : 'n/a'} · {formatDate(s.startedAt)}
            </Text>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  recentRow: { color: colors.primary, paddingVertical: 4 },
});
