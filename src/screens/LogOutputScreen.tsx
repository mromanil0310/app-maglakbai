import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppStore, CAREER_PATHS, ALL_SKILLS, getEvidenceTier, BurnoutSignal } from '../store/appStore';
import { calculateOutputXP, OUTPUT_XP_BY_TYPE } from '../domain/progression';
import { useThemeColors, ColorsType, Colors, Spacing, Radius, FontSize, PathColors } from '../utils/theme';
import { OutputType } from '../types';
import { useToast } from '../components/Toast';
import LevelUpOverlay from '../components/LevelUpOverlay';
import { page, track } from '../utils/analytics';

// MED-008: only a syntactically valid http(s) URL counts as evidence. A bare
// "github/myrepo" is dropped so it isn't badged "Verified" with a dead, non-navigable
// link in the user's portfolio.
const isValidUrl = (u: string): boolean => {
  try {
    const x = new URL(u);
    return x.protocol === 'http:' || x.protocol === 'https:';
  } catch {
    return false;
  }
};
const toEvidenceLink = (link: string): string | undefined => {
  const t = link.trim();
  return t && isValidUrl(t) ? t : undefined;
};

const OUTPUT_TYPES: {
  id: OutputType;
  icon: string;
  label: string;
  xp: number;
  recoveryOnly?: boolean; // highlighted when user is in recovery mode
}[] = [
  // xp values come from OUTPUT_XP_BY_TYPE (single source of truth — ARCH-006)
  { id: 'project',    icon: '🔨', label: 'Project',  xp: OUTPUT_XP_BY_TYPE.project    },
  { id: 'cert',       icon: '🏅', label: 'Cert',     xp: OUTPUT_XP_BY_TYPE.cert       },
  { id: 'github',     icon: '💻', label: 'GitHub',   xp: OUTPUT_XP_BY_TYPE.github     },
  { id: 'book',       icon: '📖', label: 'Book',     xp: OUTPUT_XP_BY_TYPE.book       },
  { id: 'script',     icon: '⚙️', label: 'Script',   xp: OUTPUT_XP_BY_TYPE.script     },
  { id: 'diagram',    icon: '📐', label: 'Design',   xp: OUTPUT_XP_BY_TYPE.diagram    },
  { id: 'reflection', icon: '💭', label: 'Reflect',  xp: OUTPUT_XP_BY_TYPE.reflection, recoveryOnly: true },
  { id: 'event',      icon: '🎤', label: 'Event',    xp: OUTPUT_XP_BY_TYPE.event      },
  { id: 'other',      icon: '📋', label: 'Other',    xp: OUTPUT_XP_BY_TYPE.other      },
];

const OUTPUT_ICON_MAP: Record<OutputType, string> = {
  project: '🔨', cert: '🏅', github: '💻', book: '📖', script: '⚙️', diagram: '📐', reflection: '💭', event: '🎤', other: '📋',
};

const SKILL_QUESTION_LABEL: Record<OutputType, string> = {
  project:    'WHICH MILESTONE?',
  cert:       'WHICH CERT?',
  github:     'WHICH REPO / PROJECT?',
  book:       'WHICH BOOK?',
  script:     'WHICH SCRIPT?',
  diagram:    'WHICH DESIGN?',
  reflection: 'WHICH SKILL ARE YOU REFLECTING ON?',
  event:      'WHICH MILESTONE DOES THIS COUNT TOWARD?',
  other:      'WHICH MILESTONE DOES THIS COUNT TOWARD?',
};

const DESCRIPTION_LABEL: Record<OutputType, string> = {
  project:    'WHAT YOU BUILT / LEARNED',
  cert:       'WHAT YOU STUDIED / EARNED',
  github:     'WHAT YOU SHIPPED',
  book:       'KEY TAKEAWAYS / WHAT YOU LEARNED',
  script:     'WHAT IT DOES / HOW YOU BUILT IT',
  diagram:    'WHAT YOU DESIGNED / KEY DECISIONS',
  reflection: 'WHAT\'S ON YOUR MIND',
  event:      'WHAT YOU ORGANISED / DID',
  other:      'WHAT YOU DID / ACCOMPLISHED',
};

const DESCRIPTION_PLACEHOLDER: Record<OutputType, string> = {
  project:    'Describe what you implemented or the problem that you solved.',
  cert:       'What did you study? What areas does this cert cover? How did you prepare?',
  github:     'What does it do? What was the hardest part to ship? What did you learn?',
  book:       'What were your biggest takeaways? What will you apply? Any key quotes or concepts?',
  script:     'What problem does it solve? Walk through how it works and what you learned building it.',
  diagram:    'What did you design? What decisions did you make and why?',
  reflection: 'What clicked for you? What\'s still fuzzy? What are you excited to build next on this path?',
  event:      'Describe the event or activity. Who was involved? What was the outcome or impact?',
  other:      'Describe what you did, made, or accomplished. What was the result or what did you learn?',
};

// ── Session recap overlay ────────────────────────────────────────────────────

interface RecapData {
  xpGained: number;
  newStreak: number;
  skillName?: string;
  outputsLeft: number | null;
  skillXpReward?: number;
  pathColor: string;
  evidenceRequired?: boolean; // true when skill would have completed but evidence gate blocked it
}

function SessionRecap({ data, onDismiss }: { data: RecapData; onDismiss: () => void }) {
  const Colors = useThemeColors();
  const rs = makeRecapStyles(Colors);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0.92)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const DURATION = 3500;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: false }),
      Animated.spring(cardAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: false }),
    ]).start();
    Animated.timing(progressAnim, {
      toValue: 1, duration: DURATION - 100, useNativeDriver: false,
    }).start();
  }, []);

  const handleTap = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start(onDismiss);
  };

  const isOneAway = data.outputsLeft === 1;
  const progressMsg = (() => {
    if (data.outputsLeft == null || !data.skillName) return null;
    if (data.outputsLeft === 0 && data.evidenceRequired)
      return { text: `📝 Add a link or 50+ char description to unlock ${data.skillName}`, color: Colors.gold };
    if (data.outputsLeft === 0) return { text: '🎯 Skill complete!', color: Colors.success };
    if (isOneAway) return { text: `⚡ 1 more output to master ${data.skillName}!`, color: Colors.primaryLight };
    return { text: `${data.outputsLeft} more outputs to complete ${data.skillName}`, color: Colors.textSub };
  })();

  return (
    <Animated.View style={[rs.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleTap} />

      <Animated.View style={[rs.card, { transform: [{ scale: cardAnim }] }]}>
        {/* Header */}
        <Text style={rs.headline}>Output Logged!</Text>

        {/* XP */}
        <View style={rs.xpRow}>
          <Text style={rs.xpLabel}>XP EARNED</Text>
          <Text style={[rs.xpValue, { color: data.pathColor }]}>+{data.xpGained}</Text>
        </View>

        {/* Skill progress */}
        {progressMsg && (
          <View style={rs.progressRow}>
            <Text style={[rs.progressText, { color: progressMsg.color }]}>{progressMsg.text}</Text>
            {data.skillXpReward != null && isOneAway && (
              <Text style={rs.xpBonusHint}>+{data.skillXpReward} XP skill bonus waiting</Text>
            )}
          </View>
        )}

        {/* Streak */}
        {data.newStreak > 0 && (
          <View style={[rs.streakRow, { borderColor: Colors.gold + '30' }]}>
            <Text style={rs.streakEmoji}>🔥</Text>
            <View>
              <Text style={rs.streakText}>{data.newStreak}-day streak</Text>
              <Text style={rs.streakSub}>Log tomorrow to keep it going</Text>
            </View>
          </View>
        )}

        {/* Tomorrow hook */}
        <Text style={rs.tomorrowHint}>See you tomorrow →</Text>

        {/* Auto-dismiss timer */}
        <View style={rs.timerBar}>
          <Animated.View
            style={[rs.timerFill, {
              backgroundColor: data.pathColor,
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]}
          />
        </View>
        <Text style={rs.tapHint}>tap to continue</Text>
      </Animated.View>
    </Animated.View>
  );
}

export default function LogOutputScreen() {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => makeStyles(Colors), [Colors]);
  // HIGH-001: themed signal-modal styles so it respects dark mode (was static Colors).
  const signalStyles = React.useMemo(() => makeSignalStyles(Colors), [Colors]);
  const navigation = useNavigation<any>();
  const { showToast } = useToast();
  const user = useAppStore((s) => s.user);
  const userSkills = useAppStore((s) => s.userSkills);
  const selectedSkillId = useAppStore((s) => s.selectedSkillId);
  const setSelectedSkill = useAppStore((s) => s.setSelectedSkill);
  const logOutput = useAppStore((s) => s.logOutput);
  const submitMarketSignal = useAppStore((s) => s.submitMarketSignal);
  const submittedSignalSkillIds = useAppStore((s) => s.submittedSignalSkillIds);
  const marketDemand = useAppStore((s) => s.marketDemand);
  const outputs = useAppStore((s) => s.outputs);
  const customPaths = useAppStore((s) => s.customPaths);
  const addRoadmapItem = useAppStore((s) => s.addRoadmapItem);
  const prioritizedPathId = useAppStore((s) => s.prioritizedPathId);
  const paceMode = user?.paceMode;

  const [outputType, setOutputType] = useState<OutputType>('project');
  const [skillId, setSkillId] = useState<string>(selectedSkillId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [keyTakeaway, setKeyTakeaway] = useState('');
  const [link, setLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [floatXP, setFloatXP] = useState(0);
  const [showFloat, setShowFloat] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ newLevel: number; xpGained: number } | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState<RecapData | null>(null);
  const [showSignalPrompt, setShowSignalPrompt] = useState(false);
  const [pendingSignalSkillId, setPendingSignalSkillId] = useState<string | null>(null);
  const hasSubmitted = useRef(false);
  // CRIT-003: hold the recap auto-dismiss timer so a manual dismiss can cancel it,
  // preventing a second navigation.navigate('Home') firing after the user already left.
  const recapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formStateRef = useRef({ skillId: '', title: '', description: '', keyTakeaway: '', outputType: 'project' as OutputType });

  // Keep formStateRef up to date so the cleanup function can read accurate values
  formStateRef.current = { skillId, title, description, keyTakeaway, outputType };
  const floatY = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;

  const submitScaleRef = useRef(new Animated.Value(1));
  const submitScale = submitScaleRef.current;
  const headerAnim = useRef(new Animated.Value(1)).current;

  function triggerFloat(xp: number) {
    setFloatXP(xp);
    setShowFloat(true);
    floatY.setValue(0);
    floatOpacity.setValue(1);
    // Haptic feedback on XP earn (web vibration API)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([10, 50, 10]);
    }
    Animated.parallel([
      Animated.timing(floatY, { toValue: -80, duration: 900, useNativeDriver: false }),
      Animated.timing(floatOpacity, { toValue: 0, duration: 900, useNativeDriver: false }),
    ]).start(() => setShowFloat(false));
  }

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: false }).start();
    page('log_output', { has_skill_preselected: !!selectedSkillId });

    return () => {
      // Track abandonment — fires when navigating away without submitting
      if (!hasSubmitted.current) {
        const s = formStateRef.current;
        track('log_screen_abandoned', {
          had_skill_selected: !!s.skillId,
          had_title: s.title.trim().length > 0,
          had_description: s.description.trim().length > 0,
          output_type: s.outputType,
        });
      }
    };
  }, []);

  useEffect(() => {
    if (selectedSkillId) setSkillId(selectedSkillId);
  }, [selectedSkillId]);

  // CRIT-003: clear any pending recap timer on unmount to avoid a late navigate / setState.
  useEffect(() => () => {
    if (recapTimerRef.current) clearTimeout(recapTimerRef.current);
  }, []);

  // Auto-select the first available skill so outputs count toward career progression
  // without requiring the user to manually pick from the milestone list
  useEffect(() => {
    if (!skillId) {
      const activePathId = prioritizedPathId ?? user?.careerPathId ?? '';
      // 1. Prefer a skill on the user's active built-in path
      const firstBuiltIn = ALL_SKILLS.find((s) => {
        if (s.pathId !== activePathId) return false;
        const us = userSkills[s.id];
        return us?.status === 'available' || us?.status === 'in_progress';
      });
      if (firstBuiltIn) { setSkillId(firstBuiltIn.id); return; }
      // 2. Fall back to any built-in skill that's available (other paths)
      const anyBuiltIn = ALL_SKILLS.find((s) => {
        const us = userSkills[s.id];
        return us?.status === 'available' || us?.status === 'in_progress';
      });
      if (anyBuiltIn) { setSkillId(anyBuiltIn.id); return; }
      // 3. Fall back to custom path skills (e.g. "Build My Own Path" users)
      for (const cp of customPaths) {
        for (const cs of cp.skills) {
          const us = userSkills[cs.id];
          if (!us || us.status === 'available' || us.status === 'in_progress') {
            setSkillId(cs.id);
            return;
          }
        }
      }
    }
  }, [skillId, prioritizedPathId, user?.careerPathId, userSkills, customPaths]);

  if (!user) return null;

  // Built-in career path milestones (available or in-progress)
  // Use prioritizedPathId if set (user pinned a different path on Home), fall back to their enrolled path
  const activePathId = prioritizedPathId ?? user.careerPathId;

  interface SkillOption {
    id: string; name: string; icon: string;
    outputCount: number; requiredOutputs: number; xpReward: number;
    isCustom?: boolean; pathLabel?: string;
  }
  const builtInOptions: SkillOption[] = ALL_SKILLS.filter((s) => {
    if (s.pathId !== activePathId) return false;
    const us = userSkills[s.id];
    return us?.status === 'available' || us?.status === 'in_progress';
  }).map((s) => ({
    id: s.id, name: s.name, icon: s.icon,
    outputCount: userSkills[s.id]?.outputCount ?? 0,
    requiredOutputs: s.requiredOutputs, xpReward: s.xpReward,
  }));

  // Custom path items — show all available/in-progress (personal library, custom roadmaps)
  const customOptions: SkillOption[] = customPaths.flatMap((cp) =>
    cp.skills
      .filter((cs) => {
        const us = userSkills[cs.id];
        return !us || us.status === 'available' || us.status === 'in_progress';
      })
      .map((cs) => ({
        id: cs.id,
        name: cs.name,
        icon: cs.icon || OUTPUT_ICON_MAP[outputType],
        outputCount: userSkills[cs.id]?.outputCount ?? 0,
        requiredOutputs: 1,
        xpReward: OUTPUT_TYPES.find((t) => t.id === outputType)?.xp ?? 50,
        isCustom: true,
        pathLabel: cp.name,
      }))
  );

  const allOptions: SkillOption[] = [...builtInOptions, ...customOptions];

  // Show "+ Add to roadmap" when title is typed but doesn't match any existing item
  const titleTrimmed = title.trim();
  const showAddToRoadmap = titleTrimmed.length >= 2 &&
    !allOptions.some((o) => o.name.toLowerCase() === titleTrimmed.toLowerCase());

  // After recap: optionally show the signal prompt (once per skill, only if skill has demand data)
  const maybeShowSignalPrompt = (loggedSkillId: string) => {
    const hasSignal = submittedSignalSkillIds.includes(loggedSkillId);
    const hasDemandData = !!marketDemand[loggedSkillId];
    if (!hasSignal && hasDemandData && loggedSkillId) {
      setPendingSignalSkillId(loggedSkillId);
      setShowSignalPrompt(true);
    } else {
      navigation.navigate('Home');
    }
  };

  const handleSignalYes = async () => {
    if (!pendingSignalSkillId) return;
    const pathId = user?.careerPathId ?? '';
    await submitMarketSignal(pendingSignalSkillId, pathId);
    setShowSignalPrompt(false);
    setPendingSignalSkillId(null);
    navigation.navigate('Home');
  };

  const handleSignalSkip = () => {
    setShowSignalPrompt(false);
    setPendingSignalSkillId(null);
    navigation.navigate('Home');
  };

  const handleSubmit = () => {
    if (!title.trim() || !description.trim() || submitting) return;

    // Resolve effective skill: use selected, fall back to first available, or empty (freeform)
    const effectiveSkillId = skillId || allOptions[0]?.id || '';

    setSubmitting(true);

    // Capture pre-log state for session recap (store updates synchronously inside logOutput)
    const preLogOutputCount = userSkills[effectiveSkillId]?.outputCount ?? 0;
    const currentSkill = ALL_SKILLS.find((s) => s.id === effectiveSkillId);
    const activePathId = prioritizedPathId ?? user?.careerPathId ?? '';
    const recapPathColor = PathColors[activePathId]?.primary ?? Colors.primary;

    Animated.sequence([
      Animated.timing(submitScale, { toValue: 0.96, duration: 80, useNativeDriver: false }),
      Animated.timing(submitScale, { toValue: 1, duration: 120, useNativeDriver: false }),
    ]).start(() => {
      const result = logOutput({
        skillId: effectiveSkillId,
        type: outputType,
        title: title.trim(),
        description: description.trim(),
        link: toEvidenceLink(link),
        keyTakeaway: keyTakeaway.trim() || undefined,
      });

      hasSubmitted.current = true;
      triggerFloat(result.xpGained);

      setTitle('');
      setDescription('');
      setKeyTakeaway('');
      setLink('');
      setSelectedSkill(null);
      setSubmitting(false);

      // If the user hit a streak milestone (7/14/30 days), celebrate it with a bonus toast
      if (result.streakBonusXP && result.streakBonusXP > 0) {
        // MED-005: trust the authoritative newStreak from the action, not a fragile
        // reverse-map of the bonus XP amount (which breaks if the XP knobs change).
        const streakDays = result.newStreak;
        setTimeout(() => {
          showToast({
            message: `${streakDays}-Day Streak Bonus!`,
            xp: result.streakBonusXP,
            emoji: '🔥',
            variant: 'warning',
            duration: 3800,
          });
        }, 1400);
      }

      // Show toast feedback for XP earned
      const isBuiltInSkill = ALL_SKILLS.some((s) => s.id === effectiveSkillId);
      if (result.skillCompleted && isBuiltInSkill) {
        // Milestone complete — toast fires before the celebration modal slides up
        showToast({
          message: 'Skill complete! Milestone unlocked 🎉',
          xp: result.xpGained,
          emoji: '🏆',
          variant: 'success',
          duration: 2800,
        });
        navigation.navigate('MilestoneDetail', {
          skillId: effectiveSkillId,
          xpGained: result.xpGained,
          sessionXpGained: result.sessionXpGained,
          achievements: result.newAchievements,
          leveledUp: result.leveledUp,
          newLevel: result.newLevel,
        });
      } else if (result.evidenceRequired) {
        // Output logged + XP earned, but skill won't complete without quality evidence
        showToast({
          message: 'Add a link or write 50+ chars to complete this skill',
          xp: result.xpGained,
          emoji: '📝',
          variant: 'warning',
          duration: 4500,
        });
        // Show normal recap so XP is acknowledged, then go home
        const postLogCount = preLogOutputCount + 1;
        const currentSkill = ALL_SKILLS.find((s) => s.id === effectiveSkillId);
        const outputsLeft = currentSkill
          ? Math.max(0, currentSkill.requiredOutputs - postLogCount)
          : null;
        setRecapData({
          xpGained: result.xpGained,
          newStreak: result.newStreak ?? (user?.streak ?? 0),
          skillName: currentSkill?.name,
          outputsLeft,
          skillXpReward: currentSkill?.xpReward,
          pathColor: recapPathColor,
          evidenceRequired: true,
        });
        setShowRecap(true);
        recapTimerRef.current = setTimeout(() => {
          recapTimerRef.current = null;
          setShowRecap(false);
          maybeShowSignalPrompt(effectiveSkillId);
        }, 3500);
      } else if (result.leveledUp) {
        // Level-up without skill completion — show the level-up overlay, then go to Map
        setLevelUpData({ newLevel: result.newLevel, xpGained: result.xpGained });
        setShowLevelUp(true);
      } else {
        // Regular output — show session recap overlay, then navigate Home
        const postLogCount = preLogOutputCount + 1;
        const outputsLeft = currentSkill
          ? Math.max(0, currentSkill.requiredOutputs - postLogCount)
          : null;
        setRecapData({
          xpGained: result.xpGained,
          newStreak: result.newStreak ?? (user?.streak ?? 0),
          skillName: currentSkill?.name,
          outputsLeft,
          skillXpReward: currentSkill?.xpReward,
          pathColor: recapPathColor,
        });
        setShowRecap(true);
        recapTimerRef.current = setTimeout(() => {
          recapTimerRef.current = null;
          setShowRecap(false);
          maybeShowSignalPrompt(effectiveSkillId);
        }, 3500);
      }
    });
  };

  // skillId is optional — if empty at submit time we use the first available option
  // (or log as freeform work if no milestones exist at all)
  const canSubmit = Boolean(title.trim() && description.trim());

  const selectedType = OUTPUT_TYPES.find((t) => t.id === outputType)!;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.headerTitle}>Log Your Work</Text>
          <Text style={styles.headerSub}>Proof-based progression — build it, then log it.</Text>
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recovery mode banner */}
          {paceMode === 'recovery' && (
            <View style={styles.recoveryBanner}>
              <Text style={styles.recoveryBannerIcon}>🌿</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.recoveryBannerTitle}>Recovery Mode Active</Text>
                <Text style={styles.recoveryBannerSub}>
                  Light engagement counts. A quick Reflection is a great choice.
                </Text>
              </View>
            </View>
          )}

          {/* Output Type — 3x2 grid */}
          <Text style={styles.label}>WHAT DID YOU CREATE?</Text>
          <View style={styles.typeGrid}>
            {OUTPUT_TYPES.map((type) => {
              const isActive = outputType === type.id;
              const isRecoveryHighlight = paceMode === 'recovery' && type.id === 'reflection' && !isActive;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeChip,
                    isActive && styles.typeChipActive,
                    isRecoveryHighlight && styles.typeChipRecovery,
                  ]}
                  onPress={() => setOutputType(type.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${type.label}, +${type.xp} XP${isActive ? ', selected' : ''}`}
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={styles.typeChipIcon}>{type.icon}</Text>
                  <Text style={[styles.typeChipLabel, isActive && styles.typeChipLabelActive]}>
                    {type.label}
                  </Text>
                  <Text style={[styles.typeChipXP, isActive && styles.typeChipXPActive]}>
                    +{type.xp} XP
                  </Text>
                  {isRecoveryHighlight && (
                    <Text style={styles.typeChipRecoveryBadge}>RECOVERY</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* No milestones available — nudge to Evolve */}
          {allOptions.length === 0 && (
            <View style={styles.lockedNudge}>
              <Text style={styles.lockedNudgeIcon}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.lockedNudgeTitle}>All milestones are locked</Text>
                <Text style={styles.lockedNudgeSub}>
                  Unlock your first skill on the Evolve map to start logging outputs that count toward your path.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.lockedNudgeBtn}
                onPress={() => navigation.navigate('Map')}
                activeOpacity={0.8}
              >
                <Text style={styles.lockedNudgeBtnText}>Evolve →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Skill context */}
          {skillId && (() => {
            const skill = ALL_SKILLS.find((s) => s.id === skillId);
            const us = userSkills[skillId];
            if (!skill || !us) return null;
            const done = us.outputCount;
            const needed = skill.requiredOutputs;
            const remaining = Math.max(0, needed - done - 1);
            const willComplete = remaining <= 0;

            // Evidence gate check — mirrors the logic in the evidence meter below.
            // If this output would complete the skill but neither the current entry
            // nor any prior output provides quality proof, warn the user up front.
            const currentTier = getEvidenceTier(toEvidenceLink(link), description);
            const hasExistingQuality = outputs.some((o) => {
              if (o.skillId !== skillId) return false;
              const t = o.evidenceTier ?? getEvidenceTier(o.link, o.description);
              return t !== 'logged';
            });
            const gateWillBlock = willComplete && !hasExistingQuality && currentTier === 'logged';

            return (
              <View style={[
                styles.skillContextBanner,
                gateWillBlock && styles.skillContextBannerGate,
              ]}>
                <Text style={styles.skillContextIcon}>{skill.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.skillContextLabel}>COUNTS TOWARD</Text>
                  <Text style={[
                    styles.skillContextName,
                    gateWillBlock && styles.skillContextNameGate,
                  ]}>{skill.name}</Text>
                  {gateWillBlock && (
                    <Text style={styles.skillContextGateHint}>
                      Add a link or write 50+ chars to unlock this skill
                    </Text>
                  )}
                </View>
                <View style={styles.skillContextProgress}>
                  {gateWillBlock ? (
                    <Text style={styles.skillContextGateBadge}>⚠️ Needs proof</Text>
                  ) : remaining <= 0 ? (
                    <Text style={styles.skillContextComplete}>🎉 Completes skill!</Text>
                  ) : (
                    <Text style={styles.skillContextCount}>
                      {done + 1}/{needed} outputs{remaining > 0 ? ` · ${remaining} more after` : ''}
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}

          {/* Title */}
          <Text style={styles.label}>TITLE</Text>
          <TextInput
            style={styles.input}
            placeholder={
              outputType === 'project'
                ? 'What project did you implement? Be specific.'
                : outputType === 'book'
                ? 'e.g. "Finished Atomic Habits — 14 key insights"'
                : outputType === 'github'
                ? 'e.g. "Built a Snowflake ETL pipeline"'
                : outputType === 'cert'
                ? 'e.g. "AWS Solutions Architect – Associate"'
                : outputType === 'event'
                ? 'e.g. "Led a community workshop on public speaking"'
                : outputType === 'other'
                ? 'Describe what you did or accomplished'
                : 'What did you build? Be specific.'
            }
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            accessibilityLabel="Output title"
          />

          {/* Description */}
          <Text style={styles.label}>{DESCRIPTION_LABEL[outputType]}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={DESCRIPTION_PLACEHOLDER[outputType]}
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={(t) => setDescription(t.slice(0, 500))}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            accessibilityLabel="Output description"
          />
          {description.length > 0 && (
            <Text style={[styles.charCounter, description.length >= 480 && styles.charCounterWarn]}>
              {description.length} / 500
            </Text>
          )}

          {/* Key Takeaway — ISSUE-010: optional field, earns +15 XP */}
          <Text style={styles.label}>
            KEY TAKEAWAY{' '}
            <Text style={styles.labelOptional}>(OPTIONAL · +15 XP)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="What's the one thing you'll apply from this?"
            placeholderTextColor={Colors.textMuted}
            value={keyTakeaway}
            onChangeText={(t) => setKeyTakeaway(t.slice(0, 200))}
            accessibilityLabel="Key takeaway (optional)"
          />
          {keyTakeaway.length > 0 && (
            <Text style={styles.charCounter}>{keyTakeaway.length} / 200</Text>
          )}

          {/* Link */}
          <Text style={styles.label}>LINK (IF APPLICABLE)</Text>
          <TextInput
            style={styles.input}
            placeholder="GitHub repo, deployed URL, Notion doc..."
            placeholderTextColor={Colors.textMuted}
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            keyboardType="url"
            accessibilityLabel="Link to your work (optional)"
          />
          {link.trim() && !isValidUrl(link.trim()) ? (
            <Text style={{ color: Colors.gold, fontSize: FontSize.sm, marginTop: 4 }}>
              Start with https:// — otherwise this link won't count as verified evidence.
            </Text>
          ) : null}

          {/* Evidence Meter — live quality tier + gate warning */}
          {(() => {
            const tier = getEvidenceTier(toEvidenceLink(link), description);
            const builtInSkill = ALL_SKILLS.find((s) => s.id === skillId);
            const us = skillId ? userSkills[skillId] : null;
            const willComplete = builtInSkill && us && (us.outputCount + 1 >= builtInSkill.requiredOutputs);
            // Check if any prior output for this skill already has quality evidence
            const hasExistingEvidence = outputs.some((o) => {
              if (o.skillId !== skillId) return false;
              const t = o.evidenceTier ?? getEvidenceTier(o.link, o.description);
              return t !== 'logged';
            });
            const showGateWarning = willComplete && !hasExistingEvidence && tier === 'logged';

            const tierConfig = {
              verified:   { icon: '🔗', label: 'Verified',   color: Colors.success },
              documented: { icon: '📝', label: 'Documented', color: Colors.primaryLight },
              logged:     { icon: '📌', label: 'Logged',     color: Colors.textMuted },
            }[tier];

            return (
              <View style={styles.evidenceMeter}>
                <View style={styles.evidenceMeterRow}>
                  <Text style={styles.evidenceMeterLabel}>EVIDENCE QUALITY</Text>
                  <View style={[styles.evidenceTierBadge, { borderColor: tierConfig.color + '50', backgroundColor: tierConfig.color + '15' }]}>
                    <Text style={[styles.evidenceTierText, { color: tierConfig.color }]}>
                      {tierConfig.icon} {tierConfig.label}
                    </Text>
                  </View>
                </View>
                {tier === 'logged' && !showGateWarning && (
                  <Text style={styles.evidenceHint}>
                    Add a link → <Text style={{ color: Colors.success }}>Verified</Text>  ·  Write 50+ chars → <Text style={{ color: Colors.primaryLight }}>Documented</Text>
                  </Text>
                )}
                {showGateWarning && (
                  <View style={styles.evidenceGateWarning}>
                    <Text style={styles.evidenceGateIcon}>⚠️</Text>
                    <Text style={styles.evidenceGateText}>
                      This will complete the skill — add a link or expand your description to 50+ chars to unlock it.
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* XP Preview — ISSUE-010: live quality + takeaway bonus display */}
          {skillId && (
            <View style={styles.xpPreview}>
              <Text style={styles.xpPreviewIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.xpPreviewLabel}>You'll earn</Text>
                {(() => {
                  const hasKeyTakeaway = keyTakeaway.trim().length > 0;
                  const totalBase = calculateOutputXP(selectedType.id, description.length, hasKeyTakeaway);
                  const qualityBonus = description.length >= 120 ? 20
                    : description.length >= 50 ? 10 : 0;
                  const takeawayBonus = hasKeyTakeaway ? 15 : 0;
                  const builtInSkill = ALL_SKILLS.find((s) => s.id === skillId);
                  const us = userSkills[skillId];
                  const completesSkill = builtInSkill && us && us.outputCount + 1 >= builtInSkill.requiredOutputs;
                  return (
                    <>
                      <View style={styles.xpPreviewRow}>
                        <Text style={styles.xpPreviewValue}>+{totalBase} XP</Text>
                        {completesSkill && (
                          <Text style={styles.xpPreviewBonus}>
                            {' '}+ +{builtInSkill.xpReward} XP on skill complete 🎉
                          </Text>
                        )}
                      </View>
                      {(qualityBonus > 0 || takeawayBonus > 0) && (
                        <View style={styles.xpBonusRow}>
                          <Text style={styles.xpBonusBase}>Base {selectedType.xp}</Text>
                          {qualityBonus > 0 && (
                            <Text style={styles.xpBonusChip}>
                              {description.length >= 120 ? '✍️ Detailed +20' : '✍️ Quality +10'}
                            </Text>
                          )}
                          {takeawayBonus > 0 && (
                            <Text style={styles.xpBonusChip}>💡 Takeaway +15</Text>
                          )}
                        </View>
                      )}
                    </>
                  );
                })()}
              </View>
            </View>
          )}

          {/* Submit */}
          <View style={{ position: 'relative' }}>
            <Animated.View style={{ transform: [{ scale: submitScale }] }}>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  !canSubmit && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={!canSubmit || submitting}
                accessibilityRole="button"
                accessibilityLabel={submitting ? 'Logging your output' : 'Log it and earn XP'}
                accessibilityState={{ disabled: !canSubmit || submitting }}
              >
                <Text style={styles.submitBtnText}>
                  {submitting ? 'Logging...' : 'Log It & Earn XP ⚡'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            {showFloat && (
              <Animated.Text style={{
                position: 'absolute', alignSelf: 'center', bottom: 60,
                transform: [{ translateY: floatY }],
                opacity: floatOpacity,
                fontSize: 22, fontWeight: '900', color: '#F59E0B',
                // @ts-ignore
                textShadow: '0 0 12px rgba(245,158,11,0.8)',
                pointerEvents: 'none',
              }}>
                +{floatXP} XP ⚡
              </Animated.Text>
            )}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Session recap overlay — shown after a regular output is logged */}
      <Modal visible={showRecap} transparent animationType="none" statusBarTranslucent>
        {recapData && (
          <SessionRecap
            data={recapData}
            onDismiss={() => {
              // CRIT-003: cancel the pending auto-dismiss so it can't navigate a second time.
              if (recapTimerRef.current) {
                clearTimeout(recapTimerRef.current);
                recapTimerRef.current = null;
              }
              setShowRecap(false);
              navigation.navigate('Home');
            }}
          />
        )}
      </Modal>

      {/* Market Signal Prompt — shown once per skill after recap dismisses */}
      {showSignalPrompt && (
        <Modal visible transparent animationType="fade" onRequestClose={handleSignalSkip}>
          <View style={signalStyles.backdrop}>
            <View style={signalStyles.card}>
              <Text style={signalStyles.emoji}>📋</Text>
              <Text style={signalStyles.title}>Quick question</Text>
              <Text style={signalStyles.body}>
                Was this skill listed as a requirement in a job or interview you applied to?
              </Text>
              <Text style={signalStyles.sub}>
                Your answer helps other builders know what's in demand — anonymous & takes 1 second.
              </Text>
              <View style={signalStyles.buttons}>
                <TouchableOpacity style={signalStyles.btnYes} onPress={handleSignalYes}>
                  <Text style={signalStyles.btnYesText}>Yes, it was 🎯</Text>
                </TouchableOpacity>
                <TouchableOpacity style={signalStyles.btnSkip} onPress={handleSignalSkip}>
                  <Text style={signalStyles.btnSkipText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Level-Up Overlay — shown when user levels up from a non-skill-completion output */}
      {showLevelUp && levelUpData && (
        <LevelUpOverlay
          newLevel={levelUpData.newLevel}
          xpGained={levelUpData.xpGained}
          onDismiss={() => {
            setShowLevelUp(false);
            showToast({
              message: `Level ${levelUpData.newLevel} reached! Keep building.`,
              xp: levelUpData.xpGained,
              emoji: '🏆',
              variant: 'success',
              duration: 3000,
            });
            setTimeout(() => navigation.navigate('Map'), 400);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Session recap styles ─────────────────────────────────────────────────────

const makeRecapStyles = (Colors: ColorsType) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 10,
    // @ts-ignore
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  },
  headline: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 4,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
  },
  xpLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  xpValue: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  progressRow: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  progressText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  xpBonusHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    width: '100%',
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.gold,
  },
  streakSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  tomorrowHint: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSub,
    marginTop: 4,
  },
  timerBar: {
    width: '100%',
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  timerFill: {
    height: '100%',
    borderRadius: 2,
  },
  tapHint: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

const makeStyles = (Colors: ColorsType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 2,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },

  // Recovery mode banner
  recoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#10B98115',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#10B98130',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  recoveryBannerIcon: { fontSize: 20 },
  recoveryBannerTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#6EE7B7',
    marginBottom: 2,
  },
  recoveryBannerSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 15,
  },

  // 3×2 type grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    width: '31%',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 4,
    // @ts-ignore
    minWidth: 95,
  },
  typeChipActive: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primary,
    // @ts-ignore
    boxShadow: '0 0 12px rgba(124,58,237,0.25)',
  },
  typeChipIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  typeChipLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSub,
  },
  typeChipLabelActive: {
    color: Colors.primaryLight,
  },
  typeChipXP: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  typeChipXPActive: {
    color: Colors.gold,
  },
  typeChipRecovery: {
    borderColor: '#10B98145',
    backgroundColor: '#10B98108',
  },
  typeChipRecoveryBadge: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6EE7B7',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // Skill list
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Locked-milestones nudge (Fix 7)
  lockedNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockedNudgeIcon: {
    fontSize: 24,
  },
  lockedNudgeTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  lockedNudgeSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  lockedNudgeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 0,
  },
  lockedNudgeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },

  skillList: {
    gap: 8,
  },
  skillOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skillOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryDim,
    // @ts-ignore
    boxShadow: '0 0 10px rgba(124,58,237,0.15)',
  },
  skillOptionIcon: {
    fontSize: 22,
  },
  skillOptionName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.text,
  },
  skillOptionNameActive: {
    color: Colors.primaryLight,
  },
  skillOptionMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  skillCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillCheckText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  addToRoadmapOption: {
    borderStyle: 'dashed',
    borderColor: Colors.primary + '60',
    backgroundColor: Colors.primaryDim,
  },
  addToRoadmapName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.primaryLight,
  },

  // Skill option progress
  skillOptionFinalPush: {
    borderColor: Colors.gold + '50',
    backgroundColor: Colors.goldDim,
  },
  skillOptionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  finalPushBadge: {
    backgroundColor: Colors.gold + '20',
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    flexShrink: 0,
  },
  finalPushBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  skillProgressArea: {
    gap: 4,
  },
  skillProgressBg: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  skillProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  skillProgressFillSelected: {
    backgroundColor: Colors.primaryLight,
  },
  skillProgressFillFinalPush: {
    backgroundColor: Colors.gold,
  },
  skillProgressLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 13,
  },
  skillProgressLabelSelected: {
    color: Colors.primaryLight + 'CC',
  },
  skillXpHint: {
    color: Colors.gold,
    fontWeight: '600',
  },

  // Inputs
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.base,
    color: Colors.text,
  },
  inputMultiline: {
    height: 100,
    paddingTop: 12,
  },
  charCounter: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  charCounterWarn: {
    color: '#F59E0B',
  },

  // XP preview
  skillContextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.primary + '35',
  },
  skillContextIcon: {
    fontSize: 20,
  },
  skillContextLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  skillContextName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primaryLight,
    marginTop: 1,
  },
  skillContextProgress: {
    alignItems: 'flex-end',
  },
  skillContextCount: {
    fontSize: FontSize.xs,
    color: Colors.textSub,
    fontWeight: '500',
  },
  skillContextComplete: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '700',
  },
  // Evidence gate variant of the skill context banner
  skillContextBannerGate: {
    backgroundColor: Colors.gold + '10',
    borderColor: Colors.gold + '40',
  },
  skillContextNameGate: {
    color: Colors.gold,
  },
  skillContextGateHint: {
    fontSize: 10,
    color: Colors.gold + 'CC',
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 14,
  },
  skillContextGateBadge: {
    fontSize: FontSize.xs,
    color: Colors.gold,
    fontWeight: '700',
  },

  // ── Evidence Meter ──────────────────────────────────────────────────────────
  evidenceMeter: {
    marginTop: Spacing.md,
    gap: 6,
  },
  evidenceMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  evidenceMeterLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  evidenceTierBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  evidenceTierText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  evidenceHint: {
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 15,
  },
  evidenceGateWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Colors.gold + '12',
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
  },
  evidenceGateIcon: {
    fontSize: 13,
    marginTop: 1,
  },
  evidenceGateText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.gold,
    fontWeight: '500',
    lineHeight: 17,
  },
  // ── XP Preview ──────────────────────────────────────────────────────────────
  xpPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    padding: 14,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  xpPreviewIcon: {
    fontSize: 24,
  },
  xpPreviewLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  xpPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  xpPreviewValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.primaryLight,
  },
  xpPreviewBonus: {
    fontSize: FontSize.sm,
    color: Colors.gold,
    fontWeight: '600',
  },
  // ISSUE-010: quality bonus breakdown row
  xpBonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  xpBonusBase: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  xpBonusChip: {
    fontSize: 10,
    color: Colors.success,
    fontWeight: '700',
    backgroundColor: Colors.successDim,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  labelOptional: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.success,
    letterSpacing: 0.5,
  },

  // Submit button
  submitBtn: {
    borderRadius: Radius.full,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: Spacing.lg,
    // @ts-ignore - web-only gradient
    backgroundImage: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
    backgroundColor: Colors.primary,
    // @ts-ignore
    boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    shadowOpacity: 0.5,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.35,
  },
  submitBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },
});

// ── Market signal prompt styles ──────────────────────────────────────────────
const makeSignalStyles = (Colors: ColorsType) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emoji: {
    fontSize: 36,
    marginBottom: 12,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  sub: {
    fontSize: 12,
    color: Colors.textSub,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 24,
  },
  buttons: {
    width: '100%',
    gap: 10,
  },
  btnYes: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnYesText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: FontSize.sm,
  },
  btnSkip: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnSkipText: {
    color: Colors.textSub,
    fontSize: FontSize.sm,
  },
});
