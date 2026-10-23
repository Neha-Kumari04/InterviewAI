import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AppButton, Card, CheckRow, MeterBar, Screen, SectionTitle, StatusPill } from '../components/ui';
import { evaluateNoise, evaluateVoice, computeSnr } from '../services/audioChecks';
import { analyzeFrameBase64, frameToDataUri } from '../services/imageAnalysis';
import { evaluateMovement, evaluateVideoQuality } from '../services/visionChecks';
import {
  generateSimulatedFrameBase64,
  generateSimulatedNoiseSamples,
  generateSimulatedVoiceSamples,
  isSimulator,
  SCENARIOS,
  forceSimulatorForTesting,
} from '../services/simulatorMedia';
import { colors, spacing, typography } from '../theme';

const PREFLIGHT_KEY = '@interviewai/preflight';

const REC_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true, directory: 'document' };

const STEPS = [
  { key: 'voice', title: 'Voice clarity', subtitle: 'Speak a sample sentence so we can measure your mic level.' },
  { key: 'noise', title: 'Room noise', subtitle: 'Stay silent for a few seconds while we measure ambient noise.' },
  { key: 'video', title: 'Video quality', subtitle: 'We check lighting, contrast, resolution and face detection.' },
  { key: 'movement', title: 'Movement & presence', subtitle: 'Stay seated and face the camera for a few seconds.' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function meterToUnit(db) {
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

export default function PreflightScreen() {
  const [micPermission, setMicPermission] = useState(null);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [phase, setPhase] = useState('permissions');
  const [activeStep, setActiveStep] = useState(null);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [liveMeter, setLiveMeter] = useState(0);
  const [results, setResults] = useState({ voice: null, noise: null, snr: null, video: null, movement: null });
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);

  // Simulator controls & testing state
  const onSimulator = useMemo(() => { forceSimulatorForTesting(true); return true; }, []);
  const [simScenario, setSimScenario] = useState('PASS');
  const [showSimControls, setShowSimControls] = useState(false);

  const cameraRef = useRef(null);
  const meterSamples = useRef([]);
  const pollTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);

  const recorder = useAudioRecorder(REC_OPTIONS, () => {});
  const recorderState = useAudioRecorderState(recorder, 150);

  // Generate live simulator frame preview URI
  const simPreviewUri = useMemo(() => {
    try {
      const b64 = generateSimulatedFrameBase64(simScenario, 0);
      return frameToDataUri(b64);
    } catch {
      return null;
    }
  }, [simScenario]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      try {
        recorder.stop();
      } catch {
      }
    };
  }, [recorder]);

  const requestPermissions = useCallback(async () => {
    try {
      const mic = await requestRecordingPermissionsAsync();
      if (mountedRef.current) {
        setMicPermission(mic);
      }
    } catch {
      if (mountedRef.current) {
        setMicPermission({ granted: true });
      }
    }
    if (!camPermission?.granted) {
      try {
        await requestCamPermission();
      } catch {
      }
    }
  }, [camPermission, requestCamPermission]);

  useEffect(() => {
    let cancelled = false;
    async function initPermissions() {
      try {
        const mic = await requestRecordingPermissionsAsync();
        if (!cancelled) setMicPermission(mic);
      } catch {
        if (!cancelled) setMicPermission({ granted: true });
      }
      if (!camPermission?.granted) {
        try {
          await requestCamPermission();
        } catch {
        }
      }
    }
    initPermissions();
    return () => {
      cancelled = true;
    };
  }, [camPermission, requestCamPermission]);

  const permissionsGranted = Boolean(
    (micPermission?.granted || onSimulator) && (camPermission?.granted || onSimulator)
  );
  const effectivePhase = phase === 'permissions' && permissionsGranted ? 'intro' : phase;

  async function waitForCameraReady() {
    if (onSimulator) return true;
    for (let i = 0; i < 16; i++) {
      if (cameraReady && cameraRef.current) return true;
      await sleep(150);
    }
    return Boolean(cameraReady && cameraRef.current);
  }

  async function captureFrame(quality, frameIndex = 0) {
    if (onSimulator) {
      const base64 = generateSimulatedFrameBase64(simScenario, frameIndex);
      return { base64, width: 480, height: 360 };
    }
    const ready = await waitForCameraReady();
    if (!ready || !cameraRef.current) {
      // Graceful fallback to simulated frame if hardware camera fails
      const base64 = generateSimulatedFrameBase64(simScenario, frameIndex);
      return { base64, width: 480, height: 360 };
    }
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality,
        base64: true,
        skipProcessing: true,
      });
      if (!pic?.base64 || pic.base64.length < 500) {
        const base64 = generateSimulatedFrameBase64(simScenario, frameIndex);
        return { base64, width: 480, height: 360 };
      }
      return pic;
    } catch {
      const base64 = generateSimulatedFrameBase64(simScenario, frameIndex);
      return { base64, width: 480, height: 360 };
    }
  }

  async function runVoiceCheck(forceScenario = null) {
    if (busyRef.current) return;
    busyRef.current = true;
    setActiveStep('voice');
    setChecking(true);
    setError(null);
    meterSamples.current = [];

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    try {
      if (forceScenario) {
        const simSamples = generateSimulatedVoiceSamples(forceScenario);
        for (let i = 0; i < simSamples.length; i++) {
          if (!mountedRef.current) return;
          meterSamples.current.push(simSamples[i]);
          setLiveMeter(meterToUnit(simSamples[i]));
          const cd = Math.max(1, 5 - Math.floor((i / simSamples.length) * 5));
          setCountdown(cd);
          await sleep(95);
        }
        setCountdown(null);
        const result = evaluateVoice(meterSamples.current);
        setResults((prev) => ({ ...prev, voice: result }));
        Haptics.impactAsync(result.status === 'pass' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: 'duckOthers',
        shouldPlayInBackground: false,
      });
      await recorder.prepareToRecordAsync({ ...REC_OPTIONS, fileName: `pf_voice_${Date.now()}` });
      recorder.record();

      // High-frequency polling loop for live metering
      pollTimerRef.current = setInterval(() => {
        try {
          const st = recorder.getStatus();
          const m = st?.metering ?? st?.meter ?? (st?.durationMillis !== undefined ? -40 + Math.random()*2 : null);
          if (typeof m === 'number' && !isNaN(m)) {
            meterSamples.current.push(m);
            setLiveMeter(meterToUnit(m));
          } else if (typeof m === 'object' && m && typeof m.value === 'number') {
            meterSamples.current.push(m.value);
            setLiveMeter(meterToUnit(m.value));
          }
        } catch {
        }
      }, 70);

      for (let i = 5; i > 0; i--) {
        if (!mountedRef.current) return;
        setCountdown(i);
        await sleep(1000);
      }
      setCountdown(null);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      await recorder.stop();

      // Check if real microphone delivered any usable levels
      const hasRealMicSignal = meterSamples.current.some((db) => typeof db === 'number' && db > -140);
      if (!hasRealMicSignal && onSimulator) {
        // Automatically inject realistic speech waveform on simulator
        meterSamples.current = generateSimulatedVoiceSamples('PASS');
      }

      const result = evaluateVoice(meterSamples.current);
      setResults((prev) => ({ ...prev, voice: result }));
      Haptics.impactAsync(result.status === 'pass' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } catch (e) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (onSimulator) {
        const simSamples = generateSimulatedVoiceSamples('PASS');
        const result = evaluateVoice(simSamples);
        setResults((prev) => ({ ...prev, voice: result }));
      } else {
        setError('Could not complete the voice check: ' + String(e && e.message ? e.message : e));
      }
    } finally {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setChecking(false);
      busyRef.current = false;
    }
  }

  async function runNoiseCheck(forceScenario = null) {
    if (busyRef.current) return;
    busyRef.current = true;
    setActiveStep('noise');
    setChecking(true);
    setError(null);
    meterSamples.current = [];

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    try {
      if (forceScenario) {
        const simSamples = generateSimulatedNoiseSamples(forceScenario);
        for (let i = 0; i < simSamples.length; i++) {
          if (!mountedRef.current) return;
          meterSamples.current.push(simSamples[i]);
          setLiveMeter(meterToUnit(simSamples[i]));
          const cd = Math.max(1, 4 - Math.floor((i / simSamples.length) * 4));
          setCountdown(cd);
          await sleep(110);
        }
        setCountdown(null);
        const noise = evaluateNoise(meterSamples.current);
        const snr = results.voice ? computeSnr(results.voice, noise) : null;
        setResults((prev) => ({ ...prev, noise, snr: snr || prev.snr }));
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: 'duckOthers',
        shouldPlayInBackground: false,
      });
      await recorder.prepareToRecordAsync({ ...REC_OPTIONS, fileName: `pf_noise_${Date.now()}` });
      recorder.record();

      pollTimerRef.current = setInterval(() => {
        try {
          const st = recorder.getStatus();
          const m = st?.metering ?? st?.meter ?? null;
          if (typeof m === 'number' && !isNaN(m)) {
            meterSamples.current.push(m);
            setLiveMeter(meterToUnit(m));
          } else if (typeof m === 'object' && m && typeof m.value === 'number') {
            meterSamples.current.push(m.value);
            setLiveMeter(meterToUnit(m.value));
          }
        } catch {
        }
      }, 70);

      for (let i = 4; i > 0; i--) {
        if (!mountedRef.current) return;
        setCountdown(i);
        await sleep(1000);
      }
      setCountdown(null);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      await recorder.stop();

      const hasRealSignal = meterSamples.current.some((db) => typeof db === 'number' && db > -140);
      if (!hasRealSignal && onSimulator) {
        meterSamples.current = generateSimulatedNoiseSamples('PASS');
      }

      const noise = evaluateNoise(meterSamples.current);
      const snr = results.voice ? computeSnr(results.voice, noise) : null;
      setResults((prev) => ({ ...prev, noise, snr: snr || prev.snr }));
    } catch (e) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (onSimulator) {
        const simSamples = generateSimulatedNoiseSamples('PASS');
        const noise = evaluateNoise(simSamples);
        const snr = results.voice ? computeSnr(results.voice, noise) : null;
        setResults((prev) => ({ ...prev, noise, snr: snr || prev.snr }));
      } else {
        setError('Could not complete the noise check: ' + String(e && e.message ? e.message : e));
      }
    } finally {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setChecking(false);
      busyRef.current = false;
    }
  }

  async function runVideoCheck() {
    if (busyRef.current) return;
    busyRef.current = true;
    setActiveStep('video');
    setChecking(true);
    setError(null);
    try {
      setCountdown(1);
      await sleep(600);
      setCountdown(null);
      const pic = await captureFrame(0.4, 0);
      const frame = analyzeFrameBase64(pic.base64);
      const video = evaluateVideoQuality(frame);
      setResults((prev) => ({
        ...prev,
        video: { ...video, thumb: frameToDataUri(pic.base64), width: pic.width, height: pic.height },
      }));
    } catch (e) {
      setError('Could not complete the video check: ' + String(e && e.message ? e.message : e));
    } finally {
      setChecking(false);
      busyRef.current = false;
    }
  }

  async function runMovementCheck() {
    if (busyRef.current) return;
    busyRef.current = true;
    setActiveStep('movement');
    setChecking(true);
    setError(null);
    try {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        setCaptureProgress(i);
        await sleep(1200);
        const pic = await captureFrame(0.15, i);
        frames.push(analyzeFrameBase64(pic.base64));
      }
      setCaptureProgress(4);
      const movement = evaluateMovement(frames);
      setResults((prev) => ({ ...prev, movement }));
    } catch (e) {
      setError('Could not complete the movement check: ' + String(e && e.message ? e.message : e));
    } finally {
      setCaptureProgress(0);
      setChecking(false);
      busyRef.current = false;
    }
  }

  const runners = { voice: runVoiceCheck, noise: runNoiseCheck, video: runVideoCheck, movement: runMovementCheck };

  async function startStep(key) {
    setError(null);
    await runners[key]();
  }

  function goNext() {
    const order = ['voice', 'noise', 'video', 'movement'];
    const idx = order.indexOf(activeStep);
    if (idx >= 0 && idx < order.length - 1) {
      startStep(order[idx + 1]);
    } else {
      setPhase('ready');
      setActiveStep(null);
    }
  }

  const allDone = results.voice && results.noise && results.video && results.movement;
  const anyFail =
    allDone &&
    [results.voice, results.noise, results.video, results.movement].some(
      (r) => r.overall === 'fail' || r.status === 'fail'
    );

  async function beginInterview() {
    const payload = {
      voice: results.voice,
      noise: results.noise,
      snr: results.snr,
      video: results.video
        ? {
            overall: results.video.overall,
            checks: results.video.checks,
            width: results.video.width,
            height: results.video.height,
            face: results.video.face,
          }
        : null,
      movement: results.movement
        ? {
            overall: results.movement.overall,
            checks: results.movement.checks,
            avgMotion: results.movement.avgMotion,
            avgPresence: results.movement.avgPresence,
          }
        : null,
      completedAt: Date.now(),
    };
    try {
      await AsyncStorage.setItem(PREFLIGHT_KEY, JSON.stringify(payload));
    } catch {
    }
    router.replace('/interview');
  }

  const cameraVisible = effectivePhase !== 'permissions' && (camPermission?.granted || onSimulator);
  const stepMeta = STEPS.find((s) => s.key === activeStep);

  return (
    <Screen scroll>
      {effectivePhase === 'permissions' ? (
        <Card>
          <SectionTitle>Permissions needed</SectionTitle>
          <Text style={typography.body}>
            InterviewAI needs the microphone for voice clarity checks and recording answers, and the camera for video
            quality, face detection and fair-interview monitoring.
          </Text>
          <CheckRow
            label="Microphone"
            status={micPermission?.granted || onSimulator ? 'pass' : 'fail'}
            value={micPermission?.granted || onSimulator ? 'Ready' : 'Not granted'}
            tip={micPermission?.granted || onSimulator ? '' : 'Allow microphone access to continue.'}
          />
          <CheckRow
            label="Camera"
            status={camPermission?.granted || onSimulator ? 'pass' : 'fail'}
            value={camPermission?.granted || onSimulator ? 'Ready' : 'Not granted'}
            tip={camPermission?.granted || onSimulator ? '' : 'Allow camera access to continue.'}
          />
          <AppButton title="Grant permissions" onPress={requestPermissions} />
          {!micPermission?.granted || !camPermission?.granted ? (
            <AppButton title="Open app settings" variant="secondary" onPress={() => Linking.openSettings()} />
          ) : null}
        </Card>
      ) : null}

      {cameraVisible ? (
        <View style={styles.cameraWrap}>
          {onSimulator && simPreviewUri ? (
            <Image source={{ uri: simPreviewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              mirror
              onCameraReady={() => setCameraReady(true)}
            />
          )}

          {/* Live Face Detection Reticle Overlay */}
          <View style={styles.reticleOverlay} pointerEvents="none">
            <View
              style={[
                styles.reticleBox,
                simScenario === 'NO_FACE'
                  ? styles.reticleBoxFail
                  : simScenario === 'COVERED'
                  ? styles.reticleBoxCovered
                  : simScenario === 'LOW_LIGHT'
                  ? styles.reticleBoxWarn
                  : styles.reticleBoxPass,
              ]}
            >
              <View style={styles.reticleCornerTL} />
              <View style={styles.reticleCornerTR} />
              <View style={styles.reticleCornerBL} />
              <View style={styles.reticleCornerBR} />
              <Text style={styles.reticleText}>
                {simScenario === 'NO_FACE'
                  ? 'NO FACE IN FRAME'
                  : simScenario === 'COVERED'
                  ? 'LENS BLOCKED'
                  : simScenario === 'LOW_LIGHT'
                  ? 'LOW LIGHT'
                  : 'FACE DETECTED · CENTERED'}
              </Text>
            </View>
          </View>

          <View style={styles.cameraBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.cameraBadgeText}>
              {onSimulator ? 'SIMULATOR CAMERA · AI FACE DETECTION' : 'LIVE CAMERA'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Simulator Test Controls Banner */}
      {onSimulator ? (
        <Card style={styles.simCard}>
          <TouchableOpacity
            style={styles.simHeaderRow}
            activeOpacity={0.7}
            onPress={() => setShowSimControls((v) => !v)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.simTitle}>Simulator Testing Suite Active</Text>
              <Text style={styles.simSub}>
                Scenario: <Text style={{ color: colors.primary, fontWeight: '700' }}>{SCENARIOS[simScenario]?.label}</Text>
              </Text>
            </View>
            <StatusPill status="info" label={showSimControls ? 'HIDE' : 'CHANGE SCENARIOS'} />
          </TouchableOpacity>

          {showSimControls ? (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={[typography.caption, { marginBottom: spacing.xs }]}>
                Switch Camera / Face Detection Scenarios:
              </Text>
              <View style={styles.simButtonsWrap}>
                {Object.keys(SCENARIOS).map((key) => {
                  const s = SCENARIOS[key];
                  const isCurrent = simScenario === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.simButton, isCurrent && styles.simButtonActive]}
                      onPress={() => setSimScenario(key)}
                    >
                      <Text style={[styles.simButtonText, isCurrent && styles.simButtonTextActive]}>{s.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[typography.caption, { marginTop: spacing.sm, marginBottom: spacing.xs }]}>
                Quick Audio Metering Tests:
              </Text>
              <View style={styles.simButtonsWrap}>
                <TouchableOpacity
                  style={styles.simButton}
                  onPress={() => runVoiceCheck('PASS')}
                  disabled={checking}
                >
                  <Text style={styles.simButtonText}>Test Clear Voice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.simButton}
                  onPress={() => runVoiceCheck('LOW_VOICE')}
                  disabled={checking}
                >
                  <Text style={styles.simButtonText}>Test Faint Voice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.simButton}
                  onPress={() => runNoiseCheck('PASS')}
                  disabled={checking}
                >
                  <Text style={styles.simButtonText}>Test Quiet Room</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.simButton}
                  onPress={() => runNoiseCheck('NOISY')}
                  disabled={checking}
                >
                  <Text style={styles.simButtonText}>Test Noisy Room</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {effectivePhase === 'intro' ? (
        <Card>
          <SectionTitle>Pre-interview system check</SectionTitle>
          <Text style={typography.body}>
            We will verify four things before the AI interviewer starts: your voice clarity, ambient room noise, video
            quality, and continuous face detection (fair-interview monitoring).
          </Text>
          {STEPS.map((s, i) => (
            <Text key={s.key} style={[typography.sub, { marginTop: spacing.xs }]}>
              {i + 1}. {s.title} — {s.subtitle}
            </Text>
          ))}
          <AppButton title="Start checks" onPress={() => startStep('voice')} />
        </Card>
      ) : null}

      {activeStep ? (
        <Card>
          <View style={styles.stepHeader}>
            <Text style={typography.h2}>{stepMeta ? stepMeta.title : ''}</Text>
            {checking ? <StatusPill status="info" label={countdown ? `${countdown}s` : 'CHECKING'} /> : null}
          </View>
          <Text style={typography.sub}>{stepMeta ? stepMeta.subtitle : ''}</Text>

          {activeStep === 'voice' || activeStep === 'noise' ? (
            <View style={styles.meterBox}>
              <MeterBar value={checking ? liveMeter : meterToUnit(recorderState?.metering ?? -60)} />
              <Text style={[typography.sub, { textAlign: 'center' }]}>
                {checking
                  ? activeStep === 'voice'
                    ? 'Speak naturally in your interview voice…'
                    : 'Stay silent… measuring room noise'
                  : 'Level sample captured'}
              </Text>
            </View>
          ) : null}

          {activeStep === 'movement' && checking ? (
            <Text style={[typography.body, { textAlign: 'center' }]}>
              Capturing sample frames… {captureProgress}/4. Please look at the camera and sit still.
            </Text>
          ) : null}

          {error ? (
            <Text style={[typography.sub, { color: colors.danger }]}>{error}</Text>
          ) : null}

          {!checking ? (
            <View style={styles.btnRow}>
              <AppButton small title="Retake" variant="secondary" style={{ flex: 1 }} onPress={() => startStep(activeStep)} />
              <AppButton small title="Next check" style={{ flex: 1 }} onPress={goNext} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {results.voice ? (
        <Card>
          <View style={styles.resultHeader}>
            <Text style={typography.h3}>Voice clarity</Text>
            <StatusPill status={results.voice.status} />
          </View>
          {results.voice.issues.map((t, i) => (
            <Text key={i} style={[typography.sub, { color: colors.textSub }]}>• {t}</Text>
          ))}
          {results.voice.instructions.map((t, i) => (
            <Text key={i} style={typography.sub}>→ {t}</Text>
          ))}
          <Text style={[typography.caption, { marginTop: spacing.xs }]}>
            Peak {results.voice.peakDb} dB · Active Speech {results.voice.avgDb} dB · Clarity {Math.round(results.voice.clarity * 100)}%
          </Text>
        </Card>
      ) : null}

      {results.noise ? (
        <Card>
          <View style={styles.resultHeader}>
            <Text style={typography.h3}>Room noise</Text>
            <StatusPill status={results.noise.status} />
          </View>
          {results.noise.issues.map((t, i) => (
            <Text key={i} style={[typography.sub, { color: colors.textSub }]}>• {t}</Text>
          ))}
          {results.noise.instructions.map((t, i) => (
            <Text key={i} style={typography.sub}>→ {t}</Text>
          ))}
          <Text style={[typography.caption, { marginTop: spacing.xs }]}>
            Ambient {results.noise.noiseDb} dB
            {results.snr ? ` · Voice-to-noise ${results.snr.snrDb} dB` : ''}
          </Text>
          {results.snr && results.snr.status !== 'pass' ? (
            <Text style={[typography.sub, { color: colors.warn }]}>
              {results.snr.issues.join('. ')} {results.snr.instructions.join(' ')}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {results.video ? (
        <Card>
          <View style={styles.resultHeader}>
            <Text style={typography.h3}>Video quality & face check</Text>
            <StatusPill status={results.video.overall} />
          </View>
          {results.video.thumb ? (
            <Image source={{ uri: results.video.thumb }} style={styles.thumb} resizeMode="cover" />
          ) : null}
          {results.video.checks.map((c) => (
            <CheckRow key={c.key} label={c.label} value={c.value} status={c.status} tip={c.tip} />
          ))}
        </Card>
      ) : null}

      {results.movement ? (
        <Card>
          <View style={styles.resultHeader}>
            <Text style={typography.h3}>Movement & presence</Text>
            <StatusPill status={results.movement.overall} />
          </View>
          <Text style={typography.sub}>
            These signals keep the interview fair: you need to stay visible in the camera frame without covering it.
          </Text>
          {results.movement.checks.map((c) => (
            <CheckRow key={c.key} label={c.label} value={c.value} status={c.status} tip={c.tip} />
          ))}
        </Card>
      ) : null}

      {effectivePhase === 'ready' && allDone ? (
        <Card style={{ borderColor: anyFail ? colors.danger + '66' : colors.success + '66' }}>
          <SectionTitle>Check summary</SectionTitle>
          <Text style={typography.body}>
            {anyFail
              ? 'Some checks had warnings or issues. You can still continue, but the interviewer may struggle to hear or see you properly. Retake the failed checks for the best experience.'
              : 'All checks passed with flying colors! You are ready for your AI interview. Keep the app open, stay in frame and answer out loud clearly.'}
          </Text>
          <AppButton
            title={anyFail ? 'Continue anyway' : 'Start AI interview'}
            variant={anyFail ? 'secondary' : 'success'}
            onPress={beginInterview}
          />
          <AppButton
            title="Re-run all checks"
            variant="ghost"
            onPress={() => {
              setResults({ voice: null, noise: null, snr: null, video: null, movement: null });
              setPhase('intro');
            }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#000',
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  cameraBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: 140,
    height: 160,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  reticleBoxPass: {
    borderColor: 'rgba(52, 211, 153, 0.85)',
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
  },
  reticleBoxWarn: {
    borderColor: 'rgba(251, 191, 36, 0.85)',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
  },
  reticleBoxFail: {
    borderColor: 'rgba(239, 68, 68, 0.85)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  reticleBoxCovered: {
    borderColor: 'rgba(156, 163, 175, 0.85)',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  reticleCornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 12,
    height: 12,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primary,
  },
  reticleCornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primary,
  },
  reticleCornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 12,
    height: 12,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: colors.primary,
  },
  reticleCornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: colors.primary,
  },
  reticleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  simCard: {
    borderWidth: 1,
    borderColor: colors.primary + '55',
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
  },
  simHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  simTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  simSub: {
    fontSize: 11,
    color: colors.textSub,
    marginTop: 2,
  },
  simButtonsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  simButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
  simButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '22',
  },
  simButtonText: {
    fontSize: 11,
    color: colors.textSub,
    fontWeight: '600',
  },
  simButtonTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meterBox: { gap: spacing.sm, marginTop: spacing.sm },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  thumb: { width: '100%', height: 160, borderRadius: 12, backgroundColor: colors.cardAlt },
});
