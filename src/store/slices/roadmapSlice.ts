// Roadmap & paths store slice — actions extracted from appStore.ts (ARCH-002).
// Action bodies are unchanged; recombined in appStore.ts via the Zustand slices pattern.

import type { StoreApi } from 'zustand';
import type { AppState, PendingCelebration } from '../appStore';
import type {
  User, Output, FeedPost, CareerPathId, CustomPath, CustomSkill,
  LogOutputPayload, LogOutputResult, SkillStatus, RoadmapEntry,
  RoadmapPriorityStatus, RoadmapStatus, CareerOutcome, LogOutcomePayload,
  OutcomeType, ExperienceLevel, PaceMode,
} from '../../types';
import { getLevelFromXP, Colors } from '../../utils/theme';
import { track, identify } from '../../utils/analytics';
import { CAREER_PATHS } from '../../data/careerPaths';
import { ALL_SKILLS } from '../../data/skills';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';
import { MOCK_FEED } from '../../data/mockFeed';
import { getEvidenceTier, OUTCOME_XP, getCareerMastery } from '../../domain/progression';
import { initUserSkills, unlockDependentSkills, checkAchievements } from '../../domain/skillGraph';

type Set = StoreApi<AppState>['setState'];
type Get = StoreApi<AppState>['getState'];

export const createRoadmapSlice = (set: Set, get: Get): Pick<AppState, 'addCustomPath' | 'switchPath' | 'setPrioritizedPath' | 'enrollInRoadmap' | 'setPriorityRoadmap' | 'pauseRoadmap' | 'archiveRoadmap' | 'reactivateRoadmap' | 'addRoadmapItem'> => ({
  addCustomPath: ({ name, icon, description, color, skills }) => {
    const state = get();
    track('custom_path_created', { path_name: name, skill_count: skills.length });
    const newPathId = `custom_${Date.now()}`;
    const newPath: CustomPath = {
      id: newPathId,
      name,
      icon,
      description,
      color,
      skills,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };
    const updatedCustomPaths = [...state.customPaths, newPath];
    // Init user skills for the custom path
    const newUserSkills = { ...state.userSkills };
    skills.forEach((skill, i) => {
      newUserSkills[skill.id] = { skillId: skill.id, status: i === 0 ? 'available' : 'locked', outputCount: 0 };
    });
    set({ customPaths: updatedCustomPaths, userSkills: newUserSkills });
    return newPathId;
  },

  switchPath: (pathId: string) => {
    const state = get();
    if (!state.user) return;
    const isBuiltInPath = CAREER_PATHS.some(p => p.id === pathId);
    track('path_switched', {
      from_path: state.user.careerPathId,
      to_path: pathId,
      is_custom: !isBuiltInPath,
    });
    const updatedUser = { ...state.user, careerPathId: pathId };
    // Init skills for this path if not already tracked
    let newUserSkills = { ...state.userSkills };
    if (isBuiltInPath) {
      const path = CAREER_PATHS.find(p => p.id === pathId)!;
      path.skillIds.forEach(skillId => {
        if (!newUserSkills[skillId]) {
          const skill = ALL_SKILLS.find(s => s.id === skillId)!;
          newUserSkills[skillId] = {
            skillId,
            status: skill.prerequisites.length === 0 ? 'available' : 'locked',
            outputCount: 0,
          };
        }
      });
    } else {
      const customPath = state.customPaths.find(p => p.id === pathId);
      if (customPath) {
        customPath.skills.forEach((skill, i) => {
          if (!newUserSkills[skill.id]) {
            newUserSkills[skill.id] = { skillId: skill.id, status: i === 0 ? 'available' : 'locked', outputCount: 0 };
          }
        });
      }
    }
    // Auto-enroll as SECONDARY if not already in roadmaps
    let updatedRoadmaps = state.roadmaps;
    if (!state.roadmaps.some(r => r.pathId === pathId)) {
      updatedRoadmaps = [...state.roadmaps, {
        pathId,
        priorityStatus: 'SECONDARY' as RoadmapPriorityStatus,
        roadmapStatus: 'ACTIVE' as RoadmapStatus,
        startedAt: new Date().toISOString(),
      }];
    }
    set({ user: updatedUser, userSkills: newUserSkills, roadmaps: updatedRoadmaps });
  },

  setPrioritizedPath: (pathId: string) => {
    set({ prioritizedPathId: pathId });
  },

  enrollInRoadmap: (pathId: string) => {
    const state = get();
    // Don't re-enroll if already enrolled
    if (state.roadmaps.some(r => r.pathId === pathId)) return;

    const newEntry: RoadmapEntry = {
      pathId,
      priorityStatus: 'SECONDARY',
      roadmapStatus: 'ACTIVE',
      startedAt: new Date().toISOString(),
    };

    // Init skills for this path
    const isBuiltIn = CAREER_PATHS.some(p => p.id === pathId);
    let newUserSkills = { ...state.userSkills };
    if (isBuiltIn) {
      const path = CAREER_PATHS.find(p => p.id === pathId)!;
      path.skillIds.forEach(skillId => {
        if (!newUserSkills[skillId]) {
          const skill = ALL_SKILLS.find(s => s.id === skillId)!;
          newUserSkills[skillId] = {
            skillId,
            status: skill.prerequisites.length === 0 ? 'available' : 'locked',
            outputCount: 0,
          };
        }
      });
    }

    set({ roadmaps: [...state.roadmaps, newEntry], userSkills: newUserSkills });
    track('roadmap_enrolled', { path_id: pathId, priority_status: 'SECONDARY' });
  },

  setPriorityRoadmap: (pathId: string) => {
    const state = get();
    // Enroll first if not already enrolled
    const alreadyEnrolled = state.roadmaps.some(r => r.pathId === pathId);
    const updatedRoadmaps = state.roadmaps.map(r => {
      if (r.pathId === pathId) {
        return { ...r, priorityStatus: 'PRIORITY' as RoadmapPriorityStatus, roadmapStatus: 'ACTIVE' as RoadmapStatus };
      }
      if (r.priorityStatus === 'PRIORITY') {
        return { ...r, priorityStatus: 'SECONDARY' as RoadmapPriorityStatus };
      }
      return r;
    });

    if (!alreadyEnrolled) {
      updatedRoadmaps.push({
        pathId,
        priorityStatus: 'PRIORITY',
        roadmapStatus: 'ACTIVE',
        startedAt: new Date().toISOString(),
      });
    }

    // Init skills if needed
    const isBuiltIn = CAREER_PATHS.some(p => p.id === pathId);
    let newUserSkills = { ...state.userSkills };
    if (isBuiltIn) {
      const path = CAREER_PATHS.find(p => p.id === pathId)!;
      path.skillIds.forEach(skillId => {
        if (!newUserSkills[skillId]) {
          const skill = ALL_SKILLS.find(s => s.id === skillId)!;
          newUserSkills[skillId] = {
            skillId,
            status: skill.prerequisites.length === 0 ? 'available' : 'locked',
            outputCount: 0,
          };
        }
      });
    }

    const updatedUser = state.user ? { ...state.user, careerPathId: pathId } : state.user;
    set({ roadmaps: updatedRoadmaps, prioritizedPathId: pathId, userSkills: newUserSkills, user: updatedUser });
    track('roadmap_priority_changed', { path_id: pathId });
  },

  pauseRoadmap: (pathId: string) => {
    const state = get();
    const updatedRoadmaps = state.roadmaps.map(r =>
      r.pathId === pathId ? { ...r, roadmapStatus: 'PAUSED' as RoadmapStatus } : r
    );
    set({ roadmaps: updatedRoadmaps });
    track('roadmap_paused', { path_id: pathId });
  },

  archiveRoadmap: (pathId: string) => {
    const state = get();
    const updatedRoadmaps = state.roadmaps.map(r =>
      r.pathId === pathId
        ? { ...r, roadmapStatus: 'ARCHIVED' as RoadmapStatus, priorityStatus: 'SECONDARY' as RoadmapPriorityStatus, archivedAt: new Date().toISOString() }
        : r
    );
    // If archiving the current priority, promote the first active secondary to priority
    const archivedEntry = state.roadmaps.find(r => r.pathId === pathId);
    let newPriorityId = state.prioritizedPathId;
    if (archivedEntry?.priorityStatus === 'PRIORITY') {
      const nextActive = updatedRoadmaps.find(r => r.roadmapStatus === 'ACTIVE' && r.pathId !== pathId);
      if (nextActive) {
        newPriorityId = nextActive.pathId;
        const idx = updatedRoadmaps.findIndex(r => r.pathId === nextActive.pathId);
        updatedRoadmaps[idx] = { ...updatedRoadmaps[idx], priorityStatus: 'PRIORITY' };
      } else {
        newPriorityId = null;
      }
    }
    set({ roadmaps: updatedRoadmaps, prioritizedPathId: newPriorityId });
    track('roadmap_archived', { path_id: pathId });
  },

  reactivateRoadmap: (pathId: string) => {
    const state = get();
    const updatedRoadmaps = state.roadmaps.map(r =>
      r.pathId === pathId
        ? { ...r, roadmapStatus: 'ACTIVE' as RoadmapStatus, archivedAt: undefined }
        : r
    );
    set({ roadmaps: updatedRoadmaps });
    track('roadmap_reactivated', { path_id: pathId });
  },

  addRoadmapItem: (name: string, icon: string): string => {
    const state = get();
    const newId = `personal_${Date.now()}`;
    const newSkill: CustomSkill = { id: newId, name, description: '', icon };

    // Find or create the "My Library" personal path
    const PERSONAL_LIB_ID = 'personal_library';
    let updatedCustomPaths = [...state.customPaths];
    const libIdx = updatedCustomPaths.findIndex((p) => p.id === PERSONAL_LIB_ID);

    if (libIdx >= 0) {
      updatedCustomPaths[libIdx] = {
        ...updatedCustomPaths[libIdx],
        skills: [...updatedCustomPaths[libIdx].skills, newSkill],
      };
    } else {
      updatedCustomPaths.push({
        id: PERSONAL_LIB_ID,
        name: 'My Library',
        icon: '📚',
        description: 'Personal items added while logging work',
        color: '#7C3AED',
        skills: [newSkill],
        isCustom: true,
        createdAt: new Date().toISOString(),
      });
    }

    const newUserSkills = {
      ...state.userSkills,
      [newId]: { skillId: newId, status: 'available' as SkillStatus, outputCount: 0 },
    };

    set({ customPaths: updatedCustomPaths, userSkills: newUserSkills });

    return newId;
  },

});
