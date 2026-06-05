// ─── DemandBadge ──────────────────────────────────────────────────────────────
// Displays market demand level for a skill as a compact chip.
// Three states: 🔥 High Demand | ↗ Rising | → Stable
// Used on skill nodes in EvolveScreen and the gap strip in DashboardScreen.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MarketDemandLevel } from '../types';

interface DemandBadgeProps {
  level: MarketDemandLevel;
  compact?: boolean; // true = icon-only (for tight spaces like skill nodes)
}

const CONFIG: Record<MarketDemandLevel, { icon: string; label: string; bg: string; text: string }> = {
  high:   { icon: '🔥', label: 'High Demand', bg: 'rgba(239,68,68,0.15)',  text: '#FCA5A5' },
  rising: { icon: '↗',  label: 'Rising',      bg: 'rgba(245,158,11,0.15)', text: '#FCD34D' },
  stable: { icon: '→',  label: 'Stable',      bg: 'rgba(100,116,139,0.15)', text: '#94A3B8' },
};

export default function DemandBadge({ level, compact = false }: DemandBadgeProps) {
  const cfg = CONFIG[level];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.icon, compact && styles.iconCompact]}>{cfg.icon}</Text>
      {!compact && (
        <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    gap: 3,
  },
  icon: {
    fontSize: 11,
    lineHeight: 14,
  },
  iconCompact: {
    fontSize: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
