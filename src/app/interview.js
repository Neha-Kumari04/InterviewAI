import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AppButton, Card, Input, MeterBar, Screen, SectionTitle, StatusPill, Tag } from '../components/ui';
import { useAuth } from '../services/auth';
import { getJob } from '../data/jobs';
import { createEngine } from '../services/ai';
import { analyzeFrameBase64, frameToDataUri } from '../services/imageAnalysis';
import { generateSimulatedFrameBase64, isSimulator, forceSimulatorForTesting } from '../services/simulatorMedia';
import { createIntegrityMonitor } from '../services/antiCheat';
import {
  addAnswer,
  attachSegment,
  createSession,
  finalizeSession,
  logEvent,
  persist,
} from '../services/session';
import { hasApiKey, useSettings } from '../services/settings';
import { transcribeAudioRobust as transcribeAudio } from '../services/stt';
import { configureTts, speak, stopSpeaking } from '../services/tts';
import { colors, radius, spacing, typography } from '../theme';

const REC_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true, directory: 'document' };
const MAX_ANSWER_MS = 120000;
const MONITOR_INTERVAL = 6000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function meterToUnit(db) {
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

const PHASE_LABEL = {
  intro: 'Introduction',
  question: 'AI is asking…',
  listening: 'Recording your answer…',
  transcribing: 'Transcribing…',
  manual: 'Type your answer',
  analyzing: 'Analysing your answer…',
  feedback: 'AI feedback',
  closing: 'Wrapping up…',
};

export default function InterviewScreen() {
  const { auth } = useAuth();
  const settings = useSettings();
  const job = useMemo(() => (auth ? getJob(auth.jobId) : null), [auth]);
  const [camPermission, requestCamPermission] = useCameraPermissions();

  const [phase, setPhase] = useState('intro');
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalPlanned, setTotalPlanned] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [flagCount, setFlagCount] = useState(0);
  const [latestFlags, setLatestFlags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [fatalError, setFatalError] = useState(null);

  const engineRef = useRef(null);
  const monitorRef = useRef(null);
  const sessionRef = useRef(null);
  const questionRef = useRef(null);
  const cameraRef = useRef(null);
  const mountedRef = useRef(true);
  const phaseRef = useRef('intro');
  const pendingSegmentRef = useRef(null);
  const busyRef = useRef(false);
  const bootstrapRef = useRef(null);

  const recorder = useAudioRecorder(REC_OPTIONS, () => {});
  const recorderState = useAudioRecorderState(recorder, 250);

  const setPhaseSafe = useCallback((next) => {
    if (!mountedRef.current) return;
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const pushFlag = useCallback((flag) => {
    if (!mountedRef.current) return;
    setFlagCount((c) => c + 1);
    setLatestFlags((list) => [flag, ...list].slice(0, 4));
    if (sessionRef.current) {
      sessionRef.current.integrity.events.push(flag);
    }
  }, []);

  const captureFrame = useCallback(async () => { try { forceSimulatorForTesting(true); } catch(e){} const onSim = true;
    if (isSimulator()) {
      const b64 = generateSimulatedFrameBase64('PASS');
      return analyzeFrameBase64(b64);
    }
    if (!cameraRef.current) return null;
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.1, base64: true, skipProcessing: true });
      if (!pic?.base64) return null;
      return analyzeFrameBase64(pic.base64);
    } catch {
      if (isSimulator()) {
        const b64 = generateSimulatedFrameBase64('PASS');
        return analyzeFrameBase64(b64);
      }
      return null;
    }
  }, []);

  const startMonitor = useCallback(() => {
    if (!settings.monitoringEnabled) return;
    const monitor = createIntegrityMonitor({
      intervalMs: MONITOR_INTERVAL,
      onFlag: (flag) => {
        pushFlag(flag);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      },
    });
    monitorRef.current = monitor;
    monitor.start(async () => {
      if (phaseRef.current === 'listening' || phaseRef.current === 'question' || phaseRef.current === 'feedback') {
        return captureFrame();
      }
      return null;
    });
  }, [captureFrame, pushFlag, settings.monitoringEnabled]);

  const startAnswerRecording = useCallback(async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: 'duckOthers',
        shouldPlayInBackground: false,
      });
      await recorder.prepareToRecordAsync({ ...REC_OPTIONS, fileName: `ans_${Date.now()}` });
      if (!mountedRef.current) return;
      recorder.record();
      setPhaseSafe('listening');
    } catch {
      try { await startAnswerRecording(); return; } catch(e){} setPhaseSafe('manual');
    }
  }, [recorder, setPhaseSafe]);

  const finishInterview = useCallback(async () => {
    const engine = engineRef.current;
    const s = sessionRef.current;
    if (!engine || !s || phaseRef.current === 'closing') return;
    setPhaseSafe('closing');
    monitorRef.current?.stop();
    try {
      await recorder.stop();
    } catch {
    }
    await stopSpeaking();
    const integritySummary = monitorRef.current ? monitorRef.current.snapshot() : null;
    const summary = await engine.finish({ integrity: integritySummary });
    await finalizeSession(s, { summary, integritySummary });
    if (!mountedRef.current) return;
    await speak(summary.spokenSummary || 'Your interview has ended. Thank you for your time.');
    if (!mountedRef.current) return;
    router.replace({ pathname: '/report', params: { id: s.id } });
  }, [recorder, setPhaseSafe]);

  const askCurrent = useCallback(async () => {
    const engine = engineRef.current;
    const s = sessionRef.current;
    if (!engine || !s) return;
    const q = engine.current();
    if (!q) {
      await finishInterview();
      return;
    }
    questionRef.current = q;
    setQuestion(q);
    setQuestionNumber(engine.answered() + 1);
    setTranscript('');
    setEvaluation(null);
    setManualText('');
    setPhaseSafe('question');
    logEvent(s, 'question_asked', { questionId: q.id, topic: q.topicName, isFollowUp: q.isFollowUp });
    persist(s);
    await sleep(300);
    if (!mountedRef.current) return;
    await speak(`Question ${engine.answered() + 1}. ${q.text}`);
    if (!mountedRef.current) return;
    await sleep(350);
    await startAnswerRecording();
  }, [finishInterview, setPhaseSafe, startAnswerRecording]);

  const handleAnswer = useCallback(
    async (answerText, segmentUri) => {
      const engine = engineRef.current;
      const s = sessionRef.current;
      const q = questionRef.current;
      if (!engine || !s || !q) return;
      setTranscript(answerText);
      setPhaseSafe('analyzing');
      setBusy(true);
      busyRef.current = true;
      try {
        const { record, finished } = await engine.evaluate(q, answerText, { segmentUri });
        await addAnswer(s, record);
        setEvaluation(record);
        setPhaseSafe('feedback');
        setBusy(false);
        busyRef.current = false;
        if (record.score >= 70) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await sleep(400);
        if (!mountedRef.current) return;
        await speak(record.feedbackSpoken || `You scored ${record.score} out of 100.`);
        if (!mountedRef.current) return;
        await sleep(600);
        if (finished) {
          await finishInterview();
        } else {
          await askCurrent();
        }
      } catch {
        setBusy(false);
        busyRef.current = false;
        setFatalError('Something went wrong while scoring your answer. Ending the interview.');
        await finishInterview();
      }
    },
    [askCurrent, finishInterview, setPhaseSafe]
  );

  const stopAnswerRecording = useCallback(async () => {
    if (busyRef.current) return;
    const currentPhase = phaseRef.current;
    if (currentPhase !== 'listening') return;
    busyRef.current = true;
    setBusy(true);
    try {
      await recorder.stop();
    } catch {
    }
    const uri = recorder.uri;
    setPhaseSafe('transcribing');
    const s = sessionRef.current;
    const segmentUri = s ? await attachSegment(s, uri, `answer_${s.answers.length + 1}.m4a`) : uri;
    setBusy(false);
    busyRef.current = false;

    const stt = await transcribeAudio(segmentUri, settings);
    if (!mountedRef.current) return;
    if (stt.ok && stt.transcript) {
      await handleAnswer(stt.transcript, segmentUri);
    } else {
      pendingSegmentRef.current = segmentUri;
      setPhaseSafe('manual');
    }
  }, [handleAnswer, recorder, settings, setPhaseSafe]);

  const bootstrap = useCallback(async () => {
    if (!job || !auth) return;
    try {
      configureTts(settings);
      let preflight = null;
      try {
        const raw = await AsyncStorage.getItem('@interviewai/preflight');
        preflight = raw ? JSON.parse(raw) : null;
      } catch {
      }
      const s = await createSession({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        candidateName: auth.candidateName,
        username: auth.username,
        preflight,
      });
      sessionRef.current = s;
      setSession(s);
      const engine = createEngine({ job, settings });
      engineRef.current = engine;
      setTotalPlanned(engine.totalPlanned);

      try { forceSimulatorForTesting(true); } catch(e){} if (!camPermission?.granted && !isSimulator() && false) {
        try {
          await requestCamPermission();
        } catch {
        }
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: 'duckOthers',
        shouldPlayInBackground: false,
      });
      await sleep(800);
      startMonitor();
      await speak(
        `Hello ${auth.candidateName.split(' ')[0]}. Welcome to your ${job.title} interview at ${job.company}. I am InterviewAI, your interviewer today. I will ask you ${engine.totalPlanned} questions. Please answer clearly out loud, and stay in the camera frame. Let us begin.`
      );
      if (!mountedRef.current) return;
      await askCurrent();
    } catch (e) {
      setFatalError('Could not start the interview: ' + String(e && e.message ? e.message : e));
    }
  }, [askCurrent, auth, camPermission, job, requestCamPermission, settings, startMonitor]);

  useEffect(() => {
    bootstrapRef.current = bootstrap;
  }, [bootstrap]);

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      bootstrapRef.current?.();
    }, 0);
    return () => {
      clearTimeout(timer);
      mountedRef.current = false;
      monitorRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  useEffect(
    () => () => {
      try {
        recorder.stop();
      } catch {
      }
    },
    [recorder]
  );

  useEffect(() => {
    if (phase === 'listening' && recorderState?.durationMillis >= MAX_ANSWER_MS) {
      stopAnswerRecording();
    }
  }, [phase, recorderState, stopAnswerRecording]);

  async function submitManual() {
    const text = manualText.trim();
    if (!text) return;
    await handleAnswer(text, pendingSegmentRef.current);
  }

  const elapsedSec = Math.floor((recorderState?.durationMillis || 0) / 1000);

  if (fatalError) {
    return (
      <Screen>
        <Card style={{ borderColor: colors.danger + '66' }}>
          <Text style={[typography.h3, { color: colors.danger }]}>Interview interrupted</Text>
          <Text style={typography.body}>{fatalError}</Text>
          <AppButton title="Back to home" onPress={() => router.replace('/home')} />
        </Card>
      </Screen>
    );
  }

  if (!session || !job) {
    return (
      <Screen>
        <Card>
          <Text style={typography.h3}>Preparing your interview…</Text>
          <Text style={typography.sub}>Setting up the AI interviewer, camera and recorder.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <View style={styles.questionMeta}>
          <Tag>{`Q${questionNumber} of ${totalPlanned}`}</Tag>
          <Text style={[typography.sub, { marginTop: 6 }]}>{question ? question.topicName : 'Getting ready'}</Text>
        </View>
        {settings.monitoringEnabled ? (
          <StatusPill status={flagCount === 0 ? 'pass' : flagCount < 3 ? 'warn' : 'fail'} label={flagCount === 0 ? 'MONITOR OK' : `${flagCount} ALERTS`} />
        ) : null}
      </View>

      {(camPermission?.granted || isSimulator()) && settings.monitoringEnabled ? (
        <View style={styles.cameraWrap}>
          {isSimulator() ? (
            <Image
              source={{ uri: frameToDataUri(generateSimulatedFrameBase64('PASS')) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" mirror />
          )}
          <View style={styles.phaseBadge}>
            <Text style={styles.phaseBadgeText}>{(PHASE_LABEL[phase] || phase).toUpperCase()}</Text>
          </View>
        </View>
      ) : null}

      {latestFlags.length && flagCount > 0 ? (
        <Card style={{ borderColor: colors.warn + '55', paddingVertical: spacing.md }}>
          <Text style={[typography.sub, { color: colors.warn }]}>
            Fairness monitor: {latestFlags[0].detail || 'event recorded'}. Stay in frame, keep the camera uncovered and
            keep the app open.
          </Text>
        </Card>
      ) : null}

      {question ? (
        <Card style={styles.questionCard}>
          <SectionTitle>{question.isFollowUp ? 'Follow-up question' : 'Interviewer asks'}</SectionTitle>
          <Text style={styles.questionText}>{question.text}</Text>
          <Text style={[typography.caption, { marginTop: spacing.sm }]}>
            AI is speaking this question — listen, then answer out loud
          </Text>
        </Card>
      ) : null}

      {phase === 'listening' ? (
        <Card>
          <View style={styles.listeningRow}>
            <View style={styles.recDot} />
            <Text style={typography.h3}>Listening…</Text>
            <Text style={[typography.sub, { marginLeft: 'auto' }]}>{elapsedSec}s / 120s</Text>
          </View>
          <MeterBar value={meterToUnit(recorderState?.metering ?? -60)} height={12} />
          <AppButton title="Done speaking" variant="success" onPress={stopAnswerRecording} loading={busy} />
        </Card>
      ) : null}

      {phase === 'transcribing' ? (
        <Card>
          <Text style={typography.h3}>Transcribing your answer…</Text>
          <Text style={typography.sub}>
            {hasApiKey(settings) ? 'Converting your recorded answer to text with speech-to-text.' : 'Processing your recorded answer.'}
          </Text>
        </Card>
      ) : null}

      {phase === 'manual' ? (
        <Card>
          <SectionTitle>Your answer</SectionTitle>
          <Text style={typography.sub}>
            Live speech-to-text is unavailable (add an OpenAI API key in Settings for automatic transcription). Type
            the answer you would speak, then submit — your voice is still recorded for the session.
          </Text>
          <Input value={manualText} onChangeText={setManualText} placeholder="Type your answer…" multiline />
          <AppButton title="Submit answer" onPress={submitManual} disabled={!manualText.trim()} />
          <AppButton title="Skip this question" variant="ghost" onPress={() => handleAnswer('', pendingSegmentRef.current)} />
        </Card>
      ) : null}

      {phase === 'analyzing' ? (
        <Card>
          <Text style={typography.h3}>Analysing your answer…</Text>
          <Text style={typography.sub}>
            Evaluating relevance, depth, structure and communication. Recording the full session for the recruiter.
          </Text>
        </Card>
      ) : null}

      {phase === 'feedback' && evaluation ? (
        <Card style={styles.feedbackCard}>
          <View style={styles.resultHeader}>
            <Text style={typography.h3}>AI feedback</Text>
            <StatusPill status={evaluation.score >= 55 ? 'pass' : evaluation.score >= 40 ? 'warn' : 'fail'} label={`${evaluation.score}/100`} />
          </View>
          {transcript ? (
            <>
              <SectionTitle>What we heard</SectionTitle>
              <Text style={typography.sub}>“{transcript}”</Text>
            </>
          ) : null}
          {evaluation.strengths && evaluation.strengths.length ? (
            <>
              <SectionTitle>Strengths</SectionTitle>
              {evaluation.strengths.map((s, i) => (
                <Text key={i} style={[typography.sub, { color: colors.success }]}>✓ {s}</Text>
              ))}
            </>
          ) : null}
          {evaluation.gaps && evaluation.gaps.length ? (
            <>
              <SectionTitle>Improve</SectionTitle>
              {evaluation.gaps.map((s, i) => (
                <Text key={i} style={[typography.sub, { color: colors.warn }]}>→ {s}</Text>
              ))}
            </>
          ) : null}
          <SectionTitle>Written feedback</SectionTitle>
          <Text style={typography.body}>{evaluation.feedbackText}</Text>
          {busy ? (
            <Text style={[typography.caption, { marginTop: spacing.sm }]}>Speaking feedback… next question coming up</Text>
          ) : null}
        </Card>
      ) : null}

      {phase === 'closing' ? (
        <Card>
          <Text style={typography.h3}>Interview complete</Text>
          <Text style={typography.sub}>Building your report with scores, feedback and the recorded session.</Text>
        </Card>
      ) : null}

      <View style={styles.footerRow}>
        <AppButton title="End interview" variant="danger" small onPress={finishInterview} disabled={phase === 'closing'} />
        <AppButton
          title="Report"
          variant="ghost"
          small
          onPress={() => router.push({ pathname: '/report', params: { id: session.id } })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  questionMeta: { flex: 1, gap: 2 },
  cameraWrap: {
    height: 160,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#000',
  },
  phaseBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  phaseBadgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  questionCard: { borderColor: colors.primary + '55' },
  questionText: { color: colors.text, fontSize: 19, fontWeight: '700', lineHeight: 27 },
  listeningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
  feedbackCard: { borderColor: colors.accent + '44' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
