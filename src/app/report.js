import React, { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppButton, Card, Divider, Screen, SectionTitle, StatusPill, Tag } from '../components/ui';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import { loadSession } from '../services/session';
import { colors, gradeForScore, spacing, typography } from '../theme';

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s}s`;
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString();
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString();
}

export default function ReportScreen() {
  const { id } = useLocalSearchParams();
  const [session, setSession] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const { play, playingUri } = useAudioPlayback();

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      loadSession(String(id))
        .then((s) => {
          if (!mounted) return;
          if (s) setSession(s);
          else setNotFound(true);
        })
        .catch(() => setNotFound(true));
      return () => {
        mounted = false;
      };
    }, [id])
  );

  if (notFound) {
    return (
      <Screen>
        <Card>
          <Text style={typography.h3}>Report not found</Text>
          <Text style={typography.sub}>This interview session could not be loaded.</Text>
          <AppButton title="Back to home" onPress={() => router.replace('/home')} />
        </Card>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <Card>
          <Text style={typography.h3}>Loading report…</Text>
        </Card>
      </Screen>
    );
  }

  const score = session.summary ? session.summary.overallScore : null;
  const grade = gradeForScore(score == null ? 0 : score);
  const integrityEvents = session.integrity && session.integrity.events ? session.integrity.events : [];

  async function onShare() {
    const lines = [
      `InterviewAI report — ${session.jobTitle} at ${session.company}`,
      `Candidate: ${session.candidateName} (@${session.username})`,
      `Date: ${formatDateTime(session.createdAt)}`,
      `Overall score: ${score != null ? score + '/100' : 'n/a'} (${grade.letter} — ${grade.label})`,
      session.summary && session.summary.recommendation ? `Recommendation: ${session.summary.recommendation}` : '',
      session.summary ? session.summary.writtenSummary : '',
      integrityEvents.length ? `Integrity events: ${integrityEvents.length}` : 'Integrity: clean session',
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n\n'), title: `Interview report — ${session.jobTitle}` });
    } catch {
    }
  }

  return (
    <Screen scroll>
      <Card>
        <SectionTitle>Result</SectionTitle>
        <Text style={typography.h2}>
          {session.jobTitle} · {session.company}
        </Text>
        <Text style={typography.sub}>
          {session.candidateName} · {formatDateTime(session.createdAt)} ·{' '}
          {formatDuration((session.endedAt || session.createdAt) - session.createdAt)}
        </Text>
        <View style={styles.scoreRow}>
          <View style={[styles.scoreCircle, { borderColor: grade.color }]}>
            <Text style={[styles.scoreValue, { color: grade.color }]}>{score != null ? score : '—'}</Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[typography.h3, { color: grade.color }]}>
              {grade.letter} — {grade.label}
            </Text>
            {session.summary && session.summary.recommendation ? <Tag color={colors.accent}>{session.summary.recommendation}</Tag> : null}
            <Text style={typography.sub}>{session.answers.length} answers recorded</Text>
          </View>
        </View>
        <AppButton title="Share report" variant="secondary" onPress={onShare} />
      </Card>

      {session.summary ? (
        <Card>
          <SectionTitle>AI interviewer summary</SectionTitle>
          <Text style={typography.body}>{session.summary.writtenSummary}</Text>
          <Divider />
          <SectionTitle>Per topic</SectionTitle>
          {Object.keys(session.summary.perTopic || {}).map((topic) => (
            <View key={topic} style={styles.topicRow}>
              <Text style={[typography.sub, { flex: 1, color: colors.text }]}>{topic}</Text>
              <Text
                style={[
                  typography.sub,
                  {
                    color: session.summary.perTopic[topic] >= 65 ? colors.success : session.summary.perTopic[topic] >= 50 ? colors.warn : colors.danger,
                    fontWeight: '800',
                  },
                ]}
              >
                {session.summary.perTopic[topic]}/100
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Question by question</SectionTitle>
        {session.answers.map((a, idx) => (
          <View key={`${a.questionId}-${idx}`} style={styles.answerBlock}>
            <View style={styles.answerHeader}>
              <Text style={[typography.caption, { flex: 1 }]}>
                Q{a.qIndex} · {a.topic} {a.isFollowUp ? '· follow-up' : ''}
              </Text>
              <StatusPill status={a.score >= 55 ? 'pass' : a.score >= 40 ? 'warn' : 'fail'} label={`${a.score}/100`} />
            </View>
            <Text style={[typography.body, { fontWeight: '600' }]}>{a.question}</Text>
            <Text style={typography.sub}>“{a.transcript || '(no spoken answer transcribed)'}”</Text>
            {a.strengths && a.strengths.length ? (
              <Text style={[typography.sub, { color: colors.success }]}>Strengths: {a.strengths.join('; ')}</Text>
            ) : null}
            {a.gaps && a.gaps.length ? (
              <Text style={[typography.sub, { color: colors.warn }]}>Improve: {a.gaps.join('; ')}</Text>
            ) : null}
            {a.feedbackText ? <Text style={typography.body}>{a.feedbackText}</Text> : null}
            {a.segmentUri ? (
              <AppButton
                small
                variant="secondary"
                title={playingUri === a.segmentUri ? 'Stop recording' : 'Play recorded answer'}
                onPress={() => play(a.segmentUri)}
              />
            ) : null}
            <Divider />
          </View>
        ))}
        {!session.answers.length ? <Text style={typography.sub}>No answers were recorded.</Text> : null}
      </Card>

      <Card style={integrityEvents.length ? { borderColor: colors.warn + '55' } : {}}>
        <SectionTitle>Fair-interview monitoring</SectionTitle>
        {session.integrity && session.integrity.summary ? (
          <Text style={typography.sub}>
            {session.integrity.summary.framesAnalyzed} camera samples analysed ·{' '}
            {Math.round((session.integrity.summary.avgMotion || 0) * 100)}% average frame change ·{' '}
            {integrityEvents.length} event(s)
          </Text>
        ) : null}
        {integrityEvents.length ? (
          integrityEvents.slice(0, 12).map((e, i) => (
            <Text key={i} style={[typography.sub, { color: colors.warn }]}>
              {formatTime(e.t)} — {e.detail || e.type}
            </Text>
          ))
        ) : (
          <Text style={[typography.sub, { color: colors.success }]}>
            Clean session — the candidate stayed in frame with the camera uncovered.
          </Text>
        )}
      </Card>

      <AppButton title="Back to home" onPress={() => router.replace('/home')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginVertical: spacing.sm },
  scoreCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  scoreValue: { fontSize: 30, fontWeight: '900' },
  scoreOutOf: { color: colors.textFaint, fontSize: 13, fontWeight: '700', marginTop: 10 },
  topicRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  answerBlock: { gap: 6, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  answerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
