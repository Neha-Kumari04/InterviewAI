import { Platform } from 'react-native';

const DEFAULT_URLS = [
  'http://localhost:4002',
  'http://127.0.0.1:4002',
  'http://10.0.2.2:4002',
  Platform.OS === 'ios' ? 'http://localhost:4002' : 'http://10.0.2.2:4002',
];

const BACKEND_KEY = '@interviewai/backend_url';
let cached = null;

export async function getBackendUrl() {
  if (cached) return cached;
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const saved = await AsyncStorage.getItem(BACKEND_KEY);
    if (saved) cached = saved;
  } catch {}
  cached = cached || DEFAULT_URLS[0];
  return cached;
}

export async function setBackendUrl(url) {
  cached = url;
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(BACKEND_KEY, url);
  } catch {}
}

export async function backendFetch(path, options = {}) {
  const base = await getBackendUrl();
  try {
    const res = await fetch(`${base}${path}`, options);
    return res;
  } catch (err) {
    // try other fallbacks
    for (let i = 0; i < DEFAULT_URLS.length; i++) {
      try {
        const res = await fetch(`${DEFAULT_URLS[i]}${path}`, options);
        cached = DEFAULT_URLS[i];
        return res;
      } catch {}
    }
    throw err;
  }
}

export async function checkBackend() {
  try {
    const res = await backendFetch('/health');
    const data = await res.json();
    return { ok: res.ok, ...data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
