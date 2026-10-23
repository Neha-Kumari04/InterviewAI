import { hasApiKey } from './settings';

function extensionOf(uri) {
  const match = /\.([a-zA-Z0-9]+)(\?.*)?$/.exec(uri || '');
  return match ? match[1].toLowerCase() : 'm4a';
}

const AUDIO_TYPES = {
  m4a: 'audio/m4a',
  mp4: 'audio/mp4',
  mov: 'video/quicktime',
  caf: 'audio/x-caf',
  aac: 'audio/aac',
  wav: 'audio/wav',
  webm: 'audio/webm',
  mp3: 'audio/mpeg',
  mpga: 'audio/mpeg',
  flac: 'audio/flac',
};

export async function transcribeAudio(fileUri, settings) {
  if (!hasApiKey(settings)) return { ok: false, reason: 'no-key', transcript: null };
  if (!fileUri) return { ok: false, reason: 'no-file', transcript: null };

  const ext = extensionOf(fileUri);
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: `answer.${ext}`,
    type: AUDIO_TYPES[ext] || 'audio/m4a',
  });
  form.append('model', settings.whisperModel || 'whisper-1');
  form.append('response_format', 'json');

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.apiKey.trim()}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, reason: `http-${res.status}`, detail: body.slice(0, 200), transcript: null };
    }
    const data = await res.json();
    const transcript = (data.text || '').trim();
    return { ok: true, transcript: transcript || null };
  } catch (e) {
    return { ok: false, reason: 'network', detail: String(e && e.message ? e.message : e), transcript: null };
  }
}

export function sttAvailable(settings) {
  return hasApiKey(settings);
}

import { backendFetch } from './backend';

export async function transcribeAudioBackend(fileUri, settings) {
  try {
    const ext = (fileUri.split('.').pop().split('?')[0] || 'm4a').toLowerCase();
    const form = new FormData();
    form.append('file', {
      uri: fileUri,
      name: `answer.${ext}`,
      type: ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : 'audio/m4a',
    });
    form.append('model', settings.whisperModel || 'whisper-1');
    const res = await backendFetch('/api/transcribe', {
      method: 'POST',
      body: form,
    });
    if (!res.ok) return { ok: false, reason: 'backend-http', transcript: null };
    const data = await res.json();
    const transcript = (data.text || '').trim();
    return { ok: true, transcript: transcript || null };
  } catch (e) {
    return { ok: false, reason: 'network', transcript: null };
  }
}

export async function transcribeAudioRobust(fileUri, settings) {
  // Try backend first
  try {
    const res = await transcribeAudioBackend(fileUri, settings);
    if (res.ok && res.transcript) return res;
  } catch {}
  // Fall back to direct OpenAI
  return transcribeAudio(fileUri, settings);
}
