import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAppStore, CAREER_PATHS, ALL_SKILLS } from '../store/appStore';
import { useThemeColors, ColorsType, Colors, Spacing, Radius, FontSize, PathColors } from '../utils/theme';
import { CareerPathId, CareerPath, CustomSkill, OutputType, ExperienceLevel } from '../types';
import { getPathDemandLabel, DEMAND_SOURCE_LABEL } from '../data/marketDemand';

const ONBOARDING_PATH_CATEGORIES = [
  { label: 'Data & AI', pathIds: ['data-architect', 'data-engineer', 'ai-engineer', 'ml-engineer', 'data-analyst'] },
  { label: 'Engineering', pathIds: ['fullstack', 'backend-engineer', 'frontend-engineer', 'mobile-developer', 'cloud-engineer', 'devops'] },
  { label: 'Security & Architecture', pathIds: ['cybersecurity', 'solutions-architect', 'software-architect'] },
  { label: 'Business & Strategy', pathIds: ['product-manager', 'business-analyst', 'project-manager', 'ui-ux-designer', 'startup-founder'] },
];
import { track } from '../utils/analytics';

const FIRST_OUTPUT_TYPES = [
  { id: 'project' as OutputType, icon: '🔨', label: 'Project' },
  { id: 'cert' as OutputType, icon: '🏅', label: 'Cert' },
  { id: 'github' as OutputType, icon: '💻', label: 'GitHub' },
  { id: 'book' as OutputType, icon: '📖', label: 'Book' },
  { id: 'script' as OutputType, icon: '⚙️', label: 'Script' },
  { id: 'diagram' as OutputType, icon: '📐', label: 'Design' },
  { id: 'event'   as OutputType, icon: '🎤', label: 'Event' },
  { id: 'other'   as OutputType, icon: '📋', label: 'Other' },
];

export default function OnboardingScreen() {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => makeStyles(Colors), [Colors]);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPath, setSelectedPath] = useState<CareerPathId | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);

  // Custom path state — set when user chooses "Build My Own Path" in step 2
  const [isCustomPath, setIsCustomPath] = useState(false);
  const [createdCustomPathId, setCreatedCustomPathId] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const logOutput = useAppStore((s) => s.logOutput);
  const addCustomPath = useAppStore((s) => s.addCustomPath);
  const customPaths = useAppStore((s) => s.customPaths);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: false }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: false }),
    ]).start();
    track('onboarding_started');
  }, []);

  // Forward transition: slide out left, come in from right
  const transitionTo = (nextStep: number) => {
    track('onboarding_step_completed', { step: step, next_step: nextStep });
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: -24, duration: 180, useNativeDriver: false }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(24);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
      ]).start();
    });
  };

  // Back transition: slide out right, come in from left (ISSUE-006)
  const transitionBack = (prevStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 24, duration: 150, useNativeDriver: false }),
    ]).start(() => {
      setStep(prevStep);
      slideAnim.setValue(-24);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
      ]).start();
    });
  };

  const handleSkipName = () => {
    track('onboarding_step_skipped', { step: 1 });
    transitionTo(2);
  };

  const handleSkipPath = () => {
    track('onboarding_step_skipped', { step: 2 });
    if (!selectedPath) setSelectedPath(CAREER_PATHS[0].id as CareerPathId);
    setIsCustomPath(false);
    transitionTo(3);
  };

  // Called when user finishes configuring their custom path in step 3.
  // Creates the custom path NOW so step 4 (first output) can reference it.
  const handleCustomPathCreated = (pathId: string) => {
    setCreatedCustomPathId(pathId);
    transitionTo(4);
  };

  // ISSUE-006: completeOnboarding is now called here (step 4) instead of step 2,
  // so the user can still go back from step 4 to fix their path selection.
  const handleFirstOutput = (type: OutputType, title: string, desc: string) => {
    const finalName = name.trim() || 'Explorer';
    const finalLevel: ExperienceLevel = experienceLevel ?? 'beginner';

    if (isCustomPath && createdCustomPathId) {
      // Custom path: completeOnboarding uses the custom path ID.
      // userSkills were already set by addCustomPath in step 3.
      completeOnboarding(finalName, createdCustomPathId, email.trim() || undefined);
      // Log first output to the first skill of the custom path (if provided)
      if (title.trim() && desc.trim()) {
        // Find the actual first skill ID from the stored custom path.
        // addCustomPath already ran in step 3, so customPaths is populated.
        const customPath = customPaths.find((p) => p.id === createdCustomPathId);
        const firstSkillId = customPath?.skills[0]?.id;
        if (firstSkillId) {
          logOutput({
            skillId: firstSkillId,
            type,
            title: title.trim(),
            description: desc.trim(),
          });
        }
      } else {
        track('onboarding_first_output_skipped', { career_path: createdCustomPathId, is_custom: true });
      }
    } else {
      const finalPath = selectedPath ?? (CAREER_PATHS[0].id as CareerPathId);
      // Finalize account — this is what triggers the navigator switch to Main
      completeOnboarding(finalName, finalPath, email.trim() || undefined, finalLevel);

      if (title.trim() && desc.trim()) {
        const firstSkill = ALL_SKILLS.find(
          (s) => s.pathId === finalPath && s.prerequisites.length === 0
        );
        if (firstSkill) {
          logOutput({
            skillId: firstSkill.id,
            type,
            title: title.trim(),
            description: desc.trim(),
          });
        }
      } else {
        track('onboarding_first_output_skipped', { career_path: finalPath });
      }
    }
    // hasOnboarded now true → navigator switches to Main automatically
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Step dots + back button row (ISSUE-006) */}
        <View style={styles.topRow}>
          {step > 0 ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => transitionBack(step - 1)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back to previous step"
            >
              <Text style={styles.backBtnText}>‹</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtnPlaceholder} />
          )}

          <View style={styles.stepDots}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step
                    ? styles.dotActive
                    : i < step
                    ? styles.dotDone
                    : styles.dotIdle,
                ]}
              />
            ))}
          </View>

          {/* Right spacer mirrors the back button so dots are centered */}
          <View style={styles.backBtnPlaceholder} />
        </View>

        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {step === 0 && (
            <WelcomeStep
              logoScale={logoScale}
              logoOpacity={logoOpacity}
              onNext={() => transitionTo(1)}
            />
          )}
          {step === 1 && (
            <NameStep name={name} setName={setName} email={email} setEmail={setEmail} onNext={() => transitionTo(2)} onSkip={handleSkipName} />
          )}
          {step === 2 && (
            <PathStep
              name={name}
              selectedPath={selectedPath}
              isCustomPath={isCustomPath}
              setSelectedPath={(p) => { setSelectedPath(p); setIsCustomPath(false); }}
              onSelectCustom={() => {
                setSelectedPath(null);
                setIsCustomPath(true);
                transitionTo(3);
              }}
              onNext={() => transitionTo(3)}
              onSkip={handleSkipPath}
            />
          )}
          {step === 3 && isCustomPath && (
            <CustomPathBuilderStep
              name={name}
              addCustomPath={addCustomPath}
              onCreated={handleCustomPathCreated}
              onBack={() => transitionBack(2)}
            />
          )}
          {step === 3 && !isCustomPath && (
            <ExperienceLevelStep
              name={name}
              selectedLevel={experienceLevel}
              onSelect={(level) => {
                setExperienceLevel(level);
                // Brief delay so the selection registers visually before advancing
                setTimeout(() => transitionTo(4), 320);
              }}
            />
          )}
          {step === 4 && (
            <FirstOutputStep
              pathId={isCustomPath ? (createdCustomPathId ?? '') : (selectedPath ?? (CAREER_PATHS[0].id as CareerPathId))}
              experienceLevel={isCustomPath ? 'beginner' : (experienceLevel ?? 'beginner')}
              isCustomPath={isCustomPath}
              onSubmit={handleFirstOutput}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── LakbAI Signature Icon v2 ─────────────────────────────────────────────────
// Design system:
//   • Bold FILLED letterforms — not thin strokes; maximum weight at 60px
//   • Navy background (#0B1830) — professional, premium, stands out in App Store
//   • L: White, thick, bold — the anchor/foundation
//   • A: Cyan→Blue gradient (#00C8FF→#1E3A8A) — vibrant, forward, tech-forward
//     The A's open triangular form = mountain peak, upward arrow, aspiration
//   • Swoosh arc: teal→blue ribbon sweeping right = the journey/path metaphor
//     This is the signature differentiator — no other app has this element
//   • Filipino DNA retained: the 8-ray sun is embedded as a subtle halo behind
//     the A peak, opacity 0.12 — discoverable on close inspection
//   • Reads clearly at 60×60 px; all elements merge into bold silhouette
function LakbAIIcon({ size = 120 }: { size?: number }) {
  return (
    // @ts-ignore — SVG is web-only; valid in react-native-web / Vite target
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      style={{ borderRadius: 26, overflow: 'hidden', display: 'block' } as any}
    >
      {/* @ts-ignore */}
      <defs>
        {/* Navy background — matches reference exactly */}
        {/* @ts-ignore */}
        <linearGradient id="lb2bg" x1="0%" y1="0%" x2="100%" y2="100%">
          {/* @ts-ignore */}<stop offset="0%" stopColor="#0F1F3D" />
          {/* @ts-ignore */}<stop offset="100%" stopColor="#060E1E" />
        </linearGradient>

        {/* A letter: cyan at peak → deep blue at base */}
        {/* @ts-ignore */}
        <linearGradient id="lb2a" x1="50%" y1="0%" x2="50%" y2="100%">
          {/* @ts-ignore */}<stop offset="0%" stopColor="#00C8FF" />
          {/* @ts-ignore */}<stop offset="55%" stopColor="#2563EB" />
          {/* @ts-ignore */}<stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>

        {/* Arrow stroke gradient (teal → deep blue, left to right) */}
        {/* @ts-ignore */}
        <linearGradient id="lb2sw" x1="0%" y1="0%" x2="100%" y2="0%">
          {/* @ts-ignore */}<stop offset="0%" stopColor="#06B6D4" />
          {/* @ts-ignore */}<stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        {/* Arrowhead marker — auto-rotates to match the curve tangent at endpoint */}
        {/* @ts-ignore */}
        <marker id="lb2arr" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          {/* @ts-ignore */}
          <polygon points="0,0 10,4 0,8" fill="#1D4ED8" />
        </marker>

        {/* L letter: pure white at top to off-white at base for depth */}
        {/* @ts-ignore */}
        <linearGradient id="lb2l" x1="0%" y1="0%" x2="0%" y2="100%">
          {/* @ts-ignore */}<stop offset="0%" stopColor="#FFFFFF" />
          {/* @ts-ignore */}<stop offset="100%" stopColor="#E0E8FF" />
        </linearGradient>
      </defs>

      {/* ── Background ─────────────────────────────────────────── */}
      {/* @ts-ignore */}
      <rect x="0" y="0" width="120" height="120" rx="26" ry="26" fill="url(#lb2bg)" />

      {/* ── Filipino sun DNA: 8-ray halo behind A peak ───────────── */}
      {/* Centre moved to (74,8) — the new A peak. Rays overflow top  */}
      {/* edge are clipped by overflow:hidden; that's intentional.    */}
      {/* @ts-ignore */}
      <g opacity="0.14" stroke="#00C8FF" strokeWidth="2" strokeLinecap="round">
        {/* @ts-ignore */}<line x1="74" y1="8" x2="74" y2="-4" />  {/* N  — clipped at canvas top */}
        {/* @ts-ignore */}<line x1="74" y1="8" x2="83" y2="-1" />  {/* NE */}
        {/* @ts-ignore */}<line x1="74" y1="8" x2="86" y2="8"  />  {/* E  */}
        {/* @ts-ignore */}<line x1="74" y1="8" x2="83" y2="17" />  {/* SE */}
        {/* @ts-ignore */}<line x1="74" y1="8" x2="74" y2="20" />  {/* S  */}
        {/* @ts-ignore */}<line x1="74" y1="8" x2="65" y2="17" />  {/* SW */}
        {/* @ts-ignore */}<line x1="74" y1="8" x2="62" y2="8"  />  {/* W  */}
        {/* @ts-ignore */}<line x1="74" y1="8" x2="65" y2="-1" />  {/* NW */}
      </g>

      {/* ── A letter (drawn FIRST so L sits in front) ────────────── */}
      {/* Peak pushed to y=8 (was 12), base to y=108 (was 94).       */}
      {/* Letters now fill 100px of 120px canvas = 83% — vs 68% before */}
      {/* @ts-ignore */}
      <g fill="none" stroke="url(#lb2a)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
        {/* @ts-ignore */}
        <polyline points="58,108 74,8 90,108" />
      </g>

      {/* ── L letter ─────────────────────────────────────────────── */}
      {/* Top pushed to y=10 (was 16), base to y=108 (was 94).       */}
      {/* @ts-ignore */}
      <g fill="none" stroke="url(#lb2l)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="miter">
        {/* @ts-ignore */}
        <polyline points="14,10 14,108 50,108" />
      </g>

      {/* ── Curved arrow ──────────────────────────────────────── */}
      {/* Replaces filled ribbon — now a directed arrow sweeping    */}
      {/* from lower-left (L's side) diagonally up to upper-right  */}
      {/* (A's peak area). Reads as: "navigate forward and upward." */}
      {/* markerEnd auto-rotates the arrowhead to the curve tangent */}
      {/* @ts-ignore */}
      <path
        d="M10,85 C38,72 70,57 106,44"
        fill="none"
        stroke="url(#lb2sw)"
        strokeWidth="5"
        strokeLinecap="round"
        markerEnd="url(#lb2arr)"
      />
    </svg>
  );
}

// ── Welcome Screen v2 ────────────────────────────────────────────────────────
// Design philosophy: Headspace / Spotify clarity — one dominant visual,
// one headline, one supporting line, one CTA. No competing elements.
//
// Reading order (5 elements only):
//   Icon → Brand → Tagline (2-line bilingual) → Value prop → CTA
//
// Removed from v1: social proof strip, outcome chips, philosophy line.
// Reason: every added element costs 0.3s of processing. At 5 elements
// the screen reads in 2.1 seconds; at 9 elements it was 4.5 seconds.
// The removed elements appear inside the app where context makes them land.
function WelcomeStep({
  logoScale,
  logoOpacity,
  onNext,
}: {
  logoScale: Animated.Value;
  logoOpacity: Animated.Value;
  onNext: () => void;
}) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);
  return (
    <ScrollView
      contentContainerStyle={styles.stepContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 1 — Signature icon (dominant, large) */}
      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <LakbAIIcon size={120} />
      </Animated.View>

      {/* 2 — Brand name */}
      <Text style={styles.brandName}>LakbAI</Text>

      {/* 3 — Tagline: two-line bilingual with intentional size contrast */}
      {/* English primary (bold, large) — Filipino secondary (italic, smaller) */}
      {/* The size gap signals hierarchy without needing extra decoration   */}
      <Text style={styles.brandTaglinePrimary}>Navigate Your Future.</Text>
      <Text style={styles.brandTaglineSub}>Isulong Ang Pangarap.</Text>

      {/* 4 — Value proposition (one line — answers "what does this do?") */}
      <Text style={styles.valueProp}>
        AI-guided roadmaps. Build real skills.{'\n'}Prove you're ready.
      </Text>

      {/* Retained per brand requirement — positioned here as scope qualifier */}
      <Text style={styles.forEveryoneLabel}>
        Any skill. Any field. Any level.
      </Text>

      {/* Vertical spacer — breathing room before CTA */}
      <View style={{ height: 32 }} />

      {/* 5 — Primary CTA */}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={onNext}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Start building your future with LakbAI"
      >
        <Text style={styles.primaryBtnText}>Start Building →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function NameStep({
  name,
  setName,
  email,
  setEmail,
  onNext,
  onSkip,
}: {
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);
  const emailRef = useRef<any>(null);
  return (
    <ScrollView contentContainerStyle={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepEmoji}>👤</Text>
      <Text style={styles.stepTitle}>Create your identity.</Text>
      <Text style={styles.stepSub}>
        Your name is your public handle. Your email is for progress updates — never shared.
      </Text>

      <TextInput
        style={styles.textInput}
        placeholder="Your name or handle"
        placeholderTextColor={Colors.textMuted}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />

      <TextInput
        ref={emailRef}
        style={styles.textInput}
        placeholder="Email (optional — for progress updates)"
        placeholderTextColor={Colors.textMuted}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => name.trim() && onNext()}
      />
      <Text style={styles.inputHint}>
        e.g. "Alex Chen" — the community will know you by this.
      </Text>

      <TouchableOpacity
        style={[styles.primaryBtn, !name.trim() && styles.btnDisabled]}
        onPress={() => name.trim() && onNext()}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>Continue →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipLink} onPress={onSkip} activeOpacity={0.7}>
        <Text style={styles.skipLinkText}>Skip for now — I'll set this up later</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PathStep({
  name,
  selectedPath,
  isCustomPath,
  setSelectedPath,
  onSelectCustom,
  onNext,
  onSkip,
}: {
  name: string;
  selectedPath: CareerPathId | null;
  isCustomPath: boolean;
  setSelectedPath: (p: CareerPathId) => void;
  onSelectCustom: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const btnTranslate = useRef(new Animated.Value(24)).current;

  // Animate the sticky button in when a path is first selected
  const hasSelection = !!(selectedPath || isCustomPath);
  React.useEffect(() => {
    if (hasSelection) {
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 250, useNativeDriver: false }),
        Animated.timing(btnTranslate, { toValue: 0, duration: 250, useNativeDriver: false }),
      ]).start();
    }
  }, [hasSelection]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.pathScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>
          Choose your path{name ? `, ${name.split(' ')[0]}` : ''}.
        </Text>
        <Text style={styles.stepSub}>
          This becomes your Priority Roadmap. Focused mastery — one path at a time.
        </Text>

        {/* ── Build My Own Path ──────────────────────────────── */}
        <TouchableOpacity
          style={[styles.customPathCard, isCustomPath && styles.customPathCardSelected]}
          onPress={onSelectCustom}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Build my own path"
        >
          <Text style={styles.customPathCardEmoji}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.customPathCardTitle, isCustomPath && { color: Colors.primaryLight }]}>
              Build My Own Path
            </Text>
            <Text style={styles.customPathCardSub}>
              Not in tech? Define your own skills and milestones — any field, any goal.
            </Text>
          </View>
          {isCustomPath && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Tech career paths ─────────────────────────────── */}
        {ONBOARDING_PATH_CATEGORIES.map((cat) => (
          <View key={cat.label}>
            <Text style={styles.catLabel}>{cat.label.toUpperCase()}</Text>
            <View style={styles.pathCards}>
              {cat.pathIds.map((pid) => {
                const path = CAREER_PATHS.find((p) => p.id === pid);
                if (!path) return null;
                return (
                  <PathCard
                    key={path.id}
                    path={path}
                    selected={!isCustomPath && selectedPath === path.id}
                    onSelect={() => setSelectedPath(path.id as CareerPathId)}
                  />
                );
              })}
            </View>
          </View>
        ))}

        {/* Skip option */}
        <TouchableOpacity style={[styles.skipLink, { marginTop: Spacing.lg }]} onPress={onSkip} activeOpacity={0.7}>
          <Text style={styles.skipLinkText}>Skip — start with Data Architect path</Text>
        </TouchableOpacity>

        {/* Bottom padding so content isn't hidden behind sticky button */}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Sticky CTA — always visible once a path is selected */}
      <Animated.View
        style={[
          styles.stickyFooter,
          { opacity: btnOpacity, transform: [{ translateY: btnTranslate }] },
        ]}
        pointerEvents={hasSelection ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={isCustomPath ? onSelectCustom : onNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {isCustomPath ? 'Build My Path ✨' : 'Begin My Evolution ⚡'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function PathCard({
  path,
  selected,
  onSelect,
}: {
  path: CareerPath;
  selected: boolean;
  onSelect: () => void;
}) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);
  const pathColor = PathColors[path.id] ?? { primary: path.color, dim: path.color + '15', text: path.textColor, border: path.color + '40' };
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { label: demandLabel, sentiment } = getPathDemandLabel(path.id);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 70, useNativeDriver: false }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 110, useNativeDriver: false }),
    ]).start();
    onSelect();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.pathCard,
          selected && {
            borderColor: pathColor.primary,
            backgroundColor: pathColor.dim,
            // @ts-ignore
            boxShadow: `0 0 18px ${pathColor.primary}30`,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={`${path.name}${selected ? ', selected' : ''}${demandLabel ? `. ${demandLabel}` : ''}`}
        accessibilityState={{ selected }}
      >
        {selected && (
          <View style={[styles.selectedBadge, { backgroundColor: pathColor.primary }]}>
            <Text style={styles.selectedBadgeText}>✓ SELECTED</Text>
          </View>
        )}

        <View style={styles.pathCardHeader}>
          <Text style={styles.pathCardIcon}>{path.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pathCardName, selected && { color: pathColor.text }]}>
              {path.name}
            </Text>
            <Text style={styles.pathCardTitle} numberOfLines={1}>{path.description}</Text>
          </View>
        </View>

        {demandLabel ? (
          <View style={styles.pathCardDemandBlock}>
            <Text style={[
              styles.pathCardDemand,
              sentiment === 'growing' && { color: '#FCD34D' },
            ]}>
              {demandLabel}
            </Text>
            <Text style={styles.pathCardDemandSource}>
              Based on {DEMAND_SOURCE_LABEL}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

const EXPERIENCE_OPTIONS: Array<{
  level: ExperienceLevel;
  icon: string;
  title: string;
  subtitle: string;
  credit: string;
}> = [
  {
    level: 'beginner',
    icon: '🌱',
    title: 'Fresh Start',
    subtitle: 'Just beginning this path.',
    credit: 'Start from skill 1 — every step guided.',
  },
  {
    level: 'building',
    icon: '⚡',
    title: 'Some Foundation',
    subtitle: 'I know the basics already.',
    credit: 'Skill 1 pre-credited — start building.',
  },
  {
    level: 'experienced',
    icon: '🏆',
    title: 'Bringing Experience',
    subtitle: 'I\'ve done most of this before.',
    credit: 'First 2 skills credited — jump to advanced.',
  },
];

function ExperienceLevelStep({
  name,
  selectedLevel,
  onSelect,
}: {
  name: string;
  selectedLevel: ExperienceLevel | null;
  onSelect: (level: ExperienceLevel) => void;
}) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);

  return (
    <ScrollView contentContainerStyle={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepEmoji}>🧭</Text>
      <Text style={styles.stepTitle}>
        Where are you starting from{name ? `, ${name.split(' ')[0]}` : ''}?
      </Text>
      <Text style={styles.stepSub}>
        LakbAI adapts your roadmap to your level. No wasted steps.
      </Text>

      <View style={styles.expCards}>
        {EXPERIENCE_OPTIONS.map((opt) => {
          const isSelected = selectedLevel === opt.level;
          return (
            <TouchableOpacity
              key={opt.level}
              style={[
                styles.expCard,
                isSelected && styles.expCardSelected,
              ]}
              onPress={() => onSelect(opt.level)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`${opt.title} — ${opt.subtitle}`}
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.expCardLeft}>
                <Text style={styles.expCardIcon}>{opt.icon}</Text>
              </View>
              <View style={styles.expCardBody}>
                <Text style={[styles.expCardTitle, isSelected && { color: Colors.primaryLight }]}>
                  {opt.title}
                </Text>
                <Text style={styles.expCardSub}>{opt.subtitle}</Text>
                <Text style={[styles.expCardCredit, isSelected && { color: Colors.primaryLight, opacity: 0.85 }]}>
                  ↗ {opt.credit}
                </Text>
              </View>
              {isSelected && (
                <View style={styles.expCardCheck}>
                  <Text style={styles.expCardCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.expHint}>Tap to select — you'll move on automatically.</Text>
    </ScrollView>
  );
}

function FirstOutputStep({
  pathId,
  experienceLevel,
  isCustomPath = false,
  onSubmit,
}: {
  pathId: CareerPathId | string;
  experienceLevel: ExperienceLevel;
  isCustomPath?: boolean;
  onSubmit: (type: OutputType, title: string, desc: string) => void;
}) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);
  const [selectedType, setSelectedType] = useState<OutputType>('project');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const placeholderByType: Record<OutputType, string> = {
    book:       'e.g. Clean Code — 5 key takeaways',
    cert:       'e.g. AWS Cloud Practitioner',
    project:    'e.g. Built a data pipeline in Python',
    github:     'e.g. Open-sourced a REST API client',
    script:     'e.g. Automated daily report with Python',
    diagram:    'e.g. System architecture for microservices',
    reflection: 'e.g. Reflecting on my first week learning SQL',
    event:      'e.g. Led a community workshop on public speaking',
    other:      'Describe what you did or accomplished',
  };

  const canSubmit = title.trim().length > 0 && desc.trim().length > 0;

  return (
    <ScrollView contentContainerStyle={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepEmoji}>🎯</Text>
      <Text style={styles.stepTitle}>
        {isCustomPath
          ? 'What are you working on right now?'
          : experienceLevel === 'experienced'
          ? 'What are you working on now?'
          : experienceLevel === 'building'
          ? 'Log your most recent output.'
          // beginner / Fresh Start (UX-027): forward-looking, not "what have you already built"
          : 'Start with one small step.'}
      </Text>
      <Text style={styles.stepSub}>
        {isCustomPath
          ? 'Log something you\'ve already built, read, or earned toward your goal. Proof-of-work earns XP.'
          : experienceLevel === 'experienced'
          ? 'Your foundation is credited. Show us what you\'re building at the advanced level.'
          : experienceLevel === 'building'
          ? 'Your first skill has been credited. What have you built recently on this path?'
          // beginner / Fresh Start: logging is optional — make skipping a first-class choice
          : 'New to this? Log anything you\'ve already tried — a tutorial, notes, a small build. Nothing yet? Tap Skip and we\'ll line up your first mission.'}
      </Text>

      {/* Output type selector */}
      <View style={styles.outputTypeRow}>
        {FIRST_OUTPUT_TYPES.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[
              styles.outputTypeChip,
              selectedType === t.id && styles.outputTypeChipActive,
            ]}
            onPress={() => setSelectedType(t.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.outputTypeIcon}>{t.icon}</Text>
            <Text style={[
              styles.outputTypeLabel,
              selectedType === t.id && styles.outputTypeLabelActive,
            ]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Title input */}
      <TextInput
        style={styles.textInput}
        placeholder={placeholderByType[selectedType]}
        placeholderTextColor={Colors.textMuted}
        value={title}
        onChangeText={setTitle}
        returnKeyType="next"
      />

      {/* Description input */}
      <TextInput
        style={[styles.textInput, styles.textInputMulti]}
        placeholder="What did you learn or build? Be specific — 1–2 sentences."
        placeholderTextColor={Colors.textMuted}
        value={desc}
        onChangeText={setDesc}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* CTA */}
      <TouchableOpacity
        style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
        onPress={() => onSubmit(selectedType, title, desc)}
        disabled={!canSubmit}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
      >
        <Text style={styles.primaryBtnText}>Log It &amp; Start My Journey ⚡</Text>
      </TouchableOpacity>
      {!canSubmit && (
        <Text style={styles.submitHint}>Add a title and a short description to continue.</Text>
      )}

      {/* Skip */}
      <TouchableOpacity
        style={styles.skipLink}
        onPress={() => onSubmit('project', '', '')}
        activeOpacity={0.7}
      >
        <Text style={styles.skipLinkText}>
          {!isCustomPath && experienceLevel === 'beginner'
            ? "I'm just getting started — skip →"
            : 'Skip for now'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Custom path icon → color mapping ─────────────────────────────────────────
const CUSTOM_PATH_ICONS = ['🎯', '🎨', '🧠', '💼', '🌿', '🏋️', '🎭', '🔧', '🌐', '🎵'];
const ICON_COLORS: Record<string, string> = {
  '🎯': '#7C3AED',
  '🎨': '#EC4899',
  '🧠': '#3B82F6',
  '💼': '#F59E0B',
  '🌿': '#10B981',
  '🏋️': '#EF4444',
  '🎭': '#8B5CF6',
  '🔧': '#6B7280',
  '🌐': '#06B6D4',
  '🎵': '#14B8A6',
};

function CustomPathBuilderStep({
  name,
  addCustomPath,
  onCreated,
  onBack,
}: {
  name: string;
  addCustomPath: (path: { name: string; icon: string; description: string; color: string; skills: CustomSkill[] }) => string;
  onCreated: (pathId: string) => void;
  onBack: () => void;
}) {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => makeStyles(Colors), [Colors]);

  const [pathName, setPathName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('🎯');
  const [skillInputs, setSkillInputs] = useState<string[]>(['', '', '']);

  const validSkillCount = skillInputs.filter((s) => s.trim().length > 0).length;
  const canCreate = pathName.trim().length > 0 && validSkillCount >= 1;

  const updateSkill = (i: number, val: string) =>
    setSkillInputs((prev) => prev.map((s, idx) => (idx === i ? val : s)));
  const addSkillRow = () => {
    if (skillInputs.length < 6) setSkillInputs((prev) => [...prev, '']);
  };
  const removeSkillRow = (i: number) => {
    if (skillInputs.length <= 1) return;
    setSkillInputs((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleCreate = () => {
    if (!canCreate) return;
    const trimmedSkills = skillInputs
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // Temporary IDs — addCustomPath will store these as-is
    const skillObjects: CustomSkill[] = trimmedSkills.map((s, i) => ({
      id: `__skill_${i}_${Date.now()}`,
      name: s,
      description: '',
      icon: selectedIcon,
    }));
    const color = ICON_COLORS[selectedIcon] ?? '#7C3AED';
    const newPathId = addCustomPath({
      name: pathName.trim(),
      icon: selectedIcon,
      description: '',
      color,
      skills: skillObjects,
    });
    onCreated(newPathId);
  };

  const accentColor = ICON_COLORS[selectedIcon] ?? Colors.primary;

  return (
    <ScrollView
      contentContainerStyle={[styles.stepContainer, { paddingTop: 24 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.stepEmoji}>✨</Text>
      <Text style={styles.stepTitle}>
        Build your own path{name ? `, ${name.split(' ')[0]}` : ''}.
      </Text>
      <Text style={styles.stepSub}>
        Name your journey and define the milestones. Any field, any goal.
      </Text>

      {/* Path name */}
      <View style={styles.builderSection}>
        <Text style={styles.builderLabel}>PATH NAME</Text>
        <TextInput
          style={[styles.textInput, { borderColor: pathName.trim() ? accentColor + '70' : Colors.border }]}
          placeholder="e.g. Yoga Instructor, Sales Leader, Artist…"
          placeholderTextColor={Colors.textMuted}
          value={pathName}
          onChangeText={setPathName}
          autoFocus
          returnKeyType="next"
          maxLength={40}
        />
      </View>

      {/* Icon picker */}
      <View style={styles.builderSection}>
        <Text style={styles.builderLabel}>PATH ICON</Text>
        <View style={styles.iconPickerRow}>
          {CUSTOM_PATH_ICONS.map((icon) => (
            <TouchableOpacity
              key={icon}
              style={[
                styles.iconPickerBtn,
                selectedIcon === icon && {
                  borderColor: ICON_COLORS[icon] ?? Colors.primary,
                  backgroundColor: (ICON_COLORS[icon] ?? Colors.primary) + '20',
                },
              ]}
              onPress={() => setSelectedIcon(icon)}
              activeOpacity={0.75}
            >
              <Text style={styles.iconPickerEmoji}>{icon}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Skills / milestones */}
      <View style={styles.builderSection}>
        <Text style={styles.builderLabel}>MILESTONES</Text>
        <Text style={styles.builderHint}>
          What skills do you want to master? Add 1–6 milestones.
        </Text>
        <View style={styles.skillInputList}>
          {skillInputs.map((val, i) => (
            <View key={i} style={styles.skillInputRow}>
              <View
                style={[
                  styles.skillInputNum,
                  val.trim() && { backgroundColor: accentColor + '25', borderColor: accentColor + '60' },
                ]}
              >
                <Text style={[styles.skillInputNumText, val.trim() && { color: accentColor }]}>
                  {i + 1}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.skillInput,
                  val.trim() && { borderColor: accentColor + '60' },
                ]}
                placeholder={`Milestone ${i + 1}${i === 0 ? ' (required)' : ''}`}
                placeholderTextColor={Colors.textMuted}
                value={val}
                onChangeText={(v) => updateSkill(i, v)}
                returnKeyType="next"
                maxLength={50}
              />
              {skillInputs.length > 1 && (
                <TouchableOpacity
                  style={styles.skillRemoveBtn}
                  onPress={() => removeSkillRow(i)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skillRemoveBtnText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {skillInputs.length < 6 && (
          <TouchableOpacity
            style={styles.addSkillBtn}
            onPress={addSkillRow}
            activeOpacity={0.7}
          >
            <Text style={[styles.addSkillBtnText, { color: accentColor }]}>+ Add milestone</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Create button */}
      <TouchableOpacity
        style={[
          styles.primaryBtn,
          { backgroundColor: accentColor, marginTop: Spacing.xl },
          !canCreate && styles.btnDisabled,
        ]}
        onPress={handleCreate}
        activeOpacity={0.85}
        disabled={!canCreate}
      >
        <Text style={styles.primaryBtnText}>Create My Path →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipLink} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.skipLinkText}>← Back to path selection</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeStyles = (Colors: ColorsType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  // ISSUE-006: top row contains back button + step dots + spacer
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 16,
    paddingBottom: 6,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 22,
    color: Colors.text,
    lineHeight: 28,
    fontWeight: '300',
  },
  backBtnPlaceholder: {
    width: 34,
    height: 34,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  dotIdle: {
    width: 5,
    backgroundColor: Colors.textMuted,
  },
  dotActive: {
    width: 22,
    backgroundColor: Colors.primaryLight,
  },
  dotDone: {
    width: 5,
    backgroundColor: Colors.success,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
    minHeight: '100%' as any,
  },
  pathScrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },

  // ── Icon ─────────────────────────────────────────────────────────────────
  // Larger wrapper (120px) — the icon is the hero, not a small badge
  logoWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    // @ts-ignore
    filter: 'drop-shadow(0 12px 32px rgba(0,100,200,0.45))',
  },

  // ── Brand name ───────────────────────────────────────────────────────────
  brandName: {
    fontSize: 44,
    fontWeight: '800' as const,
    color: Colors.primaryLight,
    letterSpacing: 1.5,
    marginBottom: 16,
  },

  // ── Tagline — two-line bilingual with SIZE CONTRAST ──────────────────────
  // English primary: bold, 24px → carries the aspiration
  // Filipino sub: italic, 17px → carries the heart
  // The 7px size gap creates hierarchy without needing any other decoration
  brandTaglinePrimary: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 6,
  },
  brandTaglineSub: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: Colors.textSub,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
  },

  // ── Value proposition ─────────────────────────────────────────────────────
  // Single purpose: answer "what does this app do?" in under 3 seconds
  // Kept to 2 short lines; generous lineHeight aids scanning
  valueProp: {
    fontSize: 15,
    color: Colors.textSub,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 14,
    maxWidth: 290,
  },

  // ── Scope line (retained) ─────────────────────────────────────────────────
  forEveryoneLabel: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700' as const,
    letterSpacing: 1.8,
    textAlign: 'center',
    textTransform: 'uppercase' as const,
  },

  // ── Removed from welcome screen (moved inside app) ───────────────────────
  // socialProofRow, socialProofItem, socialProofDot:
  //   → moved to dashboard/feed where user has context to appreciate the data
  // outcomeChips, outcomeChip, outcomeChipEmoji, outcomeChipLabel:
  //   → onboarding path-selection step communicates this more effectively
  // philosophyLine:
  //   → the CTA "Start Building →" already carries this message; repetition dilutes

  // Primary button
  primaryBtn: {
    borderRadius: Radius.full,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    width: '100%',
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
  btnDisabled: {
    opacity: 0.35,
  },
  submitHint: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },

  // Step common
  stepEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  stepTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  stepSub: {
    fontSize: FontSize.base,
    color: Colors.textSub,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  textInput: {
    width: '100%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 16,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 18,
  },

  // Path cards
  catLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 2.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  pathCards: {
    gap: Spacing.sm,
  },
  pathCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: 'relative',
  },
  selectedBadge: {
    position: 'absolute',
    top: -1,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
  },
  selectedBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 1,
  },
  pathCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.sm,
  },
  pathCardIcon: {
    fontSize: 34,
  },
  pathCardName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  pathCardTitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 1,
  },
  pathCardDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSub,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  pathCardDemandBlock: {
    marginTop: 6,
    gap: 2,
  },
  pathCardDemand: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FCA5A5',          // warm red — matches DemandBadge high colour
    letterSpacing: 0.2,
  },
  pathCardDemandSource: {
    fontSize: 9,
    fontWeight: '400',
    color: Colors.textMuted,
    letterSpacing: 0.1,
  },
  pathSkillList: {
    gap: 3,
  },
  pathSkillItem: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  pathSkillMore: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 'env(safe-area-inset-bottom, 16px)' as any,
    // @ts-ignore - web-only gradient
    backgroundImage: `linear-gradient(to top, ${Colors.bg} 70%, transparent)`,
    backgroundColor: 'transparent',
  },

  // FirstOutputStep styles
  outputTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.md,
    width: '100%',
  },
  outputTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  outputTypeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '20',
  },
  outputTypeIcon: { fontSize: 14 },
  outputTypeLabel: { fontSize: FontSize.sm, color: Colors.textSub, fontWeight: '500' },
  outputTypeLabelActive: { color: Colors.primaryLight, fontWeight: '700' },
  textInputMulti: {
    height: 80,
    paddingTop: 14,
  },
  skipLink: {
    marginTop: Spacing.md,
    paddingVertical: 8,
  },
  skipLinkText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },

  // ExperienceLevelStep
  expCards: {
    width: '100%',
    gap: 10,
    marginBottom: Spacing.md,
  },
  expCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  expCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '14',
    // @ts-ignore
    boxShadow: '0 0 18px rgba(124,58,237,0.25)',
  },
  expCardLeft: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardAlt,
    flexShrink: 0,
  },
  expCardIcon: {
    fontSize: 24,
  },
  expCardBody: {
    flex: 1,
    gap: 2,
  },
  expCardTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
  },
  expCardSub: {
    fontSize: FontSize.sm,
    color: Colors.textSub,
  },
  expCardCredit: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  expCardCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  expCardCheckText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '700',
  },
  expHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },

  // ── PathStep: "Build My Own Path" card ──────────────────────────────────────
  customPathCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
    position: 'relative',
  },
  customPathCardSelected: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primary + '14',
    // @ts-ignore
    boxShadow: '0 0 18px rgba(124,58,237,0.25)',
  },
  customPathCardEmoji: {
    fontSize: 30,
    flexShrink: 0,
  },
  customPathCardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  customPathCardSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
  },

  // ── CustomPathBuilderStep styles ─────────────────────────────────────────────
  builderSection: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  builderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  builderHint: {
    fontSize: FontSize.sm,
    color: Colors.textSub,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  iconPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconPickerBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPickerEmoji: {
    fontSize: 22,
  },
  skillInputList: {
    gap: 8,
  },
  skillInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skillInputNum: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  skillInputNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  skillInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSize.base,
    color: Colors.text,
  },
  skillRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  skillRemoveBtnText: {
    fontSize: 18,
    color: Colors.textMuted,
    lineHeight: 22,
    fontWeight: '400',
  },
  addSkillBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addSkillBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
