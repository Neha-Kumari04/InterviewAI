import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../theme';

export function Screen({ children, scroll = false, style, contentStyle }) {
  const inner = (
    <View style={[styles.screenContent, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, { paddingBottom: spacing.xxl }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, style }) {
  return <Text style={[typography.caption, styles.sectionTitle, style]}>{children}</Text>;
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  small = false,
}) {
  const palette = {
    primary: { bg: colors.primary, border: colors.primary, text: '#fff' },
    success: { bg: colors.success, border: colors.success, text: '#fff' },
    secondary: { bg: colors.cardAlt, border: colors.border, text: colors.text },
    ghost: { bg: 'transparent', border: 'transparent', text: colors.primary },
    danger: { bg: colors.dangerSoft, border: colors.danger, text: colors.danger },
  }[variant] || {};

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: palette.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function StatusPill({ status = 'info', label }) {
  const map = {
    pass: { bg: colors.successSoft, fg: colors.success, text: label || 'PASS' },
    warn: { bg: colors.warnSoft, fg: colors.warn, text: label || 'WARN' },
    fail: { bg: colors.dangerSoft, fg: colors.danger, text: label || 'FAIL' },
    info: { bg: colors.primarySoft, fg: colors.primary, text: label || 'INFO' },
  };
  const s = map[status] || map.info;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.text}</Text>
    </View>
  );
}

export function MeterBar({ value = 0, height = 10 }) {
  const v = Math.max(0, Math.min(1, value));
  const color = v > 0.82 ? colors.danger : v > 0.62 ? colors.warn : colors.success;
  return (
    <View style={[styles.meterTrack, { height }]}>
      <View style={[styles.meterFill, { width: `${v * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function CheckRow({ label, value, status, tip }) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkRowTop}>
        <Text style={[typography.body, { fontWeight: '600', flex: 1 }]}>{label}</Text>
        <StatusPill status={status} />
      </View>
      {value ? <Text style={[typography.sub, { marginTop: 2 }]}>{value}</Text> : null}
      {tip ? <Text style={[typography.sub, { color: colors.textFaint, marginTop: 4 }]}>{tip}</Text> : null}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  autoCapitalize = 'none',
  keyboardType = 'default',
  multiline = false,
  style,
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      keyboardType={keyboardType}
      multiline={multiline}
      style={[styles.input, multiline && styles.inputMultiline, style]}
    />
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Tag({ children, color = colors.primary }) {
  return (
    <View style={[styles.tag, { borderColor: color + '55', backgroundColor: color + '18' }]}>
      <Text style={[styles.tagText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { marginTop: spacing.sm, marginBottom: spacing.xs },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonSmall: { minHeight: 38, paddingVertical: spacing.sm, borderRadius: radius.sm },
  buttonText: { fontSize: 15.5, fontWeight: '700', letterSpacing: 0.2 },
  buttonTextSmall: { fontSize: 13.5 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  meterTrack: {
    width: '100%',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  meterFill: { height: '100%', borderRadius: radius.pill },
  checkRow: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  checkRowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15.5,
  },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top', paddingTop: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  tagText: { fontSize: 11.5, fontWeight: '700' },
});
