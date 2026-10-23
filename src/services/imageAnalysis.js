import { File } from 'expo-file-system';
import { Platform } from 'react-native';

const LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < alphabet.length; i++) table[alphabet.charCodeAt(i)] = i;
  return table;
})();

function base64ToBytes(base64) {
  let clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  let padding = 0;
  if (clean.endsWith('==')) padding = 2;
  else if (clean.endsWith('=')) padding = 1;
  clean = clean.replace(/=+$/, '');
  const outLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(outLength);
  let p = 0;
  for (let i = 0; i + 3 < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)];
    const b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = LOOKUP[clean.charCodeAt(i + 2)];
    const d = LOOKUP[clean.charCodeAt(i + 3)];
    bytes[p++] = (a << 2) | (b >> 4);
    if (p < outLength) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < outLength) bytes[p++] = ((c & 3) << 6) | d;
  }
  if (padding === 1 && outLength > 0) {
    const a = LOOKUP[clean.charCodeAt(clean.length - 2)];
    const b = LOOKUP[clean.charCodeAt(clean.length - 1)];
    bytes[outLength - 1] = ((a & 15) << 4) | (b >> 2);
  } else if (padding === 2 && outLength > 1) {
    const a = LOOKUP[clean.charCodeAt(clean.length - 1)];
    bytes[outLength - 1] = a << 2;
  }
  return bytes;
}

let decodeJpeg;
try {
  decodeJpeg = require('jpeg-js').decode;
} catch {
  decodeJpeg = null;
}

function isSkin(r, g, b) {
  return r > 95 && g > 40 && b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15 && Math.abs(r - g) > 12 && r > g && r > b;
}

function buildGrid(rgba, width, height, size) {
  const grid = new Uint8Array(size * size);
  for (let gy = 0; gy < size; gy++) {
    const y0 = Math.floor((gy * height) / size);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / size));
    for (let gx = 0; gx < size; gx++) {
      const x0 = Math.floor((gx * width) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / size));
      let sum = 0;
      let count = 0;
      const stepX = Math.max(1, Math.floor((x1 - x0) / 4));
      const stepY = Math.max(1, Math.floor((y1 - y0) / 4));
      for (let y = y0; y < y1; y += stepY) {
        for (let x = x0; x < x1; x += stepX) {
          const i = (y * width + x) * 4;
          const r = rgba[i];
          const g = rgba[i + 1];
          const b = rgba[i + 2];
          sum += 0.299 * r + 0.587 * g + 0.114 * b;
          count++;
        }
      }
      grid[gy * size + gx] = Math.round(sum / Math.max(1, count));
    }
  }
  return grid;
}

export function skinRatio(rgba, width, height) {
  let hits = 0;
  let total = 0;
  const stepX = Math.max(1, Math.floor(width / 48));
  const stepY = Math.max(1, Math.floor(height / 48));
  const centerX0 = width * 0.15;
  const centerX1 = width * 0.85;
  const centerY0 = height * 0.05;
  const centerY1 = height * 0.85;
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      if (x < centerX0 || x > centerX1 || y < centerY0 || y > centerY1) continue;
      const i = (y * width + x) * 4;
      total++;
      if (isSkin(rgba[i], rgba[i + 1], rgba[i + 2])) hits++;
    }
  }
  return total ? hits / total : 0;
}

export function detectFace(rgba, width, height) {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let hits = 0;
  let total = 0;
  let sumX = 0;
  let sumY = 0;

  const stepX = Math.max(1, Math.floor(width / 64));
  const stepY = Math.max(1, Math.floor(height / 64));

  const x0 = Math.floor(width * 0.15);
  const x1 = Math.floor(width * 0.85);
  const y0 = Math.floor(height * 0.08);
  const y1 = Math.floor(height * 0.85);

  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      total++;
      const i = (y * width + x) * 4;
      if (isSkin(rgba[i], rgba[i + 1], rgba[i + 2])) {
        hits++;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const ratio = total ? hits / total : 0;
  const detected = ratio >= 0.025 && hits >= 8;

  if (!detected) {
    return {
      detected: false,
      confidence: 0,
      ratio,
      box: null,
      center: null,
      position: 'none',
      label: 'No face detected in frame',
    };
  }

  const centerX = sumX / hits;
  const centerY = sumY / hits;
  const relCenterX = centerX / width;
  const relCenterY = centerY / height;

  const faceW = Math.max(0, maxX - minX);
  const faceH = Math.max(0, maxY - minY);
  const coverageW = faceW / width;

  let position = 'centered';
  let label = 'Face centered';

  if (relCenterX < 0.35) {
    position = 'left';
    label = 'Move toward center (too far left)';
  } else if (relCenterX > 0.65) {
    position = 'right';
    label = 'Move toward center (too far right)';
  } else if (coverageW < 0.10) {
    position = 'too_far';
    label = 'Move closer to camera';
  } else if (coverageW > 0.70) {
    position = 'too_close';
    label = 'Move slightly back from camera';
  }

  const confidence = Math.min(100, Math.round(ratio * 350 + (hits > 25 ? 35 : 15)));

  return {
    detected: true,
    confidence,
    ratio,
    box: {
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.round(faceW),
      height: Math.round(faceH),
      relX: minX / width,
      relY: minY / height,
      relWidth: faceW / width,
      relHeight: faceH / height,
    },
    center: { x: centerX, y: centerY, relX: relCenterX, relY: relCenterY },
    position,
    label,
  };
}

function contrastOf(grid) {
  let sum = 0;
  for (let i = 0; i < grid.length; i++) sum += grid[i];
  const mean = sum / grid.length;
  let varSum = 0;
  for (let i = 0; i < grid.length; i++) {
    const d = grid[i] - mean;
    varSum += d * d;
  }
  return { mean, contrast: Math.sqrt(varSum / grid.length) };
}

function sharpnessOf(grid, size) {
  const values = [];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const lap = 4 * grid[i] - grid[i - 1] - grid[i + 1] - grid[i - size] - grid[i + size];
      values.push(lap);
    }
  }
  const mean = values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / Math.max(1, values.length);
  return variance;
}

export async function analyzeFrameFile(uri, { gridSize = 64 } = {}) {
  if (!decodeJpeg) throw new Error('jpeg-decoder-missing');
  const base64 = await new File(uri).base64();
  return analyzeFrameBase64(base64, { gridSize });
}

export function analyzeFrameBase64(base64, { gridSize = 64 } = {}) {
  if (!decodeJpeg) throw new Error('jpeg-decoder-missing');
  const bytes = base64ToBytes(base64);
  const raw = decodeJpeg(bytes, { useTArray: true, maxMemoryUsageInMB: 256 });
  const { width, height, data } = raw;
  const grid = buildGrid(data, width, height, gridSize);
  const { mean, contrast } = contrastOf(grid);
  const sharpness = sharpnessOf(grid, gridSize);
  const face = detectFace(data, width, height);
  return {
    width,
    height,
    grid,
    gridSize,
    mean,
    contrast,
    sharpness,
    skinRatio: face.ratio,
    face,
    capturedAt: Date.now(),
  };
}

export function diffFrames(a, b) {
  if (!a || !b || a.grid.length !== b.grid.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.grid.length; i++) sum += Math.abs(a.grid[i] - b.grid[i]);
  return sum / a.grid.length / 255;
}

export function frameToDataUri(base64) {
  return `data:image/jpeg;base64,${base64}`;
}

export function platformSupportsFrameAnalysis() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
