import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, ColorsType, useThemeColors, Radius, FontSize, getLevelBounds, getLevelTitle } from '../utils/theme';

interface XPBarProps {
  xp: number;
  level: number;
  showDetails?: boolean;
}

export default function XPBar({ xp, level, showDetails = false }: XPBarProps) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);
  const { min, max } = getLevelBounds(level);
  const progressInLevel = xp - min;
  const rangeInLevel = max - min;
  const pct = Math.min(1, Math.max(0, progressInLevel / rangeInLevel));

  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 900,
      delay: 200,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  if (showDetails) {
    return (
      <View style={styles.container}>
        <View style={styles.detailsRow}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelLabel}>LV</Text>
            <Text style={styles.levelValue}>{level}</Text>
          </View>
          <Text style={styles.levelTitle}>{getLevelTitle(level)}</Text>
          <Text style={styles.xpText}>
            {xp.toLocaleString()} XP total
          </Text>
        </View>

        <View style={styles.barBg}>
          <Animated.View
            style={[
              styles.barFill,
              {
                width: widthAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.nextLevelText}>
          {(rangeInLevel - progressInLevel).toLocaleString()} XP to reach {getLevelTitle(level + 1)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inlineRow}>
        <Text style={styles.inlineLvl}>Lv.{level} · {getLevelTitle(level)}</Text>
        <Text style={styles.inlineXP}>
          {progressInLevel} / {rangeInLevel} XP
        </Text>
      </View>
      <View style={styles.barBg}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const makeStyles = (Colors: ColorsType) => StyleSheet.create({
  container: {
    gap: 6,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  levelLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: 1,
  },
  levelValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.primaryLight,
  },
  levelTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSub,
  },
  xpText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  barBg: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
    // @ts-ignore - web only
    background: Colors.border,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    // @ts-ignore - web only: gradient fill
    background: 'linear-gradient(90deg, #7C3AED, #A855F7, #818CF8)',
    backgroundColor: Colors.primaryLight,
    // @ts-ignore - web only
    boxShadow: '0 0 8px rgba(168,85,247,0.5)',
  },
  inlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inlineLvl: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSub,
  },
  inlineXP: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  nextLevelText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
