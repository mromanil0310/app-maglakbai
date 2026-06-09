// MaglakbAI achievement catalog — pure static data extracted from appStore.ts (ARCH-002).
import type { Achievement } from '../types';

export const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    description: 'Log your first output',
    icon: '🌱',
    rarity: 'common',
    xpGranted: 25,
  },
  {
    id: 'builder',
    title: 'Builder',
    description: 'Log 5 outputs',
    icon: '🔨',
    rarity: 'common',
    xpGranted: 75,
  },
  {
    id: 'skill-mastered',
    title: 'Skill Mastered',
    description: 'Complete your first skill',
    icon: '⚡',
    rarity: 'rare',
    xpGranted: 100,
  },
  {
    id: 'consistent',
    title: 'Consistent',
    description: 'Maintain a 7-day streak',
    icon: '🔥',
    rarity: 'rare',
    xpGranted: 150,
  },
  {
    id: 'on-fire',
    title: 'On Fire',
    description: 'Maintain a 14-day streak',
    icon: '🌋',
    rarity: 'epic',
    xpGranted: 300,
  },
  {
    id: 'evolution',
    title: 'Evolution Begun',
    description: 'Reach 500 XP',
    icon: '🧬',
    rarity: 'epic',
    xpGranted: 100,
  },
  {
    id: 'triple-master',
    title: 'Triple Master',
    description: 'Complete 3 skills',
    icon: '👑',
    rarity: 'legendary',
    xpGranted: 500,
  },
  {
    id: 'thirty-day-legend',
    title: '30-Day Legend',
    description: 'Maintain a 30-day streak',
    icon: '🏅',
    rarity: 'legendary',
    xpGranted: 500,
  },
];
