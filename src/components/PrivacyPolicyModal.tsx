import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useThemeColors, ColorsType, Spacing, Radius, FontSize } from '../utils/theme';

export const PRIVACY_POLICY_EFFECTIVE = 'June 3, 2026';

export const PRIVACY_CONTACT = 'marlo.romanillos@gmail.com';

interface Section { heading: string; body: string }

const SECTIONS: Section[] = [
  {
    heading: 'The short version',
    body:
      'MaglakbAI is a pilot. Your progress — your outputs, XP, skills, and posts — is saved on this device. If you choose to use Cloud Backup (Settings → Cloud Backup), your email address and progress are also stored securely with Supabase, our cloud provider. We never share your data with third parties, and nothing you log is visible to other users.',
  },
  {
    heading: 'Where your data lives',
    body:
      'By default, everything is saved in your browser\'s local storage on this device only. If you sign in via Cloud Backup, your progress is also synced to Supabase (supabase.com), a secure cloud database. This allows you to access your progress from any device. Without Cloud Backup, clearing your browser data or switching devices may result in lost progress — use Settings → Export Data as a local backup.',
  },
  {
    heading: 'Analytics (optional, off by default)',
    body:
      'To improve the pilot we can collect anonymous usage events (for example: a screen was viewed, an output was logged) using PostHog. This is strictly opt-in — nothing is sent until you tap “Allow.” We never send your name, email, handle, or anything you type. You are identified only by a random anonymous ID. You can turn analytics off anytime in Settings.',
  },
  {
    heading: 'What we do NOT do',
    body:
      'We do not sell your data. We do not show third-party ads. We do not send your personal information to anyone. We do not track you across other websites.',
  },
  {
    heading: 'Your email (Cloud Backup)',
    body:
      'If you use Cloud Backup, your email address is stored with Supabase solely to send you a sign-in link. It is never used for marketing, never sold, and never shared with any third party. Supabase is a SOC 2 compliant cloud provider. You can sign out of Cloud Backup at any time from Settings.',
  },
  {
    heading: 'Deleting your data',
    body:
      'You are always in control. Use Settings → Reset All Progress to permanently erase everything from this device. If you signed in via Cloud Backup, contact us at ' + PRIVACY_CONTACT + ' to request deletion of your cloud data. Turning analytics off also clears your anonymous analytics ID.',
  },
  {
    heading: 'Children',
    body:
      'MaglakbAI is intended for users aged 16 and older. It is not directed at children.',
  },
  {
    heading: 'Changes & contact',
    body:
      `This is a pilot policy and may change as the product evolves. Questions? Contact ${PRIVACY_CONTACT}.`,
  },
];

export default function PrivacyPolicyModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Privacy Policy</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close privacy policy"
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.effective}>Effective {PRIVACY_POLICY_EFFECTIVE}</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {SECTIONS.map((s) => (
              <View key={s.heading} style={styles.section}>
                <Text style={styles.heading}>{s.heading}</Text>
                <Text style={styles.body}>{s.body}</Text>
              </View>
            ))}
            <View style={{ height: Spacing.xl }} />
          </ScrollView>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (Colors: ColorsType) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
      maxHeight: '88%',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      marginBottom: Spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeIcon: { fontSize: 15, color: Colors.textSub, fontWeight: '700' },
    effective: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, marginBottom: Spacing.md },
    scroll: { flexShrink: 1 },
    section: { marginBottom: Spacing.lg },
    heading: { fontSize: FontSize.base, fontWeight: '700', color: Colors.primaryLight, marginBottom: 6 },
    body: { fontSize: FontSize.sm, color: Colors.textSub, lineHeight: 21 },
    doneBtn: {
      backgroundColor: Colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    doneText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.white },
  });
