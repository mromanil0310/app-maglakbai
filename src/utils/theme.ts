import { createContext, useContext } from 'react';

// ── Color palettes ────────────────────────────────────────────────────────────

export const ColorsDark = {
  bg: '#080810',
  surface: '#0D0D1A',
  card: '#11111C',
  cardAlt: '#17172A',
  border: 'rgba(255,255,255,0.07)',
  borderHex: '#FFFFFF12',

  primary: '#7C3AED',
  primaryLight: '#A855F7',
  primaryDim: 'rgba(124,58,237,0.12)',
  primaryDimActive: 'rgba(124,58,237,0.22)',
  accent2: '#4F46E5',

  accent: '#06B6D4',
  accentDim: '#061820',

  gold: '#F59E0B',
  goldDim: 'rgba(245,158,11,0.10)',

  success: '#10B981',
  successDim: 'rgba(16,185,129,0.10)',

  danger: '#EF4444',
  warning: '#F97316',

  text: '#EEEEF8',
  textSub: '#8888AA',
  textMuted: '#7070A0',

  white: '#FFFFFF',
  black: '#000000',
};

export const ColorsLight = {
  bg: '#F0EDFF',           // slightly richer lavender — more character
  surface: '#FBFAFF',      // off-white surface — lifts above bg
  card: '#FFFFFF',          // pure white cards pop against surface
  cardAlt: '#E8E2FF',       // more vivid tinted card for highlights
  border: 'rgba(0,0,0,0.11)', // slightly stronger — card definition
  borderHex: '#0000001C',

  primary: '#7C3AED',
  primaryLight: '#8B5CF6',   // more vibrant on white than the old #6D28D9
  primaryDim: 'rgba(124,58,237,0.10)',
  primaryDimActive: 'rgba(124,58,237,0.20)',
  accent2: '#4F46E5',

  accent: '#0891B2',
  accentDim: '#E0F2FE',

  gold: '#B45309',           // richer amber — more pop on light
  goldDim: 'rgba(180,83,9,0.10)',

  success: '#047857',        // richer green
  successDim: 'rgba(4,120,87,0.10)',

  danger: '#DC2626',
  warning: '#EA580C',

  text: '#111827',
  textSub: '#4B5563',        // was #374151 — better hierarchy, less heavy
  textMuted: '#6B7280',

  white: '#FFFFFF',
  black: '#000000',
};

// ── Theme context & hook ──────────────────────────────────────────────────────

export type ColorScheme = 'dark' | 'light';
export type ColorsType = typeof ColorsDark;

export const ThemeContext = createContext<ColorScheme>('dark');

export const useThemeColors = (): ColorsType => {
  const scheme = useContext(ThemeContext);
  return scheme === 'light' ? ColorsLight : ColorsDark;
};

/** Static dark alias — for non-component code and makeStyles type annotations */
export const Colors = ColorsDark;

export const PathColors: Record<string, { primary: string; dim: string; text: string; border: string }> = {
  'data-architect': {
    primary: '#06B6D4',
    dim: 'rgba(6,182,212,0.08)',
    text: '#67E8F9',
    border: '#0E4A60',
  },
  'ai-engineer': {
    primary: '#7C3AED',
    dim: 'rgba(124,58,237,0.08)',
    text: '#C4B5FD',
    border: '#3D1B7A',
  },
  'fullstack': {
    primary: '#10B981',
    dim: 'rgba(16,185,129,0.08)',
    text: '#6EE7B7',
    border: '#0A3D20',
  },
  'data-engineer': {
    primary: '#F59E0B',
    dim: 'rgba(245,158,11,0.08)',
    text: '#FCD34D',
    border: '#6B4500',
  },
  'ml-engineer': {
    primary: '#8B5CF6',
    dim: 'rgba(139,92,246,0.08)',
    text: '#C4B5FD',
    border: '#4C1D95',
  },
  'backend-engineer': {
    primary: '#94A3B8',
    dim: 'rgba(148,163,184,0.08)',
    text: '#CBD5E1',
    border: '#334155',
  },
  'frontend-engineer': {
    primary: '#F97316',
    dim: 'rgba(249,115,22,0.08)',
    text: '#FDBA74',
    border: '#7C2D12',
  },
  'cloud-engineer': {
    primary: '#0EA5E9',
    dim: 'rgba(14,165,233,0.08)',
    text: '#7DD3FC',
    border: '#075985',
  },
  'devops': {
    primary: '#14B8A6',
    dim: 'rgba(20,184,166,0.08)',
    text: '#5EEAD4',
    border: '#0F3D38',
  },
  'cybersecurity': {
    primary: '#EF4444',
    dim: 'rgba(239,68,68,0.08)',
    text: '#FCA5A5',
    border: '#7F1D1D',
  },
  'product-manager': {
    primary: '#D946EF',
    dim: 'rgba(217,70,239,0.08)',
    text: '#F0ABFC',
    border: '#701A75',
  },
  'business-analyst': {
    primary: '#34D399',
    dim: 'rgba(52,211,153,0.08)',
    text: '#6EE7B7',
    border: '#064E3B',
  },
  'data-analyst': {
    primary: '#38BDF8',
    dim: 'rgba(56,189,248,0.08)',
    text: '#93C5FD',
    border: '#0C4A6E',
  },
  'project-manager': {
    primary: '#FBBF24',
    dim: 'rgba(251,191,36,0.08)',
    text: '#FDE68A',
    border: '#78350F',
  },
  'solutions-architect': {
    primary: '#6366F1',
    dim: 'rgba(99,102,241,0.08)',
    text: '#A5B4FC',
    border: '#1E1B4B',
  },
  'software-architect': {
    primary: '#22C55E',
    dim: 'rgba(34,197,94,0.08)',
    text: '#86EFAC',
    border: '#14532D',
  },
  'mobile-developer': {
    primary: '#EC4899',
    dim: 'rgba(236,72,153,0.08)',
    text: '#F9A8D4',
    border: '#831843',
  },
  'ui-ux-designer': {
    primary: '#FB7185',
    dim: 'rgba(251,113,133,0.08)',
    text: '#FECDD3',
    border: '#7F1D1D',
  },
  'startup-founder': {
    primary: '#E879F9',
    dim: 'rgba(232,121,249,0.08)',
    text: '#F5D0FE',
    border: '#701A75',
  },
};

/**
 * Theme-aware path color lookup.
 * In dark mode, `text` is a light pastel (readable on dark) and `border` is a
 * deep shade. In light mode, `text` uses the saturated primary (readable on white)
 * and `border` is lightened so it doesn't look muddy on white cards.
 *
 * Use this instead of `PathColors[id]` wherever the color scheme matters.
 */
export function getPathColor(
  pathId: string,
  scheme: ColorScheme,
): { primary: string; dim: string; text: string; border: string } {
  const base = PathColors[pathId] ?? {
    primary: '#7C3AED',
    dim: 'rgba(124,58,237,0.08)',
    text: '#C4B5FD',
    border: '#3D1B7A',
  };
  if (scheme === 'dark') return base;
  // Light mode: pastels become saturated primaries; dark borders become light-alpha
  return {
    primary: base.primary,
    dim: base.dim,                      // rgba tints already work on light
    text: base.primary,                 // saturated, not pastel — readable on white
    border: base.primary + '35',        // light alpha border, not deep shade
  };
}

export const RarityColors: Record<string, { color: string; label: string }> = {
  common: { color: '#8888AA', label: 'COMMON' },
  rare: { color: '#06B6D4', label: 'RARE' },
  epic: { color: '#A855F7', label: 'EPIC' },
  legendary: { color: '#F59E0B', label: 'LEGENDARY' },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 36,
};

export const Shadow = {
  purple: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    shadowOpacity: 0.6,
    elevation: 8,
  },
  cyan: {
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    shadowOpacity: 0.6,
    elevation: 8,
  },
  green: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    shadowOpacity: 0.6,
    elevation: 8,
  },
  gold: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    shadowOpacity: 0.7,
    elevation: 10,
  },
};

// Level titles matching LakbAI PRD
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Learner',
  2: 'Builder',
  3: 'Maker',
  4: 'Practitioner',
  5: 'Specialist',
  6: 'Engineer',
  7: 'Senior Engineer',
  8: 'Tech Lead',
  9: 'Architect',
  10: 'Principal Architect',
};

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, 10)] ?? 'Principal Architect';
}

export function getLevelFromXP(xp: number): number {
  let level = 1;
  let threshold = 0;
  while (xp >= threshold + level * 200) {
    threshold += level * 200;
    level++;
  }
  return level;
}

export function getLevelBounds(level: number): { min: number; max: number } {
  let min = 0;
  for (let i = 1; i < level; i++) {
    min += i * 200;
  }
  return { min, max: min + level * 200 };
}

export function timeAgo(isoDate: string): string {
  const now = new Date();
  const then = new Date(isoDate);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Derives a meaningful profile tagline from a custom path name.
 * Built-in paths have their own `title` field — this is for custom paths only.
 * Keyword matching is ordered most-specific → least-specific.
 */
export function derivePathTagline(name: string): string {
  const n = name.toLowerCase();

  // Executive / C-suite
  if (/\bceo\b/.test(n))                           return 'CEO Mindset in Progress';
  if (/\bcto\b/.test(n))                           return 'Future CTO';
  if (/\bcfo\b/.test(n))                           return 'Future CFO';
  if (/\b(c-suite|c suite|executive)\b/.test(n))   return 'Future Executive';

  // Influence & people skills
  if (/negoti/.test(n))                            return 'Mastering the Art of Negotiation';
  if (/\b(persuad|persuasion|influenc)\b/.test(n)) return 'Master Influencer in Training';
  if (/\b(communicat|speak|present)\b/.test(n))    return 'Future Expert Communicator';
  if (/\bleader/.test(n))                          return 'Future Leader';
  if (/\bmanag/.test(n))                           return 'Future People Manager';

  // Business & entrepreneurship
  if (/\b(entrepren|founder|startup)\b/.test(n))   return 'Future Founder';
  if (/\b(business|biz)\b/.test(n))                return 'Future Business Builder';
  if (/\bsales?\b/.test(n))                        return 'Future Sales Leader';
  if (/\bmarket/.test(n))                          return 'Future Marketing Pro';
  if (/\b(financ|invest|trading|wealth)\b/.test(n))return 'Future Finance Pro';
  if (/\bproduct\b/.test(n))                       return 'Future Product Leader';

  // Technical
  if (/\b(ai|artificial intel|machine learn)\b/.test(n)) return 'Future AI Builder';
  if (/\b(data|analytics|bi\b)\b/.test(n))         return 'Future Data Professional';
  if (/\b(code|coding|develop|engineer|program)\b/.test(n)) return 'Future Engineer';
  if (/\bdesign\b/.test(n))                        return 'Future Designer';
  if (/\b(writ|content|copy)\b/.test(n))           return 'Future Content Creator';

  // Clean generic fallback — avoids echoing the raw path name
  return 'Mastery in Progress';
}
