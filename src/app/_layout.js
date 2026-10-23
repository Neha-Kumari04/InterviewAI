import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../services/auth';
import { loadSettings } from '../services/settings';
import { configureTts } from '../services/tts';
import { colors } from '../theme';

export default function RootLayout() {
  useEffect(() => {
    loadSettings().then(configureTts);
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ title: 'InterviewAI' }} />
        <Stack.Screen name="preflight" options={{ title: 'System check' }} />
        <Stack.Screen name="interview" options={{ title: 'Live interview', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="report" options={{ title: 'Interview report' }} />
        <Stack.Screen name="sessions" options={{ title: 'Past interviews' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </AuthProvider>
  );
}
