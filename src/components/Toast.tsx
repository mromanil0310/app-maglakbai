/**
 * Toast / Snackbar system for EvolveXP.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast({ message: 'Logged!', xp: 75, emoji: '⚡' });
 *
 * Design:
 *  - Slides up from bottom over the tab bar
 *  - Shows emoji, message, and optional XP badge
 *  - Auto-dismisses after 3 s, or tap to dismiss early
 *  - Only one toast at a time (newer replaces older)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, ColorsType, useThemeColors, FontSize, Radius, Spacing } from '../utils/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToastOptions {
  message: string;
  xp?: number;          // XP earned — shown in gold badge when provided
  emoji?: string;       // leading emoji (default ⚡)
  variant?: 'success' | 'info' | 'warning';
  duration?: number;    // ms, default 3000
}

interface ToastCtx {
  showToast: (opts: ToastOptions) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastCtx>({ showToast: () => {} });

export function useToast(): ToastCtx {
  return useContext(ToastContext);
}

// ─── Provider + Toast renderer ────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);

  const VARIANT_COLORS: Record<string, string> = {
    success: Colors.success,
    info:    Colors.primaryLight,
    warning: Colors.gold,
  };
  const [toast, setToast] = useState<ToastOptions & { id: number } | null>(null);

  // translateY: 120 → hidden below, 0 → visible
  const slideAnim = useRef(new Animated.Value(120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 120, duration: 250, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start(() => setToast(null));
  }, [slideAnim, opacityAnim]);

  const showToast = useCallback((opts: ToastOptions) => {
    // Cancel any running timer / animation
    if (timerRef.current) clearTimeout(timerRef.current);
    // Reset position instantly if already visible, then slide in again
    slideAnim.setValue(80);
    opacityAnim.setValue(0);

    setToast({ ...opts, id: Date.now() });

    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 80, friction: 11 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();

    const duration = opts.duration ?? 3000;
    timerRef.current = setTimeout(dismissToast, duration);
  }, [slideAnim, opacityAnim, dismissToast]);

  const accentColor = toast
    ? VARIANT_COLORS[toast.variant ?? 'success'] ?? Colors.success
    : Colors.success;


  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              transform: [{ translateY: slideAnim }],
              opacity: opacityAnim,
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[styles.toast, { borderColor: accentColor + '40' }]}
            activeOpacity={0.85}
            onPress={dismissToast}
          >
            {/* Left emoji */}
            <View style={[styles.emojiCircle, { backgroundColor: accentColor + '18' }]}>
              <Text style={styles.emojiText}>{toast.emoji ?? '⚡'}</Text>
            </View>

            {/* Message */}
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>

            {/* XP badge */}
            {toast.xp !== undefined && toast.xp > 0 && (
              <View style={styles.xpBadge}>
                <Text style={styles.xpText}>+{toast.xp} XP</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (Colors: ColorsType) => StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 98,          // sits just above the 78 px tab bar
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
    // @ts-ignore — web only
    pointerEvents: 'none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    // @ts-ignore
    boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
    // @ts-ignore
    pointerEvents: 'auto',
    // @ts-ignore
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  emojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emojiText: {
    fontSize: 18,
  },
  message: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 19,
  },
  xpBadge: {
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.gold + '35',
    flexShrink: 0,
  },
  xpText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.gold,
  },
});
