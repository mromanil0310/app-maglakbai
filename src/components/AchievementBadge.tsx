import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Achievement } from '../types';
import { Colors, ColorsType, useThemeColors, Radius, FontSize, RarityColors } from '../utils/theme';

interface AchievementBadgeProps {
  achievement: Achievement;
  unlocked: boolean;
  /** ISSUE-008: pass progress for locked achievements to show a mini progress bar */
  progress?: { current: number; required: number };
}

export default function AchievementBadge({ achievement, unlocked, progress }: AchievementBadgeProps) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);
  const rarity = RarityColors[achievement.rarity];
  const scaleAnim = useRef(new Animated.Value(unlocked ? 0.8 : 1)).current;

  const hasProgress = !unlocked && progress != null && progress.required > 0;
  const progressPct = hasProgress ? Math.min(100, Math.round((progress!.current / progress!.required) * 100)) : 0;

  useEffect(() => {
    if (unlocked) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: false,
      }).start();
    }
  }, [unlocked]);

  return (
    <Animated.View
      style={[
        styles.badge,
        unlocked
          ? { borderColor: rarity.color + '60', backgroundColor: Colors.surface }
          : hasProgress
          ? styles.badgeLockedProgress   // slightly more visible when showing progress
          : styles.badgeLocked,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Text style={[styles.icon, !unlocked && styles.iconLocked]}>
        {unlocked ? achievement.icon : '🔒'}
      </Text>
      <Text
        style={[styles.title, unlocked ? { color: Colors.text } : styles.titleLocked]}
        numberOfLines={1}
      >
        {achievement.title}
      </Text>
      {unlocked && (
        <View style={[styles.rarityPip, { backgroundColor: rarity.color }]} />
      )}
      {/* ISSUE-008: mini progress bar for locked achievements */}
      {hasProgress && (
        <>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPct}%` as any,
                  backgroundColor: progressPct > 0 ? rarity.color : Colors.textMuted,
                },
              ]}
            />
          </View>
          <Text style={styles.progressCount}>
            {progress!.current}/{progress!.required}
          </Text>
        </>
      )}
    </Animated.View>
  );
}

const makeStyles = (Colors: ColorsType) => StyleSheet.create({
  badge: {
    width: 88,
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeLocked: {
    opacity: 0.4,
    borderColor: Colors.border,
  },
  // ISSUE-008: slightly more visible when showing progress data
  badgeLockedProgress: {
    opacity: 0.75,
    borderColor: Colors.border,
  },
  icon: {
    fontSize: 28,
  },
  iconLocked: {
    opacity: 0.5,
  },
  title: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.textSub,
  },
  titleLocked: {
    color: Colors.textMuted,
  },
  rarityPip: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
  // ISSUE-008: progress bar for locked achievements
  progressBarBg: {
    width: '100%',
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginTop: 1,
  },
  progressBarFill: {
    height: 3,
    borderRadius: 1.5,
  },
  progressCount: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
});
