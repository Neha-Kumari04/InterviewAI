import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const INDEX_KEY = '@interviewai/sessions';

function sessionsRoot() {
  return new Directory(Paths.document, 'InterviewAI', 'sessions');
}

export function sessionDir(id) {
  return new Directory(sessionsRoot(), id);
}

function ensureDir(dir) {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

export function newSessionId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IAI-${stamp}-${rand}`;
}

export async function createSession(meta) {
  const session = {
    id: newSessionId(),
    ...meta,
    createdAt: Date.now(),
    endedAt: null,
    preflight: meta.preflight || null,
    answers: [],
    events: [],
    integrity: { events: [], summary: null },
    summary: null,
  };
  const dir = sessionDir(session.id);
  ensureDir(dir);
  logEvent(session, 'session_created', { jobId: session.jobId });
  await persist(session);
  return session;
}

export function logEvent(session, type, data) {
  session.events.push({ t: Date.now(), type, data: data || null });
}

export async function persist(session) {
  try {
    const dir = sessionDir(session.id);
    ensureDir(dir);
    const file = new File(dir, 'session.json');
    await file.write(JSON.stringify(session, null, 2));
    return true;
  } catch {
    return false;
  }
}

export async function attachSegment(session, srcUri, fileName) {
  if (!srcUri) return null;
  try {
    const src = new File(srcUri);
    if (!src.exists) return null;
    const dir = sessionDir(session.id);
    ensureDir(dir);
    const dst = new File(dir, fileName);
    const buffer = await src.arrayBuffer();
    await dst.write(buffer);
    try {
      src.delete();
    } catch {
    }
    return dst.uri;
  } catch {
    return srcUri;
  }
}

export async function addAnswer(session, answer) {
  session.answers.push(answer);
  logEvent(session, 'answer_recorded', {
    questionId: answer.questionId,
    score: answer.score,
    source: answer.source,
  });
  await persist(session);
  return answer;
}

export async function finalizeSession(session, { summary, integritySummary }) {
  session.endedAt = Date.now();
  session.summary = summary;
  session.integrity.summary = integritySummary || null;
  logEvent(session, 'session_completed', { overallScore: summary ? summary.overallScore : null });
  await persist(session);
  await indexAdd({
    id: session.id,
    jobId: session.jobId,
    jobTitle: session.jobTitle,
    company: session.company,
    candidateName: session.candidateName,
    startedAt: session.createdAt,
    endedAt: session.endedAt,
    answerCount: session.answers.length,
    overallScore: summary ? summary.overallScore : null,
    integrityFlags: session.integrity.events ? session.integrity.events.length : 0,
  });
  return session;
}

export async function indexAdd(entry) {
  const list = await listSessions();
  const next = [entry, ...list.filter((s) => s.id !== entry.id)];
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
}

export async function listSessions() {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function loadSession(id) {
  try {
    const file = new File(sessionDir(id), 'session.json');
    if (!file.exists) return null;
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function clearAllSessions() {
  const list = await listSessions();
  list.forEach((s) => {
    try {
      const dir = sessionDir(s.id);
      if (dir.exists) dir.delete();
    } catch {
    }
  });
  await AsyncStorage.removeItem(INDEX_KEY);
}
