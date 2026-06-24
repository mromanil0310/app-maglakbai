// ─── Auth + Supabase sync slice (ARCH-001) ────────────────────────────────────
// Manages the Supabase session state and the initial remote→local sync.
//
// Sync strategy: localStorage stays the primary store.
//   • On every logOutput / completeOnboarding / profile update:
//     the core/profile slices write localStorage first (already works), then
//     fire-and-forget to Supabase via src/lib/db.ts helpers.
//   • On sign-in: pull the user's Supabase data and merge it into the local
//     store so multi-device is seamless.
//   • Offline: the app works fully from localStorage; Supabase is additive.

import type { StoreApi } from 'zustand';
import type { AppState } from '../appStore';
import { fetchProfile, fetchOutputs, fetchSkillProgress, upsertProfile } from '../../lib/db';
import { getLevelFromXP } from '../../utils/theme';

type Set = StoreApi<AppState>['setState'];
type Get = StoreApi<AppState>['getState'];

export const createAuthSlice = (set: Set, get: Get): Pick<
  AppState,
  'setSupabaseSession' | 'setSupabaseSyncing' | 'syncFromSupabase'
> => ({

  setSupabaseSession: (userId, email) => {
    set({ supabaseUserId: userId, supabaseEmail: email });
  },

  setSupabaseSyncing: (syncing) => {
    set({ supabaseSyncing: syncing });
  },

  syncFromSupabase: async () => {
    const state = get();
    if (!state.supabaseUserId) return;
    const userId = state.supabaseUserId;

    set({ supabaseSyncing: true });
    try {
      // Pull all three data sources in parallel
      const [profile, remoteOutputs, remoteSkills] = await Promise.all([
        fetchProfile(userId),
        fetchOutputs(userId),
        fetchSkillProgress(userId),
      ]);

      // ── Profile merge ────────────────────────────────────────────────────
      // Remote wins on XP/level/streak (authoritative for multi-device);
      // local wins on display fields the user may have changed this session.
      if (profile && state.user) {
        const remoteXP = Math.max(profile.total_xp, state.user.xp);
        set({
          user: {
            ...state.user,
            xp:     remoteXP,
            level:  getLevelFromXP(remoteXP),
            streak: Math.max(profile.streak_days, state.user.streak),
          },
        });
      } else if (profile && !state.user) {
        // Edge case: remote profile exists but local state was wiped (incognito)
        // Build a minimal user from the profile row — they'll need to re-onboard
        // locally but their XP is safe.
        set({
          user: {
            id:           userId,
            name:         profile.display_name,
            handle:       profile.username,
            email:        get().supabaseEmail ?? '',
            careerPathId: profile.career_path,
            xp:           profile.total_xp,
            level:        getLevelFromXP(profile.total_xp),
            streak:       profile.streak_days,
            longestStreak: profile.streak_days,
            bio:          profile.bio ?? '',
            avatarEmoji:  '⚡',
            avatarColor:  '#7C3AED',
            joinedAt:     profile.created_at,
          },
          hasOnboarded: true,
        });
      }

      // ── Outputs merge ────────────────────────────────────────────────────
      // Take the union; remote IDs that aren't in local get added.
      if (remoteOutputs.length > 0) {
        const localIds = new Set(get().outputs.map((o) => o.id));
        const newOutputs = remoteOutputs.filter((o) => !localIds.has(o.id));
        if (newOutputs.length > 0) {
          set({ outputs: [...get().outputs, ...newOutputs] });
        }
      }

      // ── Skill progress merge ─────────────────────────────────────────────
      // Remote wins on completed status; local wins on in-progress counts.
      if (Object.keys(remoteSkills).length > 0) {
        // Phantom-skill guard: only import a remote completed/in-progress skill if
        // it is backed by at least one real output in the merged set. Old builds
        // pre-credited skills with no outputs; without this guard those phantom
        // completions would round-trip back from Cloud Backup and re-appear as
        // milestones the user never earned. Output-backed progress imports normally.
        const backedSkillIds = new Set(get().outputs.map((o) => o.skillId));
        const merged = { ...get().userSkills };
        Object.entries(remoteSkills).forEach(([skillId, remote]) => {
          const remoteHasProgress = remote.status === 'completed' || remote.status === 'in_progress';
          if (remoteHasProgress && !backedSkillIds.has(skillId)) {
            return; // unbacked phantom progress — do not import
          }
          const local = merged[skillId];
          if (!local) {
            merged[skillId] = remote;
          } else if (remote.status === 'completed' && local.status !== 'completed') {
            merged[skillId] = { ...local, status: 'completed', completedAt: remote.completedAt };
          } else {
            // Keep the higher outputCount
            merged[skillId] = {
              ...local,
              outputCount: Math.max(local.outputCount, remote.outputCount),
            };
          }
        });
        set({ userSkills: merged });
      }

      // Push local-only data back up so the remote stays current. MED-006: track a
      // dirty flag instead of silently dropping a failed push, so the next successful
      // sync (sign-in / logOutput) re-pushes and the staleness is observable.
      const currentUser = get().user;
      if (currentUser) {
        try {
          await upsertProfile(userId, currentUser);
          set({ supabaseProfileDirty: false });
        } catch (pushErr) {
          console.warn('[authSlice] upsertProfile failed — marking profile dirty:', pushErr);
          set({ supabaseProfileDirty: true });
        }
      }
    } catch (err) {
      console.warn('[authSlice] syncFromSupabase error:', err);
    } finally {
      set({ supabaseSyncing: false });
    }
  },
});
