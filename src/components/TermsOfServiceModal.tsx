import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useThemeColors, ColorsType, Spacing, Radius, FontSize } from '../utils/theme';
import { PRIVACY_CONTACT } from './PrivacyPolicyModal';

export const TERMS_EFFECTIVE = 'June 13, 2026';

interface Section { heading: string; body: string }

const SECTIONS: Section[] = [
  {
    heading: 'The short version',
    body:
      'MaglakbAI is a free pilot that lets you log real proof-of-work and earn XP. By using it you agree to these terms. It is provided as-is, you stay in control of your data, and you can delete your account at any time.',
  },
  {
    heading: 'Who can use it',
    body:
      'MaglakbAI is intended for people aged 16 and older. By using it you confirm you meet that age and that any information you provide is accurate.',
  },
  {
    heading: 'Your account & Cloud Backup',
    body:
      'You can use MaglakbAI entirely on your device with no account. If you choose Cloud Backup, you sign in with a one-time email link (no password) and your progress is stored with Supabase, our cloud provider. Keep access to your email secure — anyone who can open your sign-in link can reach your backup. See the Privacy Policy for exactly what is stored.',
  },
  {
    heading: 'Your content',
    body:
      'You own everything you log — your outputs, titles, descriptions, links and reflections. You grant us only the limited permission needed to store and display that content back to you within the app (and, if you explicitly share to the community feed, to show it there). You are responsible for what you log: do not upload confidential information you are not allowed to share, content that infringes someone else’s rights, or anything unlawful.',
  },
  {
    heading: 'Acceptable use',
    body:
      'Use MaglakbAI for its purpose — tracking and celebrating real skill-building. Do not misuse it: no illegal activity, no harassment or abusive content, no attempting to access other users’ data, break security or row-level access controls, scrape the service, or disrupt its operation. We may suspend or remove access that abuses these rules.',
  },
  {
    heading: 'Pilot status — provided “as is”',
    body:
      'MaglakbAI is an early pilot offered free of charge. Features may change, break, or be removed, and the service may be unavailable at times. It is provided “as is” and “as available,” without warranties of any kind. Local (on-device) data can be lost if you clear your browser or switch devices — export a backup regularly, and use Cloud Backup, to protect your progress. We are not liable for lost progress, and to the maximum extent permitted by law our total liability arising from your use of the pilot is limited to the amount you paid for it (which is nothing).',
  },
  {
    heading: 'Deleting your account',
    body:
      'You can delete your account and all cloud data yourself at any time from Settings → Delete Account — this permanently erases your profile, outputs, skill progress and the email held for Cloud Backup, and cannot be undone. Settings → Reset All Progress wipes only this device and signs you out. We may also terminate accounts that violate these terms.',
  },
  {
    heading: 'Changes to these terms',
    body:
      'As the pilot evolves these terms may change. Material changes will be reflected here with a new effective date; continuing to use MaglakbAI after a change means you accept the updated terms.',
  },
  {
    heading: 'Governing law & contact',
    body:
      `These terms are governed by the laws of the Republic of the Philippines, without regard to conflict-of-law rules. Questions about these terms? Contact ${PRIVACY_CONTACT}.`,
  },
];

export default function TermsOfServiceModal({
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
            <Text style={styles.title}>Terms of Service</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close terms of service"
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.effective}>Effective {TERMS_EFFECTIVE}</Text>

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
