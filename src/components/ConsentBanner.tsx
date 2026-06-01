import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeColors, ColorsType, Spacing, Radius, FontSize } from '../utils/theme';
import { getConsentStatus, setConsent } from '../utils/analytics';
import PrivacyPolicyModal from './PrivacyPolicyModal';

/**
 * Opt-in analytics consent. Shown once on first launch, before anything is
 * tracked. Until the user decides, analytics is fully off (see analytics.ts).
 */
export default function ConsentBanner() {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => makeStyles(Colors), [Colors]);
  const [decided, setDecided] = useState(getConsentStatus() !== 'undecided');
  const [policyOpen, setPolicyOpen] = useState(false);

  if (decided) return null;

  const decide = (granted: boolean) => {
    setConsent(granted);
    setDecided(true);
  };

  return (
    <>
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>📊 Help shape SkillForge</Text>
          <Text style={styles.body}>
            We’d love to learn how the pilot is used so we can improve it. May we collect{' '}
            <Text style={styles.bodyStrong}>anonymous</Text> usage stats? No name, email, or anything
            you type is ever sent — only an anonymous ID. You can change this anytime in Settings.
          </Text>

          <TouchableOpacity onPress={() => setPolicyOpen(true)} accessibilityRole="button">
            <Text style={styles.link}>Read our Privacy Policy →</Text>
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => decide(false)}
              accessibilityRole="button"
              accessibilityLabel="Decline analytics"
            >
              <Text style={styles.declineText}>No thanks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.allowBtn}
              onPress={() => decide(true)}
              accessibilityRole="button"
              accessibilityLabel="Allow anonymous analytics"
            >
              <Text style={styles.allowText}>Allow anonymous stats</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <PrivacyPolicyModal visible={policyOpen} onClose={() => setPolicyOpen(false)} />
    </>
  );
}

const makeStyles = (Colors: ColorsType) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: Spacing.md,
      // @ts-ignore web safe-area
      paddingBottom: 'env(safe-area-inset-bottom, 16px)' as any,
      zIndex: 1000,
    },
    card: {
      backgroundColor: Colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Colors.primary + '55',
      padding: Spacing.lg,
      // @ts-ignore web shadow
      boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
    },
    title: { fontSize: FontSize.base, fontWeight: '800', color: Colors.text, marginBottom: 6 },
    body: { fontSize: FontSize.sm, color: Colors.textSub, lineHeight: 20 },
    bodyStrong: { color: Colors.text, fontWeight: '700' },
    link: { fontSize: FontSize.sm, color: Colors.primaryLight, fontWeight: '600', marginTop: 10 },
    actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    declineBtn: {
      flex: 1,
      backgroundColor: Colors.cardAlt,
      borderRadius: Radius.md,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
    },
    declineText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSub },
    allowBtn: {
      flex: 1.6,
      backgroundColor: Colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    allowText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  });
