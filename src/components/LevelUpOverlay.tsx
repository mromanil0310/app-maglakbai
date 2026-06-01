import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Colors, ColorsType, useThemeColors, FontSize, Radius, getLevelTitle } from '../utils/theme';

interface LevelUpOverlayProps {
  newLevel: number;
  xpGained: number;
  onDismiss: () => void;
}

let _lvlCSS = false;
function ensureLevelUpCSS() {
  if (_lvlCSS || typeof document === 'undefined') return;
  _lvlCSS = true;
  const el = document.createElement('style');
  el.textContent = `
    @keyframes lvlPulse {
      0%   { box-shadow: 0 0 0 0 rgba(245,158,11,0.6); }
      70%  { box-shadow: 0 0 0 24px rgba(245,158,11,0); }
      100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
    }
    @keyframes lvlStar {
      0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
      60%  { transform: scale(1.15) rotate(6deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes lvlParticle {
      0%   { transform: translateY(0) scale(1); opacity: 1; }
      100% { transform: translateY(-60px) scale(0); opacity: 0; }
    }
  `;
  document.head.appendChild(el);
}

export default function LevelUpOverlay({ newLevel, xpGained, onDismiss }: LevelUpOverlayProps) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.65)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const shineAnim = useRef(new Animated.Value(0)).current;
  const levelNumScale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    ensureLevelUpCSS();

    // Entrance sequence
    Animated.parallel([
      Animated.timing(bgOpacity, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.spring(cardScale, { toValue: 1, tension: 60, friction: 9, useNativeDriver: false }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 220, useNativeDriver: false }),
    ]).start(() => {
      // Level number pops in slightly after card
      Animated.spring(levelNumScale, { toValue: 1, tension: 50, friction: 6, useNativeDriver: false }).start();
      // Shine loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(shineAnim, { toValue: 1, duration: 1400, useNativeDriver: false }),
          Animated.timing(shineAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
        ])
      ).start();
    });

    // Auto-dismiss after 3s
    const timer = setTimeout(handleDismiss, 3000);
    return () => clearTimeout(timer);
  }, []);

  function handleDismiss() {
    Animated.parallel([
      Animated.timing(bgOpacity, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(cardScale, { toValue: 0.85, duration: 240, useNativeDriver: false }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start(onDismiss);
  }

  const title = getLevelTitle(newLevel);
  const glowOpacity = shineAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });

  return (
    <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]} pointerEvents="box-only">
      <TouchableOpacity style={styles.backdropTouch} onPress={handleDismiss} activeOpacity={1}>
        <Animated.View style={[styles.card, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>

          {/* Glow ring behind badge */}
          <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />

          {/* LEVEL UP label */}
          <View style={styles.levelUpBanner}>
            <Text style={styles.levelUpBannerText}>LEVEL UP</Text>
          </View>

          {/* Level number */}
          <Animated.Text style={[styles.levelNum, { transform: [{ scale: levelNumScale }] }]}>
            {newLevel}
          </Animated.Text>

          {/* New title */}
          <Text style={styles.titleText}>{title}</Text>
          <Text style={styles.subtitleText}>You've reached a new rank</Text>

          {/* XP earned */}
          <View style={styles.xpRow}>
            <Text style={styles.xpIcon}>⚡</Text>
            <Text style={styles.xpText}>+{xpGained} XP earned this session</Text>
          </View>

          {/* Tap hint */}
          <Text style={styles.tapHint}>Tap anywhere to continue</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (Colors: ColorsType) => StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // @ts-ignore
    background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.12) 0%, rgba(8,8,16,0.94) 70%)',
    backgroundColor: 'rgba(8,8,16,0.92)',
    zIndex: 9998,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropTouch: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 300,
    borderRadius: Radius.xxl,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    // @ts-ignore
    background: 'linear-gradient(160deg, #1A140A, #110D06)',
    backgroundColor: '#1A140A',
    borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.45)',
    // @ts-ignore
    boxShadow: '0 0 60px rgba(245,158,11,0.25), 0 20px 60px rgba(0,0,0,0.7)',
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    // @ts-ignore
    background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
  },
  levelUpBanner: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    marginBottom: 4,
  },
  levelUpBannerText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.gold,
    letterSpacing: 4,
  },
  levelNum: {
    fontSize: 88,
    fontWeight: '900',
    color: Colors.gold,
    lineHeight: 96,
    // @ts-ignore
    textShadow: '0 0 30px rgba(245,158,11,0.7)',
  },
  titleText: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitleText: {
    fontSize: FontSize.sm,
    color: Colors.textSub,
    textAlign: 'center',
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  xpIcon: {
    fontSize: 16,
  },
  xpText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gold,
  },
  tapHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 16,
  },
});
