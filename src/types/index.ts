export type SkillStatus = 'locked' | 'available' | 'in_progress' | 'completed';
export type ExperienceLevel = 'beginner' | 'building' | 'experienced';

export type OutputType = 'project' | 'book' | 'cert' | 'github' | 'diagram' | 'script' | 'reflection' | 'event' | 'other';
export type PaceMode = 'sprint' | 'steady' | 'recovery';
export type EvidenceTier = 'verified' | 'documented' | 'logged';
export type OutcomeType =
  | 'interview'       // landed an interview
  | 'offer'           // received a job offer
  | 'promotion'       // promoted at current company
  | 'role_change'     // changed roles or companies
  | 'certification'   // earned a certification
  | 'salary_increase' // got a raise
  | 'portfolio'       // published a portfolio piece / project goes live
  | 'freelance';      // won a freelance client or contract
export type SkillRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CareerPathId =
  | 'data-architect' | 'data-engineer' | 'ai-engineer' | 'ml-engineer'
  | 'fullstack' | 'backend-engineer' | 'frontend-engineer' | 'cloud-engineer'
  | 'devops' | 'cybersecurity' | 'product-manager' | 'business-analyst'
  | 'data-analyst' | 'project-manager' | 'solutions-architect' | 'software-architect'
  | 'mobile-developer' | 'ui-ux-designer' | 'startup-founder';
export type PostType = 'milestone' | 'output' | 'streak' | 'career_win';
export type RoadmapPriorityStatus = 'PRIORITY' | 'SECONDARY';
export type RoadmapStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';

export interface RoadmapEntry {
  pathId: string;
  priorityStatus: RoadmapPriorityStatus;
  roadmapStatus: RoadmapStatus;
  startedAt: string;
  targetDate?: string;
  targetRole?: string;
  weeklyHours?: number;
  archivedAt?: string;
  completedAt?: string;
  locked?: boolean; // FEAT-001: user "focus-lock" — commit the roadmap early; a roadmap also becomes uneditable once the journey starts
}

export interface CustomSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface CustomPath {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  skills: CustomSkill[];
  isCustom: true;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  handle: string;
  email?: string;
  careerPathId: string; // CareerPathId or custom path id
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  bio: string;
  targetRole?: string; // aspirational role the user is working toward
  avatarEmoji: string;
  avatarColor: string;
  avatarUri?: string; // base64 data URI when user uploads a photo
  joinedAt: string;
  lastActiveDate?: string; // YYYY-MM-DD — used to compute daily streak
  streakFreezes?: number;
  weeklyOutputGoal?: number; // comeback plan commitment: 1, 3, or 5 outputs/week
  pinnedOutputIds?: string[]; // up to 3 output IDs featured in Portfolio
  experienceLevel?: ExperienceLevel; // captured during onboarding — shapes starting roadmap
  paceMode?: PaceMode;              // self-selected: sprint / steady / recovery
}

export interface Skill {
  id: string;
  pathId: CareerPathId;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  rarity: SkillRarity;
  requiredOutputs: number;
  prerequisites: string[];
  order: number;
  outputExamples?: string[];
  whyItMatters?: string;
  validationQuestions?: ValidationQuestion[];
}

export interface ValidationQuestion {
  prompt: string;
  choices: [string, string, string, string]; // always exactly 4
  correctIndex: number; // 0–3
  explanation: string; // shown after answering
  source?: string; // citation to a verified, reliable reference (e.g. official docs)
}

export interface UserSkill {
  skillId: string;
  status: SkillStatus;
  outputCount: number;
  completedAt?: string;
  validated?: boolean;
  validatedAt?: string;
}

export interface Output {
  id: string;
  skillId: string;
  skillName: string;
  type: OutputType;
  title: string;
  description: string;
  link?: string;
  keyTakeaway?: string; // the one thing the user will apply (input at log time; +15 XP)
  xpGained: number;
  createdAt: string;
  evidenceTier?: EvidenceTier; // set at log time; undefined on legacy outputs treated as 'logged'
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface FeedPost {
  id: string;
  userId: string;
  userName: string;
  userHandle: string;
  avatarEmoji: string;
  avatarColor: string;
  avatarUri?: string; // photo avatar — only set on user-created posts
  pathId: string; // CareerPathId or custom path id
  pathLabel: string;
  pathColor: string;
  type: PostType;
  skillId?: string;
  skillName?: string;
  outputTitle?: string;
  streakDays?: number;
  outcomeType?: OutcomeType;  // set on career_win posts
  content: string;
  xpGained: number;
  reactions: Record<string, number>;
  userReactions: string[];
  comments: Comment[];
  timestamp: string;
  isCurrentUser?: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: SkillRarity;
  xpGranted: number;
  unlockedAt?: string;
}

export interface CareerPath {
  id: CareerPathId;
  name: string;
  title: string;
  icon: string;
  description: string;
  color: string;
  dimColor: string;
  textColor: string;
  skillIds: string[];
}

export interface LogOutputPayload {
  skillId: string;
  type: OutputType;
  title: string;
  description: string;
  link?: string;
  keyTakeaway?: string;
}

export interface CareerOutcome {
  id: string;
  type: OutcomeType;
  title: string;        // e.g. "Interview at Stripe", "AWS Solutions Architect cert"
  company?: string;     // optional company or org name
  note?: string;        // optional free-text note
  xpAwarded: number;   // XP bonus awarded for logging this outcome
  date: string;         // YYYY-MM-DD — user-specified date (defaults to today)
  createdAt: string;    // ISO — when they logged it in the app
}

export interface LogOutcomePayload {
  type: OutcomeType;
  title: string;
  company?: string;
  note?: string;
  date: string; // YYYY-MM-DD
}

// Compact info for an achievement unlocked by a single action — used to
// surface it on the milestone celebration (UX-030).
export interface UnlockedAchievementInfo {
  id: string;
  title: string;
  xpGranted: number;
}

export interface LogOutputResult {
  skillCompleted: boolean;
  xpGained: number;          // XP from THIS output (base type + quality/takeaway + skill-completion bonus)
  sessionXpGained?: number;  // UX-030: TOTAL XP delta from this action, incl. achievement + streak-milestone bonuses
  newAchievements?: UnlockedAchievementInfo[]; // achievements unlocked by this action (for the celebration)
  leveledUp: boolean;
  newLevel: number;
  newSkillId?: string;
  streakBonusXP?: number;    // set when user hits a 7/14/30-day streak milestone
  newStreak?: number;        // updated streak value after this output
  evidenceRequired?: boolean; // true when skill would complete but lacks quality evidence
}

// ── Market Demand (community-sourced signal layer) ────────────────────────────

export type MarketDemandLevel = 'high' | 'rising' | 'stable';

/** Aggregated demand record for a single skill. */
export interface MarketDemand {
  skillId: string;
  pathId: string;
  level: MarketDemandLevel;
  signalCount: number;   // community signal count (excludes curated seeds)
  lastUpdated: string;   // YYYY-MM-DD
  source: 'curated' | 'community' | 'mixed';
}

/** One community signal contributed by the current user. */
export interface MarketSignal {
  skillId: string;
  pathId: string;
  submittedAt: string; // ISO
}
