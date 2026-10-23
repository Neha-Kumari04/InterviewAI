import { AppState } from 'react-native';
import { diffFrames } from './imageAnalysis';

export const FLAG_TYPES = {
  COVERED: 'camera_covered',
  AWAY: 'not_in_frame',
  MOTION: 'excessive_movement',
  BACKGROUND: 'app_backgrounded',
};

export function createIntegrityMonitor({ onFlag, intervalMs = 5000 } = {}) {
  let timer = null;
  let appStateSub = null;
  let prevFrame = null;
  let frames = 0;
  let stopped = false;
  const flagCounts = {
    [FLAG_TYPES.COVERED]: 0,
    [FLAG_TYPES.AWAY]: 0,
    [FLAG_TYPES.MOTION]: 0,
    [FLAG_TYPES.BACKGROUND]: 0,
  };
  let motionSamples = [];

  function emit(type, detail) {
    flagCounts[type] = (flagCounts[type] || 0) + 1;
    if (onFlag) onFlag({ t: Date.now(), type, detail });
  }

  function watchAppState() {
    appStateSub = AppState.addEventListener('change', (next) => {
      if (stopped) return;
      if (next !== 'active') {
        emit(FLAG_TYPES.BACKGROUND, `App went to ${next} during the interview`);
      }
    });
  }

  async function tick(getFrame) {
    try {
      const frame = await getFrame();
      if (!frame || stopped) return;
      frames += 1;

      if (frame.mean < 25 || frame.contrast < 8) {
        emit(FLAG_TYPES.COVERED, 'Camera view appeared blocked');
      }
      if (frame.skinRatio < 0.015) {
        emit(FLAG_TYPES.AWAY, 'Candidate appeared to leave the frame');
      }
      if (prevFrame) {
        const motion = diffFrames(prevFrame, frame);
        motionSamples.push(motion);
        if (motion > 0.22) {
          emit(FLAG_TYPES.MOTION, `High movement detected (${Math.round(motion * 100)}% frame change)`);
        }
      }
      prevFrame = frame;
    } catch {
    }
  }

  return {
    start(getFrame) {
      stopped = false;
      watchAppState();
      timer = setInterval(() => tick(getFrame), intervalMs);
    },
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      if (appStateSub) appStateSub.remove();
      appStateSub = null;
    },
    snapshot() {
      const avgMotion = motionSamples.length ? motionSamples.reduce((s, v) => s + v, 0) / motionSamples.length : 0;
      const flags = [];
      Object.keys(flagCounts).forEach((k) => {
        if (flagCounts[k]) flags.push({ type: k, count: flagCounts[k] });
      });
      return {
        framesAnalyzed: frames,
        avgMotion: Number(avgMotion.toFixed(3)),
        flagCounts,
        flags,
        clean: frames > 0 && flags.length === 0,
      };
    },
  };
}
