import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyCredentials } from '../data/credentials';
import { getJob } from '../data/jobs';

const AUTH_KEY = '@interviewai/auth';

const AuthContext = createContext(null);

export async function login(username, password) {
  const result = verifyCredentials(username, password);
  if (!result.ok) return result;
  const { credential } = result;
  const job = getJob(credential.jobId);
  const session = {
    username: credential.username,
    candidateName: credential.candidateName,
    email: credential.email,
    jobId: credential.jobId,
    jobTitle: job ? job.title : 'Unknown role',
    company: job ? job.company : '',
    loggedInAt: Date.now(),
  };
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(session));
  return { ok: true, session };
}

export async function logout() {
  await AsyncStorage.removeItem(AUTH_KEY);
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_KEY);
        if (mounted && raw) setAuth(JSON.parse(raw));
      } catch {
      } finally {
        if (mounted) setBooting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      auth,
      booting,
      async signIn(username, password) {
        const result = await login(username, password);
        if (result.ok) setAuth(result.session);
        return result;
      },
      async signOut() {
        await logout();
        setAuth(null);
      },
    }),
    [auth, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
