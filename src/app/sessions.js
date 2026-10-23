import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppButton, Card, Screen, SectionTitle, StatusPill } from '../components/ui';
import { clearAllSessions, listSessions } from '../services/session';
import { colors, gradeForScore, spacing, typography } from '../theme';

function formatDateTime(ts) {
  return new Date(ts).toLocaleString();
}

export default function SessionsScreen() {
  const [sessions, setSessions] = useState([]);

  const refresh = useCallback(() => {
    listSessions().then(setSessions);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  function confirmClear() {
    Alert.alert('Clear all interviews?', 'This removes all saved interview reports and recordings from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: async () => {
          await clearAllSessions();
          refresh();
        },
      },
    ]);
  }

  return (
    <Screen scroll>
      {sessions.length ? (
        <>
          <SectionTitle>{`${sessions.length} session(s)`}</SectionTitle>
          {sessions.map((s) => {
            const grade = gradeForScore(s.overallScore == null ? 0 : s.overallScore);
            return (
              <Pressable
                key={s.id}
                onPress={() => router.push({ pathname: '/report', params: { id: s.id } })}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.h3, { fontSize: 15 }]}>{s.jobTitle}</Text>
                  <Text style={typography.sub}>
                    {formatDateTime(s.startedAt)} · {s.answerCount} answers
                  </Text>
                  <Text style={[typography.caption, { marginTop: 2 }]}>{s.id}</Text>
                </View>
                <View style={styles.right}>
                  <Text style={[typography.h2, { color: grade.color, fontSize: 20 }]}>
                    {s.overallScore != null ? s.overallScore : '—'}
                  </Text>
                  {s.integrityFlags ? <StatusPill status="warn" label={`${s.integrityFlags} FLAG`} /> : null}
                </View>
              </Pressable>
            );
          })}
          <AppButton title="Clear all sessions" variant="danger" onPress={confirmClear} />
        </>
      ) : (
        <Card>
          <SectionTitle>No interviews yet</SectionTitle>
          <Text style={typography.sub}>Completed interviews will appear here with scores, feedback and recordings.</Text>
          <AppButton title="Go to home" onPress={() => router.replace('/home')} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  right: { alignItems: 'flex-end', gap: 6 },
});
