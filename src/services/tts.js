import * as Speech from 'expo-speech';

let currentSettings = {
  speechRate: 1.0,
  speechPitch: 1.0,
  speechLanguage: 'en-US',
  voiceEnabled: true,
};

export function configureTts(settings) {
  currentSettings = { ...currentSettings, ...settings };
}

export function speak(text, { rate, pitch, language, voice } = {}) {
  const content = (text || '').trim();
  if (!content) return Promise.resolve();

  if (!currentSettings.voiceEnabled && !voice) {
    const ms = Math.min(2500, 600 + content.length * 45);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return new Promise((resolve) => {
    const cleaned = content.replace(/\s+/g, ' ').slice(0, 3500);
    Speech.speak(cleaned, {
      language: language || currentSettings.speechLanguage,
      rate: rate ?? currentSettings.speechRate,
      pitch: pitch ?? currentSettings.speechPitch,
      voice,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

export async function stopSpeaking() {
  try {
    await Speech.stop();
  } catch {
  }
}

export async function isSpeaking() {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
