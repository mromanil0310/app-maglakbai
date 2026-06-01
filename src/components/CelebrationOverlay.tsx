/**
 * CelebrationOverlay — milestone animation shown on Home screen mount.
 *
 * Design based on HCI/UX research findings:
 *  • Lead with confetti particles (instant dopamine), characters follow 300 ms later
 *    (social-presence / belonging effect from animated mascot research, MDPI 2024)
 *  • Scale intensity proportionally: 25 % = light sparkle, 50 % = couple, 75 % = group,
 *    100 % = golden trophy ceremony (5 s hold — the only milestone that earns a "ceremony")
 *  • Play once, land on calm state — no infinite loops waiting for dismissal
 *    (UX Collective: looping celebrations become obstacles, not rewards)
 *  • Total animation: 200–500 ms trigger burst → 2–5 s hold → 500 ms fade out
 *  • 0 % = "call to adventure": rising stars + rocket launch. Research on "fresh start effect"
 *    (Dai et al., 2014) shows framing the beginning as a launch moment boosts initiation rates.
 *    Forward-motion visuals (upward particles, rocket) signal possibility, not achievement.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Colors, ColorsType, useThemeColors, FontSize, Radius } from '../utils/theme';

// ─── CSS keyframes (injected once into <head>) ────────────────────────────────

let _cssReady = false;
function ensureCSS() {
  if (_cssReady || typeof document === 'undefined') return;
  _cssReady = true;
  const el = document.createElement('style');
  el.textContent = `
    @keyframes confFall {
      0%   { transform: translateY(-30px) rotate(0deg) scaleX(1);   opacity: 1; }
      80%  { opacity: 1; }
      100% { transform: translateY(108vh) rotate(600deg) scaleX(0.7); opacity: 0; }
    }
    @keyframes riseStar {
      0%   { transform: translateY(0) scale(0) rotate(0deg);   opacity: 0; }
      15%  { opacity: 1; }
      100% { transform: translateY(-85vh) scale(1.4) rotate(180deg); opacity: 0; }
    }
    @keyframes rocketLaunch {
      0%   { transform: translateY(30px) scale(0.4) rotate(-8deg); opacity: 0; }
      18%  { transform: translateY(-6px)  scale(1.25) rotate(4deg);  opacity: 1; }
      36%  { transform: translateY(-46px) scale(1.1) rotate(-3deg); }
      52%  { transform: translateY(-30px) scale(1.15) rotate(2deg); }
      68%  { transform: translateY(-44px) scale(1.1) rotate(-1deg); }
      84%  { transform: translateY(-34px) scale(1.12) rotate(1deg); }
      100% { transform: translateY(-40px) scale(1.1) rotate(0deg);  opacity: 1; }
    }
    @keyframes rocketHover {
      0%,100% { transform: translateY(-40px) scale(1.1) rotate(-2deg); }
      50%     { transform: translateY(-54px) scale(1.12) rotate(2deg); }
    }
    @keyframes thrusterFlicker {
      0%,100% { opacity: 0.6; transform: scaleY(1); }
      50%     { opacity: 1;   transform: scaleY(1.3); }
    }
    @keyframes bounceIn {
      0%   { transform: scale(0) translateY(24px); opacity: 0; }
      55%  { transform: scale(1.28) translateY(-10px); opacity: 1; }
      78%  { transform: scale(0.93) translateY(4px); }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes dance {
      0%,100% { transform: scale(1)    translateY(0)   rotate(-5deg); }
      28%     { transform: scale(1.08) translateY(-15px) rotate(6deg); }
      58%     { transform: scale(1.04) translateY(-9px)  rotate(-2deg); }
    }
    @keyframes trophyFloat {
      0%,100% { transform: scale(1)    translateY(0); }
      50%     { transform: scale(1.10) translateY(-12px); }
    }
    @keyframes goldenGlow {
      0%,100% { text-shadow: 0 0 12px #F59E0B, 0 0 30px #F59E0B80; }
      50%     { text-shadow: 0 0 28px #FCD34D, 0 0 60px #F59E0BCC, 0 0 90px #F59E0B60; }
    }
    @keyframes sparkleShimmer {
      0%,100% { opacity: 0.5; transform: scale(0.85); }
      50%     { opacity: 1;   transform: scale(1.15); }
    }
    @keyframes popIn {
      0%   { transform: scale(0.55) translateY(12px); opacity: 0; }
      68%  { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1)    translateY(0); opacity: 1; }
    }
    @keyframes pulse {
      0%,100% { opacity: 0.45; }
      50%     { opacity: 1; }
    }
    @keyframes fireworkStar {
      0%   { transform: translate(0,0) scale(1.2); opacity: 1; }
      100% { transform: translate(var(--ex), var(--ey)) scale(0); opacity: 0; }
    }
  `;
  document.head.appendChild(el);
}

// ─── Tier config ──────────────────────────────────────────────────────────────

interface TierConfig {
  figures: string[];
  extra: string[];        // sparkle / firework emojis shown below figures
  label: string;
  sublabel: string;
  cta?: string;           // optional call-to-action line (used at 0%)
  confettiColors: string[];
  confettiCount: number;
  duration: number;       // ms before auto-dismiss
  accentColor: string;
  isTrophy: boolean;
  isLaunch: boolean;      // 0% — uses rising particles + rocket animation
}

function getTier(pct: number): TierConfig | null {
  if (pct === 0) return {
    figures: ['🚀'],
    extra: ['⭐', '✨', '🌟', '✨', '⭐'],
    label: 'Your Journey Starts Now',
    sublabel: 'Every expert was once a beginner.',
    cta: 'Log your first output to launch →',
    confettiColors: ['#7C3AED', '#A855F7', '#C4B5FD', '#4F46E5', '#818CF8', '#E9D5FF', '#ffffff'],
    confettiCount: 22,
    duration: 5000,
    accentColor: '#A855F7',
    isTrophy: false,
    isLaunch: true,
  };
  if (pct >= 100) return {
    figures: ['🏆'],
    extra: ['🎆', '✨', '🎇', '✨', '🎆'],
    label: 'PATH COMPLETE!',
    sublabel: "You've mastered this entire path. Legendary.",
    confettiColors: ['#F59E0B','#FCD34D','#FBBF24','#FDE68A','#F97316','#EF4444','#ffffff'],
    confettiCount: 55,
    duration: 5000,
    accentColor: '#F59E0B',
    isTrophy: true,
    isLaunch: false,
  };
  if (pct >= 75) return {
    figures: ['🕺','💃','🕺','💃'],
    extra: [],
    label: 'Almost There! Keep Going!',
    sublabel: '75% Evolution Complete',
    confettiColors: ['#10B981','#6EE7B7','#A855F7','#F59E0B','#06B6D4','#EF4444','#FCD34D'],
    confettiCount: 40,
    duration: 5000,
    accentColor: '#10B981',
    isTrophy: false,
    isLaunch: false,
  };
  if (pct >= 50) return {
    figures: ['🕺','💃'],
    extra: [],
    label: "Halfway There!",
    sublabel: '50% Evolution Complete',
    confettiColors: ['#06B6D4','#67E8F9','#A855F7','#FCD34D','#10B981','#F9A8D4'],
    confettiCount: 28,
    duration: 5000,
    accentColor: '#06B6D4',
    isTrophy: false,
    isLaunch: false,
  };
  if (pct >= 25) return {
    figures: ['🕺'],
    extra: [],
    label: "You're On Your Way!",
    sublabel: '25% Evolution Complete',
    confettiColors: ['#A855F7','#7C3AED','#C4B5FD','#818CF8','#E9D5FF','#ffffff'],
    confettiCount: 18,
    duration: 5000,
    accentColor: '#A855F7',
    isTrophy: false,
    isLaunch: false,
  };
  return null;
}

// ─── Confetti data generator ──────────────────────────────────────────────────

interface ConfettiPiece {
  id: number;
  x: number;        // % from left
  color: string;
  size: number;
  isRound: boolean;
  delay: number;    // ms stagger
  dur: number;      // ms fall duration
}

function makeConfetti(count: number, colors: string[]): ConfettiPiece[] {
  // Use a seeded approach so the layout is deterministic per session
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (i / count) * 96 + Math.sin(i * 2.3) * 8 + 2,
    color: colors[i % colors.length],
    size: 7 + (i % 5) * 2,
    isRound: i % 3 === 0,
    delay: (i * 37) % 900,
    dur: 1600 + (i * 53) % 1300,
  }));
}

// ─── Firework spark data (for 75 % + 100 %) ──────────────────────────────────

interface SparkData {
  id: number;
  angle: number;    // degrees
  dist: number;     // px end distance
  color: string;
  delay: number;
  size: number;
}

function makeSparks(count: number, colors: string[]): SparkData[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 360;
    return {
      id: i,
      angle,
      dist: 70 + (i % 4) * 25,
      color: colors[i % colors.length],
      delay: 400 + (i * 29) % 500,
      size: 5 + (i % 3) * 3,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  pct: number;
  onDismiss: () => void;
}

export default function CelebrationOverlay({ pct, onDismiss }: Props) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);
  const tier = useMemo(() => getTier(pct), [pct]);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [alive, setAlive] = useState(true);

  const dismiss = () => {
    Animated.timing(overlayOpacity, {
      toValue: 0, duration: 500, useNativeDriver: false,
    }).start(() => { setAlive(false); onDismiss(); });
  };

  useEffect(() => {
    if (!tier) return;
    ensureCSS();

    // Fade in fast — confetti leads visually
    Animated.timing(overlayOpacity, {
      toValue: 1, duration: 280, useNativeDriver: false,
    }).start();

    const t = setTimeout(dismiss, tier.duration);
    return () => clearTimeout(t);
  }, []);

  if (!tier || !alive) return null;

  const confetti = useMemo(() => makeConfetti(tier.confettiCount, tier.confettiColors), []);
  const sparks   = useMemo(
    () => (pct >= 75 ? makeSparks(24, tier.confettiColors) : []),
    [],
  );

  // 0% launch: particles rise from bottom; >0%: particles fall from top
  const particleAnim = (p: ConfettiPiece) => tier.isLaunch
    ? `riseStar ${p.dur}ms ${p.delay}ms ease-out both`
    : `confFall ${p.dur}ms ${p.delay}ms ease-in both`;

  const FIG_DELAY = 300;   // characters appear 300 ms after confetti (research: particles first)
  const LBL_DELAY = tier.isLaunch
    ? FIG_DELAY + 900   // rocket launch sequence is slower
    : FIG_DELAY + (tier.isTrophy ? 800 : tier.figures.length * 130 + 600);

  return (
    <Modal transparent visible={alive} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>

        {/* ── Tap anywhere to dismiss ── */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />

        {/* ── Particles: fall from top (celebration) or rise from bottom (launch) ── */}
        {confetti.map(p => (
          <View
            key={p.id}
            style={[
              styles.confettiBase,
              {
                left: `${p.x}%` as any,
                // launch: start near bottom; celebrate: start above top
                [tier.isLaunch ? 'bottom' : 'top']: tier.isLaunch ? -20 : -30,
                width: p.size,
                height: p.isRound ? p.size : Math.round(p.size * 0.42),
                borderRadius: p.isRound ? p.size / 2 : 2,
                backgroundColor: p.color,
                // @ts-ignore
                animation: particleAnim(p),
              } as any,
            ]}
          />
        ))}

        {/* ── Firework sparks burst from centre (75 %+) ── */}
        {sparks.map(s => {
          const rad = (s.angle * Math.PI) / 180;
          const ex = Math.round(Math.cos(rad) * s.dist);
          const ey = Math.round(Math.sin(rad) * s.dist);
          return (
            <View
              key={`sp_${s.id}`}
              style={[
                styles.sparkBase,
                {
                  width: s.size,
                  height: s.size,
                  borderRadius: s.size / 2,
                  backgroundColor: s.color,
                  left: '50%' as any,
                  top: '42%'  as any,
                  // @ts-ignore
                  '--ex': `${ex}px`,
                  '--ey': `${ey}px`,
                  animation: `fireworkStar 1s ${s.delay}ms ease-out both`,
                } as any,
              ]}
            />
          );
        })}

        {/* ── Centre card (characters follow particles) ── */}
        <View style={styles.card} pointerEvents="none">

          {/* Figures / Trophy / Rocket */}
          <View style={styles.figRow}>
            {tier.figures.map((fig, i) => (
              <View
                key={i}
                style={{
                  // @ts-ignore
                  animation: tier.isLaunch
                    ? `rocketLaunch 1.1s ${FIG_DELAY}ms cubic-bezier(0.22,0.61,0.36,1) both, rocketHover 1.8s ${FIG_DELAY + 1150}ms ease-in-out infinite`
                    : tier.isTrophy
                      ? `bounceIn 0.8s ${FIG_DELAY}ms ease-out both, trophyFloat 1.6s ${FIG_DELAY + 900}ms ease-in-out infinite, goldenGlow 1.6s ${FIG_DELAY + 900}ms ease-in-out infinite`
                      : `bounceIn 0.7s ${FIG_DELAY + i * 130}ms ease-out both, dance 0.8s ${FIG_DELAY + i * 130 + 750}ms ease-in-out infinite`,
                } as any}
              >
                <Text style={tier.isLaunch ? styles.rocketEmoji : tier.isTrophy ? styles.trophyEmoji : styles.figEmoji}>{fig}</Text>
              </View>
            ))}
          </View>

          {/* Thruster flame (launch only) */}
          {tier.isLaunch && (
            <View style={{
              // @ts-ignore
              animation: `thrusterFlicker 0.25s ${FIG_DELAY + 600}ms ease-in-out infinite`,
              marginTop: -8,
            } as any}>
              <Text style={styles.thrusterEmoji}>🔥</Text>
            </View>
          )}

          {/* Sparkle / firework emojis (100 % only) */}
          {tier.extra.length > 0 && (
            <View style={styles.extraRow}>
              {tier.extra.map((e, i) => (
                <View
                  key={i}
                  style={{
                    // @ts-ignore
                    animation: `bounceIn 0.55s ${FIG_DELAY + 500 + i * 90}ms ease-out both, sparkleShimmer 1.3s ${FIG_DELAY + 1100 + i * 90}ms ease-in-out infinite`,
                  } as any}
                >
                  <Text style={styles.extraEmoji}>{e}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Milestone label */}
          <View style={{
            // @ts-ignore
            animation: `popIn 0.55s ${LBL_DELAY}ms ease-out both`,
          } as any}>
            <Text style={[styles.label, { color: tier.accentColor }]}>{tier.label}</Text>
          </View>

          <View style={{
            // @ts-ignore
            animation: `popIn 0.5s ${LBL_DELAY + 130}ms ease-out both`,
          } as any}>
            <Text style={styles.sublabel}>{tier.sublabel}</Text>
          </View>

          {/* CTA line (launch only) */}
          {tier.cta && (
            <View style={{
              // @ts-ignore
              animation: `popIn 0.5s ${LBL_DELAY + 280}ms ease-out both, pulse 1.8s ${LBL_DELAY + 900}ms ease-in-out infinite`,
              marginTop: 4,
            } as any}>
              <Text style={[styles.ctaLine, { color: tier.accentColor }]}>{tier.cta}</Text>
            </View>
          )}

          {/* Tap hint */}
          <View style={{
            // @ts-ignore
            animation: `popIn 0.4s ${LBL_DELAY + 350}ms ease-out both, pulse 2.2s ${LBL_DELAY + 900}ms ease-in-out infinite`,
          } as any}>
            <Text style={styles.tapHint}>Tap anywhere to continue</Text>
          </View>
        </View>

      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (Colors: ColorsType) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4,4,14,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  confettiBase: {
    position: 'absolute',
    top: -30,
    opacity: 0,
  },

  sparkBase: {
    position: 'absolute',
    opacity: 0,
  },

  card: {
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingVertical: 30,
    backgroundColor: 'rgba(14,14,26,0.78)',
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    // @ts-ignore
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    maxWidth: 340,
    gap: 6,
  },

  figRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 4,
  },

  figEmoji: {
    fontSize: 68,
    lineHeight: 76,
  },

  trophyEmoji: {
    fontSize: 96,
    lineHeight: 110,
  },

  rocketEmoji: {
    fontSize: 80,
    lineHeight: 90,
  },

  thrusterEmoji: {
    fontSize: 32,
    textAlign: 'center',
  },

  ctaLine: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    textAlign: 'center',
  },

  extraRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 6,
  },

  extraEmoji: {
    fontSize: 26,
  },

  label: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    textAlign: 'center',
  },

  sublabel: {
    fontSize: FontSize.sm,
    color: Colors.textSub,
    textAlign: 'center',
    fontWeight: '600',
  },

  tapHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 10,
    textAlign: 'center',
  },
});
