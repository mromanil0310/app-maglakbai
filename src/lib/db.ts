// ─── Database helpers (ARCH-001) ──────────────────────────────────────────────
// Thin wrappers around the Supabase REST API for the three v1.0 tables:
//   profiles, outputs, skill_progress.
//
// Design principles:
//   • Every function is a no-op that returns null/[] when !isSupabaseEnabled
//   • All functions return plain data (no Supabase types leak out)
//   • Errors are logged but never thrown — callers stay synchronous-safe
//   • The store calls these AFTER updating localStorage; Supabase is additive

import { supabase, isSupabaseEnabled } from './supabase';
import type { User } from '../types';
import type { Output, UserSkill } from '../types';

// ─── Profiles ─────────────────────────────────────────────────────────────────

/** Upsert the full profile row from the current Zustand user state. */
export async function upsertProfile(userId: string, user: User): Promise<void> {
  if (!isSupabaseEnabled) return;
  const { error } = await supabase.from('profiles').upsert({
    id:           userId,
    username:     user.handle,
    display_name: user.name,
    bio:          user.bio ?? null,
    career_path:  user.careerPathId,
    current_level: user.level,
    total_xp:     user.xp,
    streak_days:  user.streak,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) console.warn('[db] upsertProfile:', error.message);
}

/** Fetch a profile row by user id (used to hydrate state on sign-in). */
export async function fetchProfile(userId: string) {
  if (!isSupabaseEnabled) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) { console.warn('[db] fetchProfile:', error.message); return null; }
  return data;
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

/** Insert a single output after it has been written to localStorage. */
export async function insertOutput(
  userId: string,
  output: Output,
  careerPathId: string,
): Promise<void> {
  if (!isSupabaseEnabled) return;
  const { error } = await supabase.from('outputs').insert({
    id:          output.id,
    user_id:     userId,
    skill_id:    output.skillId,
    career_path: careerPathId,
    type:        output.type,
    title:       output.title,
    description: output.description ?? null,
    link:        output.link ?? null,
    xp_earned:   output.xpGained,
    created_at:  output.createdAt,
  });
  if (error) console.warn('[db] insertOutput:', error.message);
}

/** Fetch all outputs for a user (used on first sign-in to reconcile). */
export async function fetchOutputs(userId: string): Promise<Output[]> {
  if (!isSupabaseEnabled) return [];
  const { data, error } = await supabase
    .from('outputs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) { console.warn('[db] fetchOutputs:', error.message); return []; }
  return (data ?? []).map((r) => ({
    id:          r.id,
    skillId:     r.skill_id,
    skillName:   r.skill_id, // DB stores skillId; the human name is resolved in the store
    type:        r.type,
    title:       r.title,
    description: r.description ?? '',
    link:        r.link ?? undefined,
    xpGained:    r.xp_earned,
    createdAt:   r.created_at,
  }));
}

// ─── Skill progress ───────────────────────────────────────────────────────────

/** Upsert a single skill's progress row after a store update. */
export async function upsertSkillProgress(
  userId: string,
  skillId: string,
  careerPathId: string,
  us: UserSkill,
): Promise<void> {
  if (!isSupabaseEnabled) return;
  const { error } = await supabase.from('skill_progress').upsert({
    user_id:      userId,
    skill_id:     skillId,
    career_path:  careerPathId,
    status:       us.status,
    outputs_count: us.outputCount,
    completed_at: us.completedAt ?? null,
  }, { onConflict: 'user_id,skill_id' });
  if (error) console.warn('[db] upsertSkillProgress:', error.message);
}

/** Fetch all skill_progress rows for a user. */
export async function fetchSkillProgress(userId: string): Promise<Record<string, UserSkill>> {
  if (!isSupabaseEnabled) return {};
  const { data, error } = await supabase
    .from('skill_progress')
    .select('*')
    .eq('user_id', userId);
  if (error) { console.warn('[db] fetchSkillProgress:', error.message); return {}; }
  const result: Record<string, UserSkill> = {};
  (data ?? []).forEach((r) => {
    result[r.skill_id] = {
      skillId:      r.skill_id,
      status:       r.status,
      outputCount:  r.outputs_count,
      completedAt:  r.completed_at ?? undefined,
    };
  });
  return result;
}
