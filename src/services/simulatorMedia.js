import * as Device from 'expo-device';
import { Platform } from 'react-native';

let encodeJpeg;
try {
  const jpeg = require('jpeg-js');
  encodeJpeg = jpeg.encode;
} catch {
  encodeJpeg = null;
}

let forcedSimulatorMode = null;
let currentScenario = 'PASS';

export const SCENARIOS = {
  PASS: {
    id: 'PASS',
    label: 'Optimal (Pass)',
    description: 'Centered face, clear lighting, and balanced contrast.',
  },
  NO_FACE: {
    id: 'NO_FACE',
    label: 'No Face (Fail)',
    description: 'Empty background without candidate face in frame.',
  },
  LOW_LIGHT: {
    id: 'LOW_LIGHT',
    label: 'Low Light (Warn)',
    description: 'Dim, underexposed room lighting.',
  },
  COVERED: {
    id: 'COVERED',
    label: 'Covered Lens (Fail)',
    description: 'Completely blocked or covered camera.',
  },
  HIGH_MOTION: {
    id: 'HIGH_MOTION',
    label: 'Movement (Warn)',
    description: 'Rapid movement and shifting posture.',
  },
};

export function isSimulator() {
  if (forcedSimulatorMode !== null) return forcedSimulatorMode;
  // Device.isDevice is false on iOS Simulator and Android Emulator
  if (typeof Device.isDevice === 'boolean') {
    return !Device.isDevice;
  }
  return Platform.OS === 'web';
}

export function setForceSimulatorMode(enabled) {
  forcedSimulatorMode = enabled;
}

export function getSimulatorScenario() {
  return currentScenario;
}

export function setSimulatorScenario(scenario) {
  if (SCENARIOS[scenario]) {
    currentScenario = scenario;
  }
}

function bytesToBase64(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    result += alphabet[bytes[i] >> 2];
    result += alphabet[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    result += alphabet[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    result += alphabet[bytes[i + 2] & 63];
  }
  if (i < len) {
    result += alphabet[bytes[i] >> 2];
    if (i + 1 < len) {
      result += alphabet[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      result += alphabet[(bytes[i + 1] & 15) << 2];
      result += '=';
    } else {
      result += alphabet[(bytes[i] & 3) << 4];
      result += '==';
    }
  }
  return result;
}

/**
 * Generate a realistic simulated camera frame in JPEG base64 format.
 * Includes candidate silhouette, facial features (eyes, lips, skin tone),
 * and gradient background to allow accurate testing of brightness, contrast,
 * sharpness, and face detection.
 */
export function generateSimulatedFrameBase64(scenario = currentScenario, frameIndex = 0) {
  if (!encodeJpeg) {
    throw new Error('jpeg-js encode is unavailable');
  }

  const width = 480;
  const height = 360;
  const buffer = new Uint8Array(width * height * 4);

  const covered = scenario === 'COVERED';
  const dark = scenario === 'LOW_LIGHT';
  const noFace = scenario === 'NO_FACE';
  const isMotion = scenario === 'HIGH_MOTION';
  // If motion test, shift horizontal offset back and forth across frames
  const motionShift = isMotion ? (frameIndex % 2 === 0 ? -38 : 38) : 0;

  const baseBrightness = dark ? 20 : 124;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (covered) {
        buffer[idx] = 8;
        buffer[idx + 1] = 8;
        buffer[idx + 2] = 8;
        buffer[idx + 3] = 255;
        continue;
      }

      // Modern office/interview background gradient
      let r = Math.round(baseBrightness * 0.72 + (y / height) * 22);
      let g = Math.round(baseBrightness * 0.78 + (x / width) * 28);
      let b = Math.round(baseBrightness * 0.92);

      if (!noFace) {
        // Torso / shoulders
        const torsoDx = (x - (width * 0.5 + motionShift)) / (width * 0.38);
        const torsoDy = (y - height * 0.92) / (height * 0.32);
        if (torsoDx * torsoDx + torsoDy * torsoDy < 1) {
          r = dark ? 8 : 38;
          g = dark ? 10 : 48;
          b = dark ? 15 : 72;
        }

        // Neck
        const neckX = Math.abs(x - (width * 0.5 + motionShift));
        if (neckX < width * 0.07 && y > height * 0.55 && y < height * 0.72) {
          r = dark ? 25 : 195;
          g = dark ? 18 : 145;
          b = dark ? 12 : 115;
        }

        // Candidate Face (oval)
        const headDx = (x - (width * 0.5 + motionShift)) / (width * 0.16);
        const headDy = (y - height * 0.40) / (height * 0.22);
        if (headDx * headDx + headDy * headDy < 1) {
          // Human skin tone: r > 95, g > 40, b > 20, r > g > b
          r = dark ? 32 : 218;
          g = dark ? 22 : 165;
          b = dark ? 16 : 132;

          // Hair (top of head)
          if (headDy < -0.45) {
            r = dark ? 5 : 45;
            g = dark ? 5 : 35;
            b = dark ? 5 : 30;
          }

          // Eyes
          const eyeY = Math.abs(y - height * 0.36);
          const leftEyeX = Math.abs(x - (width * 0.44 + motionShift));
          const rightEyeX = Math.abs(x - (width * 0.56 + motionShift));
          if (eyeY < 4 && (leftEyeX < 7 || rightEyeX < 7)) {
            r = dark ? 5 : 30;
            g = dark ? 5 : 25;
            b = dark ? 5 : 20;
          }

          // Lips/mouth
          const mouthY = Math.abs(y - height * 0.50);
          const mouthX = Math.abs(x - (width * 0.50 + motionShift));
          if (mouthY < 3 && mouthX < 14) {
            r = dark ? 28 : 185;
            g = dark ? 15 : 95;
            b = dark ? 12 : 90;
          }
        }
      }

      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = 255;
    }
  }

  const rawData = { data: buffer, width, height };
  const encoded = encodeJpeg(rawData, 75);
  return bytesToBase64(encoded.data);
}

/**
 * Generate simulated dB audio metering samples for testing voice clarity.
 */
export function generateSimulatedVoiceSamples(scenario = 'PASS') {
  if (scenario === 'SILENT') {
    return Array.from({ length: 40 }, () => -160);
  }
  if (scenario === 'LOW_VOICE') {
    return Array.from({ length: 45 }, (_, i) => {
      const isSpeaking = (i >= 8 && i <= 18) || (i >= 24 && i <= 38);
      return isSpeaking ? -41 + Math.sin(i) * 3 : -60 + Math.sin(i) * 2;
    });
  }

  // PASS: Natural speech sequence with pause
  const samples = [];
  for (let i = 0; i < 50; i++) {
    // 0-8: ambient silence
    // 8-25: first phrase ("Hello my name is...")
    // 25-30: breath pause
    // 30-46: second phrase ("...and I am ready for the interview")
    // 46-50: tail silence
    if ((i >= 8 && i <= 25) || (i >= 30 && i <= 46)) {
      const speechPower = -24 + Math.sin(i * 0.7) * 7 + (Math.cos(i * 1.3) * 3);
      samples.push(Math.round(speechPower * 10) / 10);
    } else {
      const ambient = -56 + Math.sin(i * 0.5) * 2;
      samples.push(Math.round(ambient * 10) / 10);
    }
  }
  return samples;
}

/**
 * Generate simulated dB audio metering samples for testing ambient room noise.
 */
export function generateSimulatedNoiseSamples(scenario = 'PASS') {
  if (scenario === 'NOISY') {
    return Array.from({ length: 35 }, (_, i) => -34 + Math.sin(i * 0.8) * 4);
  }
  // Quiet ambient room
  return Array.from({ length: 35 }, (_, i) => -58 + Math.sin(i * 0.4) * 3);
}

export function forceSimulatorForTesting(force = true) {
  setForceSimulatorMode(force);
  return isSimulator();
}
