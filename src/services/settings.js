import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const SETTINGS_KEY = '@interviewai/settings';

export const DEFAULT_SETTINGS = {
  apiKey: '',
  whisperModel: 'whisper-1',
  chatModel: 'gpt-4o-mini',
  speechRate: 1.0,
  speechPitch: 1.0,
  speechLanguage: 'en-US',
  voiceEnabled: true,
  monitoringEnabled: true,
};

let cached = null;
const listeners = new Set();

export async function loadSettings() {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    cached = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    cached = { ...DEFAULT_SETTINGS };
  }
  return cached;
}

export async function saveSettings(partial) {
  const current = await loadSettings();
  cached = { ...current, ...partial };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(cached));
  listeners.forEach((fn) => fn(cached));
  return cached;
}

export function subscribeSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function hasApiKey(settings) {
  return Boolean(settings && settings.apiKey && settings.apiKey.trim().length > 10);
}

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  useEffect(() => {
    let mounted = true;
    loadSettings().then((s) => {
      if (mounted) setSettings(s);
    });
    const unsubscribe = subscribeSettings((s) => {
      if (mounted) setSettings(s);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  return settings;
}
