import { create } from 'zustand';
import {
  User,
  Skill,
  UserSkill,
  Output,
  FeedPost,
  Achievement,
  CareerPath,
  CareerPathId,
  CustomPath,
  CustomSkill,
  LogOutputPayload,
  LogOutputResult,
  SkillStatus,
  RoadmapEntry,
  RoadmapPriorityStatus,
  RoadmapStatus,
  EvidenceTier,
  CareerOutcome,
  LogOutcomePayload,
  OutcomeType,
  ExperienceLevel,
  PaceMode,
} from '../types';
import { getLevelFromXP, Colors } from '../utils/theme';
import { track, identify } from '../utils/analytics';

// ─── Motivation Decay Model ───────────────────────────────────────────────────
// Maps days since last output → 5 behavioral stages.
// 'active'   0–1 d  — engaged, no signal needed
// 'coasting' 2–3 d  — subtle nudge: keep the flow going
// 'drifting' 4–6 d  — visible nudge: one log brings you back
// 'fading'   7–13 d — DormancyCard (at_risk tier)
// 'recovery' 14+ d  — DormancyCard (dormant/lapsed tier)

export type DecayStage = 'active' | 'coasting' | 'drifting' | 'fading' | 'recovery';

export function getDecayStage(daysSinceLastOutput: number, hasStarted: boolean): DecayStage {
  if (!hasStarted || daysSinceLastOutput <= 1) return 'active';
  if (daysSinceLastOutput <= 3) return 'coasting';
  if (daysSinceLastOutput <= 6) return 'drifting';
  if (daysSinceLastOutput <= 13) return 'fading';
  return 'recovery';
}

// ─── Burnout Protection ───────────────────────────────────────────────────────
// Detects a sprint-then-drop pattern: ≥4 outputs in the 14-day window before
// the current gap started, combined with a gap of ≥2 days. Signal clears when
// the user sets paceMode to 'recovery'.

export type BurnoutSignal = 'sprint_followed_by_drop' | null;

export function getBurnoutSignal(
  outputs: Output[],
  daysSinceLastOutput: number,
  paceMode: PaceMode | undefined,
): BurnoutSignal {
  if (paceMode === 'recovery') return null;
  if (daysSinceLastOutput < 2 || outputs.length < 4) return null;

  const now = Date.now();
  const gapStartMs = now - daysSinceLastOutput * 24 * 60 * 60 * 1000;
  const windowStartMs = gapStartMs - 14 * 24 * 60 * 60 * 1000;

  const sprintOutputCount = outputs.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= windowStartMs && t < gapStartMs;
  }).length;

  return sprintOutputCount >= 4 ? 'sprint_followed_by_drop' : null;
}

// ─── Evidence Tier ────────────────────────────────────────────────────────────
// Classifies an output's proof quality:
//   verified   — has a link (they put it online)
//   documented — description ≥ 80 chars (thoughtful writeup)
//   logged     — anything else (may be fake / too vague)
//
// Skill completion is gated: at least ONE output for the skill must be
// 'verified' or 'documented'. Logging-only skills can never complete.

export function getEvidenceTier(link: string | undefined, description: string): EvidenceTier {
  if (link && link.trim().length > 0) return 'verified';
  if (description.trim().length >= 50) return 'documented'; // 50 chars ≈ 1–2 sentences — accessible for all users
  return 'logged';
}

// ─── Mastery Framework ───────────────────────────────────────────────────────
// Per-skill mastery tiers derived from existing UserSkill state — no new user
// actions required for levels 0-2. Level 3 (Validated) requires the quiz.
//
// Tier model:
//   0 Not Started  — no outputs logged yet
//   1 Practicing   — outputs in progress, skill not yet completed
//   2 Competent    — skill completed (evidence gate passed)
//   3 Validated    — competent + knowledge-check quiz passed

export type MasteryLevel = 0 | 1 | 2 | 3;

export const MASTERY_TIERS: Record<MasteryLevel, {
  label: string;
  shortLabel: string;
  color: string;
  icon: string;
  description: string;
}> = {
  0: { label: 'Not Started', shortLabel: '',           color: Colors.textMuted, icon: '○', description: 'Not yet attempted' },
  1: { label: 'Practicing',  shortLabel: 'PRACTICING', color: '#60A5FA',        icon: '◑', description: 'Building familiarity through proof-of-work' },
  2: { label: 'Competent',   shortLabel: 'COMPETENT',  color: '#A855F7',        icon: '●', description: 'Applied and completed — evidence gate passed' },
  3: { label: 'Validated',   shortLabel: 'VALIDATED',  color: '#F59E0B',        icon: '★', description: 'Demonstrated under testing — knowledge confirmed' },
};

export function getSkillMasteryLevel(us: UserSkill | undefined): MasteryLevel {
  if (!us || us.outputCount === 0) return 0;
  if (us.status === 'completed' && us.validated) return 3;
  if (us.status === 'completed') return 2;
  return 1; // in_progress
}

// Career-level mastery title derived from skill distribution across a path
export const CAREER_MASTERY_LADDER = ['Beginner', 'Developing', 'Competent', 'Advanced', 'Expert'] as const;
export type CareerMasteryTitle = typeof CAREER_MASTERY_LADDER[number];

export const CAREER_MASTERY_META: Record<CareerMasteryTitle, { color: string; description: string; next: string }> = {
  Beginner:   { color: Colors.textMuted,  description: 'Just getting started',                  next: 'Log outputs to start building skills' },
  Developing: { color: '#60A5FA',         description: 'Building core skills',                  next: 'Complete more skills to reach Competent' },
  Competent:  { color: '#A855F7',         description: 'Applying skills effectively',            next: 'Validate your skills to reach Advanced' },
  Advanced:   { color: Colors.success,    description: 'Demonstrating validated expertise',      next: 'Validate remaining skills to reach Expert' },
  Expert:     { color: Colors.gold,       description: 'Full path mastery — all skills validated', next: 'You\'ve reached the top. Build and share.' },
};

export function getCareerMastery(
  userSkills: Record<string, UserSkill>,
  pathSkillIds: string[]
): {
  title: CareerMasteryTitle;
  competentCount: number;
  validatedCount: number;
  practicingCount: number;
  totalPathSkills: number;
} {
  const totalPathSkills = pathSkillIds.length;
  if (totalPathSkills === 0) {
    return { title: 'Beginner', competentCount: 0, validatedCount: 0, practicingCount: 0, totalPathSkills: 0 };
  }

  let competentCount = 0;
  let validatedCount = 0;
  let practicingCount = 0;

  pathSkillIds.forEach((id) => {
    const ml = getSkillMasteryLevel(userSkills[id]);
    if (ml === 1) practicingCount++;
    if (ml >= 2) competentCount++;
    if (ml >= 3) validatedCount++;
  });

  const competentPct = (competentCount / totalPathSkills) * 100;
  const validatedPct = (validatedCount / totalPathSkills) * 100;

  let title: CareerMasteryTitle;
  if (competentPct === 0 && practicingCount === 0) title = 'Beginner';
  else if (competentPct < 30)                      title = 'Developing';
  else if (competentPct < 70)                      title = 'Competent';
  else if (validatedPct < 60)                      title = 'Advanced';
  else                                             title = 'Expert';

  return { title, competentCount, validatedCount, practicingCount, totalPathSkills };
}

// ─── Career Outcome XP ───────────────────────────────────────────────────────
// Generous awards — these are real-world proof that SkillForge is working.

export const OUTCOME_XP: Record<OutcomeType, number> = {
  interview:       150,
  offer:           500,
  promotion:       400,
  role_change:     500,
  certification:   300,
  salary_increase: 300,
  portfolio:       200,
  freelance:       250,
};

// ─── Static Catalog ──────────────────────────────────────────────────────────

export const CAREER_PATHS: CareerPath[] = [
  {
    id: 'data-architect',
    name: 'Data Architect',
    title: 'Mastery in Progress',
    icon: '🏗️',
    description: 'Master the modern data stack. Build pipelines, model data, and architect cloud solutions.',
    color: '#06B6D4',
    dimColor: '#061820',
    textColor: '#67E8F9',
    skillIds: ['sql-foundations', 'python-automation', 'snowflake-engineering', 'data-modeling', 'ai-workflow-design'],
  },
  {
    id: 'ai-engineer',
    name: 'AI Engineer',
    title: 'Mastery in Progress',
    icon: '🤖',
    description: 'Build production AI systems. RAG pipelines, agents, and intelligent applications.',
    color: '#7C3AED',
    dimColor: '#0D0620',
    textColor: '#C4B5FD',
    skillIds: ['python-fundamentals', 'rest-apis', 'prompt-engineering', 'vector-databases', 'rag-systems', 'ai-agents'],
  },
  {
    id: 'fullstack',
    name: 'Full Stack',
    title: 'Mastery in Progress',
    icon: '🌐',
    description: 'Build complete products from UI to backend. Web, mobile, and cloud deployment.',
    color: '#10B981',
    dimColor: '#061A10',
    textColor: '#6EE7B7',
    skillIds: ['html-css', 'javascript', 'react-rn', 'backend-apis', 'database-design', 'cloud-deployment'],
  },
  {
    id: 'data-engineer',
    name: 'Data Engineer',
    title: 'Mastery in Progress',
    icon: '🔧',
    description: 'Build the pipelines that power data-driven decisions. ETL, Spark, Kafka, and orchestration.',
    color: '#F59E0B',
    dimColor: '#1A0E00',
    textColor: '#FCD34D',
    skillIds: ['de-python-data', 'de-sql-advanced', 'de-spark-processing', 'de-airflow-pipelines', 'de-kafka-streaming'],
  },
  {
    id: 'ml-engineer',
    name: 'ML Engineer',
    title: 'Mastery in Progress',
    icon: '🧪',
    description: 'Train, deploy, and maintain ML models in production. From sklearn to MLOps.',
    color: '#8B5CF6',
    dimColor: '#0D0520',
    textColor: '#C4B5FD',
    skillIds: ['ml-python-stats', 'ml-sklearn-algorithms', 'ml-deep-learning', 'ml-mlops', 'ml-feature-engineering'],
  },
  {
    id: 'backend-engineer',
    name: 'Backend Engineer',
    title: 'Mastery in Progress',
    icon: '⚙️',
    description: 'Build fast, scalable APIs and services. Databases, auth, microservices, and cloud.',
    color: '#94A3B8',
    dimColor: '#111520',
    textColor: '#CBD5E1',
    skillIds: ['be-language-core', 'be-rest-design', 'be-database-optimization', 'be-auth-security', 'be-microservices'],
  },
  {
    id: 'frontend-engineer',
    name: 'Frontend Engineer',
    title: 'Mastery in Progress',
    icon: '🎨',
    description: 'Craft pixel-perfect UIs that users love. React, TypeScript, performance, and accessibility.',
    color: '#F97316',
    dimColor: '#1A0A00',
    textColor: '#FDBA74',
    skillIds: ['fe-html-css-js', 'fe-react-framework', 'fe-typescript', 'fe-performance', 'fe-testing-a11y'],
  },
  {
    id: 'cloud-engineer',
    name: 'Cloud Engineer',
    title: 'Mastery in Progress',
    icon: '☁️',
    description: 'Design and manage scalable cloud infrastructure on AWS, GCP, or Azure.',
    color: '#0EA5E9',
    dimColor: '#051520',
    textColor: '#7DD3FC',
    skillIds: ['ce-cloud-fundamentals', 'ce-networking', 'ce-iac', 'ce-kubernetes', 'ce-cost-optimization'],
  },
  {
    id: 'devops',
    name: 'DevOps Engineer',
    title: 'Mastery in Progress',
    icon: '🛠️',
    description: 'Automate the software lifecycle. CI/CD, containers, observability, and security.',
    color: '#14B8A6',
    dimColor: '#051510',
    textColor: '#5EEAD4',
    skillIds: ['do-linux-shell', 'do-cicd', 'do-docker-k8s', 'do-monitoring', 'do-security'],
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    title: 'Mastery in Progress',
    icon: '🔐',
    description: 'Defend systems and find vulnerabilities before attackers do. Networking to incident response.',
    color: '#EF4444',
    dimColor: '#1A0505',
    textColor: '#FCA5A5',
    skillIds: ['cs-networking', 'cs-linux-security', 'cs-vulnerability', 'cs-pentest', 'cs-incident-response'],
  },
  {
    id: 'product-manager',
    name: 'Product Manager',
    title: 'Mastery in Progress',
    icon: '📋',
    description: 'Define what to build and why. Research, roadmapping, stakeholder alignment, and launch.',
    color: '#D946EF',
    dimColor: '#150520',
    textColor: '#F0ABFC',
    skillIds: ['pm-discovery', 'pm-roadmap', 'pm-stakeholders', 'pm-data-driven', 'pm-launch'],
  },
  {
    id: 'business-analyst',
    name: 'Business Analyst',
    title: 'Mastery in Progress',
    icon: '📊',
    description: 'Bridge business and technology. Requirements, process modeling, data analysis, and reporting.',
    color: '#34D399',
    dimColor: '#041A10',
    textColor: '#6EE7B7',
    skillIds: ['ba-requirements', 'ba-data-analysis', 'ba-process-mapping', 'ba-sql-business', 'ba-reporting'],
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    title: 'Mastery in Progress',
    icon: '📈',
    description: 'Turn raw data into business insights. SQL, visualization, Python, and statistics.',
    color: '#38BDF8',
    dimColor: '#051020',
    textColor: '#93C5FD',
    skillIds: ['da-excel-spreadsheets', 'da-sql-analysis', 'da-visualization', 'da-python-analysis', 'da-statistics'],
  },
  {
    id: 'project-manager',
    name: 'Project Manager',
    title: 'Mastery in Progress',
    icon: '📌',
    description: 'Deliver projects on time and on budget. Agile, risk management, and stakeholder leadership.',
    color: '#FBBF24',
    dimColor: '#1A0E00',
    textColor: '#FDE68A',
    skillIds: ['pjm-planning', 'pjm-agile', 'pjm-risk', 'pjm-communication', 'pjm-budget'],
  },
  {
    id: 'solutions-architect',
    name: 'Solutions Architect',
    title: 'Mastery in Progress',
    icon: '🏛️',
    description: 'Design end-to-end technical solutions. Systems design, cloud, integration, and reliability.',
    color: '#6366F1',
    dimColor: '#080A20',
    textColor: '#A5B4FC',
    skillIds: ['sa-systems-design', 'sa-cloud-arch', 'sa-integration', 'sa-security-arch', 'sa-cost-scalability'],
  },
  {
    id: 'software-architect',
    name: 'Software Architect',
    title: 'Mastery in Progress',
    icon: '🔷',
    description: 'Shape engineering decisions at scale. Design patterns, distributed systems, and tech leadership.',
    color: '#22C55E',
    dimColor: '#041A08',
    textColor: '#86EFAC',
    skillIds: ['arch-design-patterns', 'arch-distributed-systems', 'arch-api-design', 'arch-system-modeling', 'arch-tech-leadership'],
  },
  {
    id: 'mobile-developer',
    name: 'Mobile Developer',
    title: 'Mastery in Progress',
    icon: '📱',
    description: 'Build apps users love on iOS and Android. React Native, native APIs, and App Store launch.',
    color: '#EC4899',
    dimColor: '#1A0510',
    textColor: '#F9A8D4',
    skillIds: ['mob-ui-fundamentals', 'mob-react-native', 'mob-state-management', 'mob-native-apis', 'mob-app-store'],
  },
  {
    id: 'ui-ux-designer',
    name: 'UI/UX Designer',
    title: 'Mastery in Progress',
    icon: '✏️',
    description: 'Create intuitive, beautiful experiences. Research, wireframing, Figma, and design systems.',
    color: '#FB7185',
    dimColor: '#1A0508',
    textColor: '#FECDD3',
    skillIds: ['ux-fundamentals', 'ux-wireframing', 'ux-user-research', 'ux-figma', 'ux-design-thinking'],
  },
  {
    id: 'startup-founder',
    name: 'Startup Founder',
    title: 'Mastery in Progress',
    icon: '🚀',
    description: 'Build something from nothing. Validate ideas, ship MVPs, raise funding, and scale.',
    color: '#E879F9',
    dimColor: '#150520',
    textColor: '#F5D0FE',
    skillIds: ['sf-validation', 'sf-mvp', 'sf-growth', 'sf-fundraising', 'sf-operations'],
  },
];

export const ALL_SKILLS: Skill[] = [
  // ── Data Architect ──
  {
    id: 'sql-foundations',
    pathId: 'data-architect',
    name: 'SQL Foundations',
    description: 'Master SELECT, JOINs, CTEs, window functions, and query optimization.',
    icon: '🗄️',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
    whyItMatters: 'SQL is the universal language of data — every data role requires fluency in it.',
    outputExamples: [
      'Write a query comparing YoY revenue by region using window functions',
      'Build a CTE chain to de-duplicate a 1M-row customer table',
      'Create a dashboard query with rank, lag, and rolling averages',
    ],
    validationQuestions: [
      {
        prompt: 'Which SQL clause filters results AFTER aggregation?',
        choices: ['WHERE', 'HAVING', 'ORDER BY', 'DISTINCT'],
        correctIndex: 1,
        explanation: 'HAVING filters on aggregated values (e.g., HAVING SUM(sales) > 1000), while WHERE filters individual rows before grouping.',
      },
      {
        prompt: 'A CTE (Common Table Expression) is best described as:',
        choices: [
          'A permanent database view saved to disk',
          'A reusable named subquery defined at the top of a SQL statement',
          'A way to encrypt query results',
          'A method to partition large tables by date',
        ],
        correctIndex: 1,
        explanation: 'CTEs (WITH clauses) define a named result set used within the same query — cleaner than nested subqueries and not persisted to disk.',
      },
      {
        prompt: 'What does the window function RANK() return differently from DENSE_RANK()?',
        choices: [
          'RANK() skips numbers after ties (1,1,3), DENSE_RANK() does not (1,1,2)',
          'RANK() assigns sequential integers, DENSE_RANK() skips after ties',
          'They are identical — both skip after ties',
          'RANK() only works with ORDER BY, DENSE_RANK() does not',
        ],
        correctIndex: 0,
        explanation: 'RANK() leaves gaps after ties (1, 1, 3, 4...), DENSE_RANK() does not (1, 1, 2, 3...). Use DENSE_RANK when gaps would cause downstream issues.',
      },
    ],
  },
  {
    id: 'python-automation',
    pathId: 'data-architect',
    name: 'Python Automation',
    description: 'Build data pipelines, ETL scripts, and automation workflows in Python.',
    icon: '🐍',
    xpReward: 150,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['sql-foundations'],
    order: 2,
    whyItMatters: 'Python automation multiplies your impact — replace hours of manual work with a 20-line script.',
    outputExamples: [
      'Automate a CSV-to-Postgres ETL pipeline with error handling',
      'Write a script that pulls from an API and loads to a data warehouse',
      'Schedule a cron job to send daily data quality reports by email',
    ],
    validationQuestions: [
      {
        prompt: 'Which pandas method removes rows where all columns are duplicated?',
        choices: ['.unique()', '.drop_duplicates()', '.dropna()', '.dedup()'],
        correctIndex: 1,
        explanation: '.drop_duplicates() removes rows with identical values across specified (or all) columns. .unique() returns unique values from a Series, not a DataFrame method.',
      },
      {
        prompt: 'What does the "with open(path) as f:" pattern guarantee?',
        choices: [
          'The file is opened in read-only mode permanently',
          'The file is automatically closed when the block exits, even on exceptions',
          'The file is loaded entirely into memory',
          'The file is locked from other processes',
        ],
        correctIndex: 1,
        explanation: 'The context manager (with statement) calls __exit__ when the block ends, closing the file and releasing its handle — even if an exception is raised inside the block.',
      },
      {
        prompt: 'In pandas, what does .groupby("region").agg({"sales": "sum", "orders": "mean"}) return?',
        choices: [
          'Rows filtered where region matches',
          'A DataFrame with one row per region showing total sales and average orders',
          'A sorted DataFrame ordered by region',
          'An error — .agg() only accepts a single function',
        ],
        correctIndex: 1,
        explanation: '.agg() with a dict applies different aggregation functions to different columns in one pass, returning a DataFrame indexed by the groupby key.',
      },
    ],
  },
  {
    id: 'snowflake-engineering',
    pathId: 'data-architect',
    name: 'Snowflake Engineering',
    description: 'Design virtual warehouses, manage Snowflake architecture, and optimize cloud data operations.',
    icon: '❄️',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 3,
    prerequisites: ['python-automation'],
    order: 3,
    whyItMatters: 'Snowflake runs mission-critical warehouses at Fortune 500 companies — it\'s the most in-demand cloud data skill.',
    outputExamples: [
      'Design separate virtual warehouses for reporting vs. ingestion workloads',
      'Implement Snowflake data sharing between two accounts',
      'Write a stored procedure for incremental data loading with MERGE',
    ],
    validationQuestions: [
      {
        prompt: 'What uniquely separates Snowflake\'s architecture from traditional data warehouses?',
        choices: [
          'It uses GPU-accelerated query processing',
          'Compute and storage scale independently of each other',
          'It only runs on-premise behind a firewall',
          'It uses a proprietary non-SQL query language',
        ],
        correctIndex: 1,
        explanation: 'Snowflake\'s multi-cluster shared data architecture decouples compute (virtual warehouses) from storage. You can scale query power without copying data, and multiple warehouses can query the same data simultaneously.',
      },
      {
        prompt: 'Snowflake\'s Zero-Copy Clone creates:',
        choices: [
          'A full physical backup stored on separate cloud storage',
          'A metadata pointer to the same underlying data, with copy-on-write for any changes',
          'A read-only replica replicated to a different region',
          'An encrypted archive for compliance purposes',
        ],
        correctIndex: 1,
        explanation: 'Zero-Copy Clone creates an instant, storage-efficient clone. Both the original and clone share the same micro-partitions until one is modified — then only the changed partitions are duplicated.',
      },
      {
        prompt: 'What is the purpose of separate virtual warehouses for ETL vs. reporting workloads?',
        choices: [
          'It reduces Snowflake licensing costs',
          'It prevents query contention so heavy ETL loads don\'t slow down analyst dashboards',
          'It is required by Snowflake to use the platform',
          'It allows different SQL dialects per warehouse',
        ],
        correctIndex: 1,
        explanation: 'Workload isolation via separate virtual warehouses means a heavy nightly ETL job won\'t compete for compute with ad-hoc analyst queries. Each warehouse can also be sized and auto-suspended independently.',
      },
    ],
  },
  {
    id: 'data-modeling',
    pathId: 'data-architect',
    name: 'Data Modeling',
    description: 'Build dimensional models, star/snowflake schemas, and design data warehouses.',
    icon: '📐',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['python-automation'],
    order: 4,
    whyItMatters: 'Good data models make reports 10x faster to build and 10x easier for stakeholders to trust.',
    outputExamples: [
      'Build a star schema for a retail sales data mart (fact + 4 dimensions)',
      'Design a Type 2 slowly changing dimension table for customer history',
      'Create an ERD and data dictionary for a SaaS subscription business',
    ],
    validationQuestions: [
      {
        prompt: 'In a star schema, which table type stores measurable events like sales transactions?',
        choices: ['Dimension table', 'Fact table', 'Bridge table', 'Staging table'],
        correctIndex: 1,
        explanation: 'Fact tables store quantitative, measurable events (sales amount, quantity, order count) and hold foreign keys to dimension tables. Dimension tables store descriptive attributes (customer name, product category, date).',
      },
      {
        prompt: 'A Slowly Changing Dimension Type 2 (SCD2) handles historical changes by:',
        choices: [
          'Overwriting the old row with the new value',
          'Adding a new row with effective start/end dates to preserve the full history',
          'Storing only the 3 most recent versions of each record',
          'Deleting and re-inserting the record each time it changes',
        ],
        correctIndex: 1,
        explanation: 'SCD Type 2 inserts a new row for each change, with effective_date and expiry_date columns (or an is_current flag) so you can query any historical snapshot. Type 1 overwrites; Type 3 stores only the previous value.',
      },
      {
        prompt: 'What does "grain" mean when defining a fact table?',
        choices: [
          'The physical storage format (Parquet, ORC, etc.)',
          'The precise level of detail each row represents',
          'The number of dimension tables connected to the fact',
          'The indexing strategy on the primary key',
        ],
        correctIndex: 1,
        explanation: 'Grain defines what one row means — e.g., "one row per customer order line item." Declaring grain first prevents mixing different levels of detail in the same fact table, which causes incorrect aggregations.',
      },
    ],
  },
  {
    id: 'ai-workflow-design',
    pathId: 'data-architect',
    name: 'AI Workflow Design',
    description: 'Integrate AI into data pipelines. Design intelligent, automated data workflows.',
    icon: '🧠',
    xpReward: 350,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['snowflake-engineering', 'data-modeling'],
    order: 5,
    whyItMatters: 'AI-native data pipelines are the next frontier — this skill will define the data architect role for the next decade.',
    outputExamples: [
      'Build a pipeline that triggers an LLM to classify and route support tickets',
      'Design a DAG that pulls raw data, enriches with AI, and writes to a data mart',
      'Build an anomaly detection workflow using an ML model on streaming events',
    ],
    validationQuestions: [
      {
        prompt: 'What is the primary role of an orchestration layer in an AI pipeline?',
        choices: [
          'To fine-tune the LLM on new training data',
          'To coordinate and sequence multi-step AI tasks, tools, and data flows',
          'To store and index vector embeddings',
          'To render the end-user interface',
        ],
        correctIndex: 1,
        explanation: 'Orchestration (e.g., Airflow, Prefect, LangGraph) manages the execution order, error handling, and dependencies between steps in a pipeline — LLM calls, API requests, data transforms, and storage writes.',
      },
      {
        prompt: 'Chain-of-thought prompting improves LLM accuracy primarily by:',
        choices: [
          'Increasing the model\'s temperature setting',
          'Prompting the model to reason step-by-step before producing its final answer',
          'Fine-tuning the model weights on domain-specific data',
          'Restricting the model to a fixed output format',
        ],
        correctIndex: 1,
        explanation: 'Chain-of-thought prompting (e.g., "Let\'s think step by step") causes the model to generate intermediate reasoning tokens, which dramatically improves accuracy on multi-step reasoning, math, and classification tasks.',
      },
      {
        prompt: 'What is a guardrail in a production AI workflow?',
        choices: [
          'A Kubernetes pod health check for the model server',
          'A validation layer that filters or enforces rules on AI inputs and outputs',
          'A rate-limiting mechanism for API calls to the LLM provider',
          'A type of model checkpoint for rollback',
        ],
        correctIndex: 1,
        explanation: 'Guardrails (e.g., NeMo Guardrails, custom validators) sit around the LLM to block harmful inputs, enforce output schemas, detect hallucinations, or ensure responses stay on-topic for enterprise use cases.',
      },
    ],
  },
  // ── AI Engineer ──
  {
    id: 'python-fundamentals',
    pathId: 'ai-engineer',
    name: 'Python Fundamentals',
    description: 'Python syntax, data structures, OOP, and building useful CLI tools.',
    icon: '🐍',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
    whyItMatters: 'Python is the language of AI — you cannot build AI applications without it.',
    outputExamples: [
      'Build a CLI weather app that pulls from a public API',
      'Write an OOP inventory tracker with file-based persistence',
      'Create a script that scrapes a site and exports clean data to CSV',
    ],
    validationQuestions: [
      {
        prompt: 'What does a Python decorator do to the function it wraps?',
        choices: [
          'Permanently modifies the original function\'s bytecode',
          'Wraps the function to extend or modify its behavior without changing its source',
          'Imports it from an external module at runtime',
          'Converts it into an async coroutine',
        ],
        correctIndex: 1,
        explanation: 'Decorators use the @wrapper syntax to apply a higher-order function. The original function\'s source is unchanged — the decorator returns a new function that adds behavior (logging, caching, auth checks, etc.).',
      },
      {
        prompt: 'What is the key difference between a Python generator and a regular function?',
        choices: [
          'Generators are faster because they compile to C extensions',
          'Generators yield values lazily one at a time instead of returning a complete collection at once',
          'Generators run in a separate background thread automatically',
          'Generators can only return integers and strings',
        ],
        correctIndex: 1,
        explanation: 'A generator uses "yield" instead of "return." Each call to next() resumes execution until the next yield. This is memory-efficient for large sequences — you never build the full list in memory.',
      },
      {
        prompt: 'A closure in Python is a function that:',
        choices: [
          'Closes (terminates) early using a return statement',
          'Retains access to variables from its enclosing scope even after that scope has finished executing',
          'Imports variables from a parent module',
          'Defines a class without using the class keyword',
        ],
        correctIndex: 1,
        explanation: 'Closures "close over" free variables from their enclosing scope. This enables patterns like factory functions, decorators, and callbacks that carry state without global variables.',
      },
    ],
  },
  {
    id: 'rest-apis',
    pathId: 'ai-engineer',
    name: 'REST APIs & Integration',
    description: 'Build and consume REST APIs. Work with JSON, webhooks, and third-party services.',
    icon: '🔌',
    xpReward: 150,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['python-fundamentals'],
    order: 2,
    whyItMatters: 'Every AI product communicates with external services — REST fluency is non-negotiable.',
    outputExamples: [
      'Build a FastAPI endpoint that serves ML model predictions',
      'Write a Python client that wraps the GitHub or Stripe API',
      'Create a webhook handler that processes Slack messages and auto-replies',
    ],
    validationQuestions: [
      {
        prompt: 'Which HTTP status code should a POST endpoint return when a resource is successfully created?',
        choices: ['200 OK', '201 Created', '204 No Content', '302 Found'],
        correctIndex: 1,
        explanation: '201 Created signals that the request succeeded AND a new resource was created. The response should also include a Location header pointing to the new resource\'s URL.',
      },
      {
        prompt: 'What does idempotency mean for an HTTP method?',
        choices: [
          'The method always returns a cached response',
          'Calling it multiple times with the same input produces the same result as calling it once',
          'The method requires authentication on every call',
          'The response is always compressed with gzip',
        ],
        correctIndex: 1,
        explanation: 'PUT, DELETE, and GET are idempotent — repeating the same request has no additional effect. POST is NOT idempotent (creates a new resource each time). Idempotency is critical for safe retries in distributed systems.',
      },
      {
        prompt: 'Which HTTP method should be used to partially update a resource (e.g., update only a user\'s email)?',
        choices: ['PUT', 'POST', 'PATCH', 'DELETE'],
        correctIndex: 2,
        explanation: 'PATCH applies a partial update to a resource. PUT replaces the entire resource. Using PUT for partial updates requires sending all fields, even unchanged ones, which wastes bandwidth and risks accidental overwrites.',
      },
    ],
  },
  {
    id: 'prompt-engineering',
    pathId: 'ai-engineer',
    name: 'Prompt Engineering',
    description: 'Master systematic prompting: chain-of-thought, few-shot, structured outputs, and evaluation.',
    icon: '✍️',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['rest-apis'],
    order: 3,
    whyItMatters: 'Prompting is the difference between a flaky GPT-4 demo and a reliable production feature.',
    outputExamples: [
      'Build a chain-of-thought system that outputs structured JSON from unstructured text',
      'Write an evaluation rubric and test 5 prompt variants against it with scoring',
      'Create a few-shot classifier that categorizes support tickets into 10 categories',
    ],
    validationQuestions: [
      {
        prompt: 'What does the "temperature" parameter control in LLM generation?',
        choices: [
          'The GPU\'s processing heat and speed',
          'How randomly or deterministically the model samples the next token',
          'The maximum number of tokens in the response',
          'How many examples are included in the prompt',
        ],
        correctIndex: 1,
        explanation: 'Temperature scales the logit distribution before sampling. Low temp (0.0–0.3) = deterministic/conservative. High temp (0.8–1.2) = creative/varied. Use low temp for classification and structured output, high temp for brainstorming.',
      },
      {
        prompt: 'Few-shot prompting improves model accuracy primarily by:',
        choices: [
          'Increasing the model\'s temperature for more varied outputs',
          'Showing the model input-output examples that demonstrate the expected pattern',
          'Fine-tuning the model weights on domain-specific examples at inference time',
          'Restricting the model to only output JSON',
        ],
        correctIndex: 1,
        explanation: 'Few-shot prompting includes 2–10 examples of (input → desired output) in the prompt. The model\'s in-context learning ability means it generalizes the pattern without any weight updates — no fine-tuning required.',
      },
      {
        prompt: 'A system prompt is best described as:',
        choices: [
          'The user\'s question sent to the model',
          'Persistent instructions that define the model\'s role, constraints, and behavior for the session',
          'The full conversation history passed to the API',
          'A way to set the model\'s sampling temperature',
        ],
        correctIndex: 1,
        explanation: 'The system prompt (or "system message") is processed before the user turn and stays constant throughout the conversation. It sets persona, tone, output format, domain restrictions, and safety rules.',
      },
    ],
  },
  {
    id: 'vector-databases',
    pathId: 'ai-engineer',
    name: 'Vector Databases',
    description: 'Build semantic search with Pinecone, Weaviate, or pgvector. Master embeddings.',
    icon: '🔮',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['rest-apis'],
    order: 4,
    whyItMatters: 'Vector search powers every modern AI assistant and recommendation engine — it\'s the backbone of AI apps.',
    outputExamples: [
      'Build a semantic search engine over 1,000 documents using Pinecone',
      'Implement embedding-based deduplication on a product catalog',
      'Create a nearest-neighbor movie recommender using pgvector',
    ],
    validationQuestions: [
      {
        prompt: 'A vector embedding is best described as:',
        choices: [
          'A compressed image format used for model training',
          'A dense numerical array that captures the semantic meaning of data in a multi-dimensional space',
          'A type of SQL index for full-text search',
          'A hashing algorithm used for deduplication',
        ],
        correctIndex: 1,
        explanation: 'Embedding models (e.g., OpenAI ada-002, Cohere) map text, images, or other data to high-dimensional vectors where semantically similar items cluster together. This enables "find me things that mean the same thing."',
      },
      {
        prompt: 'Which similarity metric is most commonly used for semantic text similarity?',
        choices: ['Euclidean distance', 'Manhattan distance', 'Cosine similarity', 'Jaccard index'],
        correctIndex: 2,
        explanation: 'Cosine similarity measures the angle between two vectors, ignoring their magnitude. This makes it robust for text — a short sentence and a long paragraph on the same topic will have a high cosine similarity.',
      },
      {
        prompt: 'Approximate Nearest Neighbor (ANN) search trades off _____ for _____ compared to exact nearest neighbor.',
        choices: [
          'Speed for storage — ANN uses more memory',
          'A small amount of recall accuracy for dramatically faster search at scale',
          'Determinism for parallelism — ANN results are random',
          'Precision for simplicity — ANN has fewer hyperparameters',
        ],
        correctIndex: 1,
        explanation: 'ANN algorithms (HNSW, IVF, LSH) can search millions of vectors in milliseconds by sacrificing a small % of accuracy. Exact k-NN is O(n) and impractical at scale. In practice, 95–99% recall is sufficient for semantic search.',
      },
    ],
  },
  {
    id: 'rag-systems',
    pathId: 'ai-engineer',
    name: 'RAG Systems',
    description: 'Build Retrieval-Augmented Generation pipelines. LangChain, chunking, retrieval strategies.',
    icon: '🤖',
    xpReward: 300,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['prompt-engineering', 'vector-databases'],
    order: 5,
    whyItMatters: 'RAG is how companies deploy AI on private data — it is the production standard at every serious AI team.',
    outputExamples: [
      'Build a chatbot that answers questions from a company PDF knowledge base',
      'Implement hybrid search (keyword + semantic) over a document library',
      'Create a multi-hop RAG pipeline that cites specific source passages',
    ],
    validationQuestions: [
      {
        prompt: 'What core problem does RAG solve compared to using a base LLM alone?',
        choices: [
          'RAG makes the model generate responses faster',
          'RAG grounds responses in specific, private, or up-to-date knowledge the base model wasn\'t trained on',
          'RAG improves the model\'s general reasoning ability',
          'RAG enables the model to generate images and code simultaneously',
        ],
        correctIndex: 1,
        explanation: 'Base LLMs only know what was in their training data (with a cutoff date). RAG retrieves relevant context from your private documents at query time, so the model can answer questions about internal data without expensive fine-tuning.',
      },
      {
        prompt: 'Why does chunking strategy matter in a RAG pipeline?',
        choices: [
          'Smaller chunks are always better — use the smallest possible',
          'Chunk size and overlap affect how precisely and relevantly context is retrieved for each query',
          'Chunking only matters for image data, not text',
          'All documents must be the same chunk size for the vector index to work',
        ],
        correctIndex: 1,
        explanation: 'Too-small chunks lose context (a sentence without surrounding paragraph). Too-large chunks add noise (many irrelevant sentences). Chunk overlap (e.g., 20%) prevents splitting ideas at boundaries. The right chunk size depends on your document structure and query type.',
      },
      {
        prompt: 'What is "hybrid search" in a RAG system?',
        choices: [
          'Running the same query against two different LLMs and merging results',
          'Combining semantic (vector) search with keyword (BM25/TF-IDF) search and re-ranking the results',
          'Searching across both text and image content in the same index',
          'Using two separate vector databases for redundancy',
        ],
        correctIndex: 1,
        explanation: 'Hybrid search combines dense (semantic) retrieval with sparse (keyword) retrieval, then re-ranks results. It outperforms either method alone — semantic search finds conceptually similar content, keyword search catches exact matches (product codes, names, acronyms).',
      },
    ],
  },
  {
    id: 'ai-agents',
    pathId: 'ai-engineer',
    name: 'AI Agents',
    description: 'Build autonomous AI agents with tool use, planning, and multi-step reasoning.',
    icon: '🦾',
    xpReward: 400,
    rarity: 'legendary',
    requiredOutputs: 3,
    prerequisites: ['rag-systems'],
    order: 6,
    whyItMatters: 'Agents are the next leap in AI — from models that answer to systems that act autonomously.',
    outputExamples: [
      'Build a research agent that searches the web and synthesizes a structured report',
      'Create a coding agent that writes, runs, and debugs Python scripts in a loop',
      'Implement a multi-agent system with a planner, executor, and critic',
    ],
    validationQuestions: [
      {
        prompt: 'What is "tool use" in an AI agent framework?',
        choices: [
          'Training the model on a new dataset of tool-use examples',
          'Enabling the model to call external APIs, functions, or services to take real-world actions',
          'A method to reduce LLM hallucinations through RLHF',
          'Loading pre-built model weights from a model hub',
        ],
        correctIndex: 1,
        explanation: 'Tool use (function calling) lets the agent execute code, call APIs, search the web, read files, or query databases. The model decides when and how to call each tool, then uses the result to continue reasoning.',
      },
      {
        prompt: 'In a ReAct (Reason + Act) agent loop, what is the correct sequence?',
        choices: [
          'Request → API call → Cache the result',
          'Read input → Append to history → Confirm with user',
          'The model reasons about what to do, executes a tool call, observes the result, then reasons again',
          'Three separate phases of model fine-tuning: reasoning, action, critique',
        ],
        correctIndex: 2,
        explanation: 'ReAct interleaves reasoning traces ("I need to find the current price...") with action execution ("search(query=...)") and observation ("the result is $42"). This loop continues until the agent produces a final answer.',
      },
      {
        prompt: 'Why is context window management critical for long-running AI agents?',
        choices: [
          'It directly reduces GPU memory usage during inference',
          'As agent steps accumulate, critical early information can be truncated or lost if the conversation exceeds the model\'s token limit',
          'Context windows can only be extended with model fine-tuning',
          'It\'s only relevant for multi-modal agents working with images',
        ],
        correctIndex: 1,
        explanation: 'Each agent step adds tokens (thoughts, tool calls, results). Without management, important instructions or earlier findings get pushed out of the context window. Strategies include summarization, memory extraction, and sliding-window approaches.',
      },
    ],
  },
  // ── Full Stack ──
  {
    id: 'html-css',
    pathId: 'fullstack',
    name: 'HTML & CSS',
    description: 'Semantic HTML, CSS layouts (Flexbox, Grid), responsive design, and animations.',
    icon: '🎨',
    xpReward: 75,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
    whyItMatters: 'HTML/CSS is the foundation every frontend engineer builds on — mastering the basics makes everything else faster.',
    outputExamples: [
      'Build a responsive portfolio page using Flexbox and CSS Grid',
      'Recreate a Dribbble design pixel-perfectly in pure HTML/CSS',
      'Implement a smooth CSS animation system for page transitions',
    ],
    validationQuestions: [
      {
        prompt: 'Which CSS property distributes flex children along the main axis?',
        choices: ['align-items', 'flex-direction', 'justify-content', 'flex-wrap'],
        correctIndex: 2,
        explanation: 'justify-content controls alignment along the main axis (horizontal in row layout): flex-start, center, flex-end, space-between, space-around. align-items controls the cross-axis (vertical in row layout).',
      },
      {
        prompt: 'CSS specificity determines:',
        choices: [
          'The visual z-index stacking order of elements',
          'Which CSS rule wins when multiple rules target the same element',
          'The order in which HTML elements render on screen',
          'Whether CSS transitions or animations take priority',
        ],
        correctIndex: 1,
        explanation: 'Specificity is calculated as (inline styles > IDs > classes/attributes/pseudo-classes > elements). When two rules conflict, the higher specificity wins. When equal, the later rule in the stylesheet wins (cascade).',
      },
      {
        prompt: 'The primary purpose of semantic HTML elements like <article>, <nav>, and <main> is:',
        choices: [
          'They apply default CSS styles that <div> doesn\'t provide',
          'They convey meaning to browsers, screen readers, and search engines, improving accessibility and SEO',
          'They load faster than <div> elements in modern browsers',
          'They are required for React and Vue components to render correctly',
        ],
        correctIndex: 1,
        explanation: 'Semantic HTML tells machines what content means (not just how it looks). Screen readers announce <nav> as navigation and <main> as primary content. Search engines weight <article> content differently. <div> has no semantic meaning.',
      },
    ],
  },
  {
    id: 'javascript',
    pathId: 'fullstack',
    name: 'JavaScript',
    description: 'ES6+, async/await, DOM manipulation, fetch API, and modern JS patterns.',
    icon: '⚡',
    xpReward: 125,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['html-css'],
    order: 2,
    whyItMatters: 'JS runs everywhere — browser, server, and mobile. It is the most versatile skill in modern tech.',
    outputExamples: [
      'Build a personal budget tracker with DOM manipulation and local storage',
      'Write a data fetching layer with async/await, retry logic, and error handling',
      'Create a drag-and-drop Kanban interface without any libraries',
    ],
    validationQuestions: [
      {
        prompt: 'What is a JavaScript closure?',
        choices: [
          'A syntax for terminating a function early with a return value',
          'A function that retains access to its enclosing scope\'s variables even after that scope has finished executing',
          'A built-in method for deep-copying objects',
          'An ES6 arrow function shorthand for anonymous functions',
        ],
        correctIndex: 1,
        explanation: 'Closures "remember" the environment they were created in. Every time you create a function inside another function, the inner function closes over the outer variables. This powers patterns like factory functions, event handlers, and module patterns.',
      },
      {
        prompt: 'What does Promise.all([p1, p2, p3]) do?',
        choices: [
          'Runs each promise sequentially, waiting for one to finish before starting the next',
          'Runs all promises concurrently and resolves with an array of all results when ALL complete',
          'Returns the first promise to resolve and ignores the others',
          'Automatically retries any failed promise up to 3 times',
        ],
        correctIndex: 1,
        explanation: 'Promise.all() launches all promises concurrently (faster than sequential await). It resolves when ALL resolve, or rejects immediately if ANY rejects. Use Promise.allSettled() to handle mixed success/failure results.',
      },
      {
        prompt: 'What causes the JavaScript event loop to "block"?',
        choices: [
          'Using async/await for network requests',
          'Running long synchronous operations that prevent the loop from processing other tasks or UI updates',
          'Adding too many event listeners to DOM elements',
          'Making multiple fetch() requests simultaneously',
        ],
        correctIndex: 1,
        explanation: 'JavaScript is single-threaded. Long synchronous work (heavy loops, complex computations, large JSON.parse) monopolizes the call stack, freezing the UI and delaying timer callbacks. Use Web Workers or break work into async chunks to avoid blocking.',
      },
    ],
  },
  {
    id: 'react-rn',
    pathId: 'fullstack',
    name: 'React & React Native',
    description: 'Hooks, state management, component architecture, and cross-platform mobile development.',
    icon: '⚛️',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 3,
    prerequisites: ['javascript'],
    order: 3,
    whyItMatters: 'React powers 40%+ of web apps and React Native runs on iOS/Android — one skill, every platform.',
    outputExamples: [
      'Build a Kanban board with drag-and-drop using React and Zustand',
      'Publish a cross-platform to-do app to Expo Go with offline support',
      'Create a reusable component library with TypeScript and Storybook',
    ],
    validationQuestions: [
      {
        prompt: 'useEffect with an empty dependency array [] executes:',
        choices: [
          'On every re-render of the component',
          'Before the component first renders (like componentWillMount)',
          'Once after the initial render, equivalent to componentDidMount',
          'Only when a parent component re-renders',
        ],
        correctIndex: 2,
        explanation: 'An empty [] dependency array means "no dependencies" — the effect runs once after mount and cleans up on unmount. Omitting the array runs the effect after every render. Adding specific values runs it when those values change.',
      },
      {
        prompt: 'What is the purpose of React\'s useMemo hook?',
        choices: [
          'To persist state values across page refreshes and navigation',
          'To memoize an expensive computed value so it isn\'t recalculated on every render',
          'To manage side effects like data fetching and subscriptions',
          'To replace useCallback for memoizing event handler functions',
        ],
        correctIndex: 1,
        explanation: 'useMemo(() => expensiveCalc(a, b), [a, b]) caches the result and only recomputes when a or b changes. Use it when a computation is genuinely expensive. Overusing useMemo adds overhead — profile first.',
      },
      {
        prompt: '"Lifting state up" in React means:',
        choices: [
          'Moving component state into a global Redux or Zustand store',
          'Moving shared state to the lowest common ancestor of the components that need it',
          'Using React.memo to prevent prop drilling through the component tree',
          'Initializing state at the module level outside of any component',
        ],
        correctIndex: 1,
        explanation: 'When two sibling components need the same state, you lift it to their shared parent, then pass it down as props. This is the fundamental composition pattern in React before reaching for global state management.',
      },
    ],
  },
  {
    id: 'backend-apis',
    pathId: 'fullstack',
    name: 'Backend APIs',
    description: 'Node.js/Express or FastAPI. REST design, JWT auth, rate limiting, and middleware.',
    icon: '🔧',
    xpReward: 225,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['javascript'],
    order: 4,
    whyItMatters: 'Backend APIs are the plumbing of every product — without them, there is no data, auth, or business logic.',
    outputExamples: [
      'Build a REST API with JWT auth, role-based access, and rate limiting',
      'Implement OAuth 2.0 login with GitHub or Google',
      'Create a file upload endpoint with validation, storage, and CDN delivery',
    ],
    validationQuestions: [
      {
        prompt: 'What is Express middleware in a Node.js application?',
        choices: [
          'A frontend rendering engine for server-side HTML',
          'A function in the request-response pipeline that processes requests before they reach a route handler',
          'A database connection pool manager',
          'A type of HTTP method like GET or POST',
        ],
        correctIndex: 1,
        explanation: 'Middleware functions have access to req, res, and next(). They run in sequence — logging, auth checks, input parsing, rate limiting — before the final route handler. Call next() to pass to the next middleware or next(err) to trigger error handling.',
      },
      {
        prompt: 'What does a JWT (JSON Web Token) consist of?',
        choices: [
          'A session ID and expiry timestamp stored in the database',
          'Three Base64-encoded parts: header, payload, and signature, separated by dots',
          'An encrypted database row containing user credentials',
          'A hashed password and random salt concatenated together',
        ],
        correctIndex: 1,
        explanation: 'JWT = header.payload.signature. The header specifies the algorithm (RS256, HS256). The payload carries claims (user ID, roles, expiry). The signature verifies integrity. JWTs are stateless — the server doesn\'t need a session database.',
      },
      {
        prompt: 'Which HTTP method should be used to partially update a resource (e.g., update only a user\'s display name)?',
        choices: ['PUT', 'POST', 'PATCH', 'UPDATE'],
        correctIndex: 2,
        explanation: 'PATCH sends only the fields that changed. PUT replaces the entire resource — omitting a field might clear it. UPDATE is not a valid HTTP method. Use PATCH for efficient partial updates to avoid accidentally overwriting fields.',
      },
    ],
  },
  {
    id: 'database-design',
    pathId: 'fullstack',
    name: 'Database Design',
    description: 'PostgreSQL, migrations, indexing, query optimization, and ORM patterns.',
    icon: '🗃️',
    xpReward: 275,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['backend-apis'],
    order: 5,
    whyItMatters: 'Bad database design causes outages and data loss — good design is what separates senior from junior engineers.',
    outputExamples: [
      'Design a normalized PostgreSQL schema for a multi-tenant SaaS app',
      'Write migrations that add indexes and backfill data without downtime',
      'Implement full-text search on a posts table using tsvector and tsquery',
    ],
    validationQuestions: [
      {
        prompt: 'What does First Normal Form (1NF) require of a relational table?',
        choices: [
          'Every table must have a single-column primary key',
          'Each column must contain atomic (indivisible) values with no repeating groups or arrays',
          'All foreign keys must reference a row that currently exists',
          'Column names must be unique across the entire database',
        ],
        correctIndex: 1,
        explanation: '1NF eliminates repeating groups and multi-valued columns. Instead of a "phones" column with multiple phone numbers, you create a separate phones table with a foreign key. This is the foundation all other normal forms build on.',
      },
      {
        prompt: 'Why does adding a database index improve read speed but hurt write speed?',
        choices: [
          'Indexes compress table data, requiring decompression on writes',
          'Indexes maintain a pre-sorted data structure that must be updated on every INSERT, UPDATE, and DELETE',
          'Indexes disable ACID transactions on indexed tables',
          'Indexes duplicate the entire table as a shadow copy',
        ],
        correctIndex: 1,
        explanation: 'An index (B-tree, etc.) is a separate data structure maintained alongside the table. Reads are fast (O(log n) vs. O(n) table scan). But every write must update both the table AND all its indexes — more indexes = slower writes.',
      },
      {
        prompt: 'In ACID transactions, "Isolation" guarantees that:',
        choices: [
          'Committed data is permanently written to disk even after a crash',
          'Concurrent transactions don\'t see each other\'s intermediate (uncommitted) states',
          'The database enforces all foreign key and uniqueness constraints',
          'Incomplete transactions are rolled back entirely on failure',
        ],
        correctIndex: 1,
        explanation: 'Isolation prevents dirty reads, non-repeatable reads, and phantom reads. Different isolation levels (READ COMMITTED, REPEATABLE READ, SERIALIZABLE) trade performance for strictness. Without isolation, concurrent users could see half-updated data.',
      },
    ],
  },
  {
    id: 'cloud-deployment',
    pathId: 'fullstack',
    name: 'Cloud Deployment',
    description: 'Docker, CI/CD pipelines, AWS/GCP/Railway deployment, and production monitoring.',
    icon: '☁️',
    xpReward: 300,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['database-design'],
    order: 6,
    whyItMatters: 'Shipping to production is the goal — cloud deployment is the final mile that turns code into a real product.',
    outputExamples: [
      'Dockerize a Node app and deploy to Railway with a CI/CD pipeline',
      'Set up GitHub Actions to run tests, lint, and deploy on every merged PR',
      'Configure a load balancer and auto-scaling group on AWS EC2',
    ],
    validationQuestions: [
      {
        prompt: 'What problem do containers (like Docker) primarily solve?',
        choices: [
          'They eliminate the need for a CI/CD pipeline by building automatically',
          'They ensure the application runs identically across development, staging, and production environments',
          'They automatically scale the application based on traffic',
          'They are a faster replacement for virtual machines in all cases',
        ],
        correctIndex: 1,
        explanation: '"It works on my machine" is eliminated by containers. A Docker image bundles the app, runtime, dependencies, and config together. The same image that passes CI runs in production — no environment-specific surprises.',
      },
      {
        prompt: 'A CI/CD pipeline is best described as:',
        choices: [
          'A cloud storage system for build artifacts and releases',
          'An automated workflow that builds, tests, and deploys code on every commit or merge',
          'A container orchestration tool like Kubernetes',
          'A method for managing database schema migrations in production',
        ],
        correctIndex: 1,
        explanation: 'CI (Continuous Integration) automatically runs tests and checks on every commit. CD (Continuous Delivery/Deployment) automatically deploys passing builds to staging or production. Together they shorten the feedback loop from code to running software.',
      },
      {
        prompt: 'Horizontal scaling vs. vertical scaling: which is preferred for stateless web services and why?',
        choices: [
          'Vertical — adding CPU/RAM to one server is simpler and cheaper',
          'Horizontal — adding more server instances distributes load and avoids single-points-of-failure',
          'They are identical in practice for modern cloud workloads',
          'Vertical for reads, horizontal for writes',
        ],
        correctIndex: 1,
        explanation: 'Horizontal scaling (more instances) enables high availability (one instance failing doesn\'t take down the service) and elasticity (scale out for traffic spikes, scale in to save cost). Vertical scaling hits hardware limits and creates a SPOF.',
      },
    ],
  },
  // ── Data Engineer ──
  {
    id: 'de-python-data',
    pathId: 'data-engineer',
    name: 'Python for Data Engineering',
    description: 'pandas, numpy, data manipulation, file I/O, and building data transformation scripts.',
    icon: '🐍',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'de-sql-advanced',
    pathId: 'data-engineer',
    name: 'Advanced SQL & Data Warehousing',
    description: 'Complex JOINs, window functions, CTEs, partitioning, and dimensional modeling.',
    icon: '🗄️',
    xpReward: 150,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['de-python-data'],
    order: 2,
  },
  {
    id: 'de-spark-processing',
    pathId: 'data-engineer',
    name: 'Apache Spark & Batch Processing',
    description: 'Distributed data processing, DataFrames, RDDs, and large-scale batch jobs.',
    icon: '⚡',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 3,
    prerequisites: ['de-sql-advanced'],
    order: 3,
  },
  {
    id: 'de-airflow-pipelines',
    pathId: 'data-engineer',
    name: 'Airflow & Pipeline Orchestration',
    description: 'Build and schedule DAGs with Airflow. Dependency management and failure handling.',
    icon: '🔄',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['de-sql-advanced'],
    order: 4,
  },
  {
    id: 'de-kafka-streaming',
    pathId: 'data-engineer',
    name: 'Kafka & Real-Time Streaming',
    description: 'Event-driven pipelines, Kafka producers/consumers, and real-time data processing.',
    icon: '📡',
    xpReward: 350,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['de-spark-processing', 'de-airflow-pipelines'],
    order: 5,
  },
  // ── ML Engineer ──
  {
    id: 'ml-python-stats',
    pathId: 'ml-engineer',
    name: 'Python & Statistics Foundations',
    description: 'numpy, scipy, probability distributions, hypothesis testing, and statistical reasoning.',
    icon: '📐',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
    whyItMatters: 'Statistics is the engine under every ML model — without it you are tuning knobs you don\'t understand.',
    outputExamples: [
      'Run a hypothesis test to compare two A/B test conversion rates with confidence intervals',
      'Visualize distributions of a dataset and identify outliers using numpy and matplotlib',
      'Write a Python notebook explaining the central limit theorem with simulations',
    ],
  },
  {
    id: 'ml-sklearn-algorithms',
    pathId: 'ml-engineer',
    name: 'ML Algorithms & scikit-learn',
    description: 'Supervised and unsupervised learning: regression, classification, clustering, evaluation.',
    icon: '🤖',
    xpReward: 175,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['ml-python-stats'],
    order: 2,
    whyItMatters: 'scikit-learn is the industry workhorse for classical ML — mastering it opens 80% of real ML job tasks.',
    outputExamples: [
      'Build a churn prediction classifier with Random Forest and evaluate with precision/recall',
      'Implement k-means clustering on customer data and visualize segment profiles',
      'Train a regression model on housing data and interpret feature importance with SHAP',
    ],
  },
  {
    id: 'ml-deep-learning',
    pathId: 'ml-engineer',
    name: 'Deep Learning & Neural Networks',
    description: 'PyTorch or TensorFlow, CNNs, RNNs, transformers, and training strategies.',
    icon: '🧠',
    xpReward: 300,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['ml-sklearn-algorithms'],
    order: 3,
    whyItMatters: 'Deep learning powers image recognition, NLP, and recommendation systems — the frontier of AI applications.',
    outputExamples: [
      'Train a CNN to classify images from CIFAR-10 with >85% accuracy using PyTorch',
      'Fine-tune a pre-trained BERT model on a custom text classification dataset',
      'Build an LSTM time-series forecaster for stock price or weather data',
    ],
  },
  {
    id: 'ml-mlops',
    pathId: 'ml-engineer',
    name: 'MLOps & Model Deployment',
    description: 'MLflow experiment tracking, model registries, Docker serving, and monitoring in production.',
    icon: '🚀',
    xpReward: 275,
    rarity: 'rare',
    requiredOutputs: 3,
    prerequisites: ['ml-sklearn-algorithms'],
    order: 4,
    whyItMatters: 'A model that isn\'t deployed is just a research project — MLOps is what turns ML into product value.',
    outputExamples: [
      'Track 5 experiment runs in MLflow and promote the best model to the model registry',
      'Dockerize a scikit-learn model and serve it via a FastAPI endpoint',
      'Set up data drift monitoring on a deployed model using Evidently AI',
    ],
  },
  {
    id: 'ml-feature-engineering',
    pathId: 'ml-engineer',
    name: 'Feature Engineering & Model Evaluation',
    description: 'Feature selection, encoding, cross-validation, bias-variance tradeoff, and model interpretability.',
    icon: '🔬',
    xpReward: 350,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['ml-deep-learning', 'ml-mlops'],
    order: 5,
    whyItMatters: 'Feature engineering often matters more than model choice — the best ML engineers spend 70% of their time here.',
    outputExamples: [
      'Apply target encoding, binning, and interaction features to a tabular dataset and measure AUC lift',
      'Use SHAP values to explain individual predictions on a black-box model',
      'Run a stratified k-fold cross-validation pipeline and compare bias-variance across models',
    ],
  },
  // ── Backend Engineer ──
  {
    id: 'be-language-core',
    pathId: 'backend-engineer',
    name: 'Python or Node.js Core',
    description: 'Language fundamentals, async patterns, OOP, and building CLI tools.',
    icon: '💻',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'be-rest-design',
    pathId: 'backend-engineer',
    name: 'REST API Design',
    description: 'RESTful conventions, versioning, error handling, pagination, and OpenAPI documentation.',
    icon: '🔌',
    xpReward: 150,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['be-language-core'],
    order: 2,
  },
  {
    id: 'be-database-optimization',
    pathId: 'backend-engineer',
    name: 'Database Design & Optimization',
    description: 'Schema design, indexing strategies, query optimization, and ORM patterns.',
    icon: '🗃️',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['be-rest-design'],
    order: 3,
  },
  {
    id: 'be-auth-security',
    pathId: 'backend-engineer',
    name: 'Authentication & Security',
    description: 'JWT, OAuth 2.0, session management, OWASP top 10, and rate limiting.',
    icon: '🔒',
    xpReward: 225,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['be-rest-design'],
    order: 4,
  },
  {
    id: 'be-microservices',
    pathId: 'backend-engineer',
    name: 'Microservices & Docker',
    description: 'Service decomposition, Docker, inter-service communication, and cloud deployment.',
    icon: '📦',
    xpReward: 325,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['be-database-optimization', 'be-auth-security'],
    order: 5,
  },
  // ── Frontend Engineer ──
  {
    id: 'fe-html-css-js',
    pathId: 'frontend-engineer',
    name: 'HTML, CSS & JavaScript',
    description: 'Semantic HTML, Flexbox/Grid, responsive design, and modern ES6+ JavaScript.',
    icon: '🎨',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'fe-react-framework',
    pathId: 'frontend-engineer',
    name: 'React or Vue.js',
    description: 'Component architecture, hooks, state management, routing, and UI patterns.',
    icon: '⚛️',
    xpReward: 175,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['fe-html-css-js'],
    order: 2,
  },
  {
    id: 'fe-typescript',
    pathId: 'frontend-engineer',
    name: 'TypeScript & Type Safety',
    description: 'Types, interfaces, generics, strict mode, and integration with React.',
    icon: '📘',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['fe-react-framework'],
    order: 3,
  },
  {
    id: 'fe-performance',
    pathId: 'frontend-engineer',
    name: 'Performance Optimization',
    description: 'Core Web Vitals, lazy loading, code splitting, caching, and profiling.',
    icon: '⚡',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['fe-react-framework'],
    order: 4,
  },
  {
    id: 'fe-testing-a11y',
    pathId: 'frontend-engineer',
    name: 'Testing & Accessibility',
    description: 'Jest, React Testing Library, Playwright, WCAG 2.1, and semantic roles.',
    icon: '✅',
    xpReward: 300,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['fe-typescript', 'fe-performance'],
    order: 5,
  },
  // ── Cloud Engineer ──
  {
    id: 'ce-cloud-fundamentals',
    pathId: 'cloud-engineer',
    name: 'Cloud Fundamentals',
    description: 'AWS, GCP, or Azure core services: compute, storage, databases, and IAM.',
    icon: '☁️',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
    whyItMatters: 'Every company runs on cloud — fluency in AWS/GCP/Azure is now a baseline expectation for engineers.',
    outputExamples: [
      'Deploy a simple web app on EC2 with an S3 bucket for static assets and RDS for data',
      'Configure IAM roles and policies to enforce least-privilege access across services',
      'Write a diagram documenting the architecture of a 3-tier cloud application',
    ],
  },
  {
    id: 'ce-networking',
    pathId: 'cloud-engineer',
    name: 'Networking & Security Groups',
    description: 'VPCs, subnets, NAT gateways, load balancers, security groups, and DNS.',
    icon: '🌐',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['ce-cloud-fundamentals'],
    order: 2,
    whyItMatters: 'Misconfigured networking is the #1 cause of cloud security breaches — this skill protects companies from catastrophe.',
    outputExamples: [
      'Design a VPC with public and private subnets, NAT gateway, and route tables',
      'Set up an Application Load Balancer that routes to two target groups by path',
      'Configure security groups and NACLs that only expose the necessary ports',
    ],
  },
  {
    id: 'ce-iac',
    pathId: 'cloud-engineer',
    name: 'Infrastructure as Code',
    description: 'Terraform or CloudFormation: write, plan, and apply reproducible infrastructure.',
    icon: '🏗️',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 3,
    prerequisites: ['ce-networking'],
    order: 3,
    whyItMatters: 'IaC means your infra is version-controlled, reviewable, and reproducible — manual console clicks are a liability.',
    outputExamples: [
      'Provision a full VPC + EC2 + RDS stack with Terraform and commit it to GitHub',
      'Write reusable Terraform modules for a VPC and an ECS service',
      'Use Terraform Cloud remote state to collaborate on infrastructure with a team',
    ],
  },
  {
    id: 'ce-kubernetes',
    pathId: 'cloud-engineer',
    name: 'Kubernetes & Containers',
    description: 'Docker, Kubernetes deployments, services, Helm charts, and cluster operations.',
    icon: '🐳',
    xpReward: 300,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['ce-iac'],
    order: 4,
    whyItMatters: 'Kubernetes is the de-facto standard for container orchestration — it runs the majority of production workloads in tech.',
    outputExamples: [
      'Dockerize a Node app and deploy it to a local Kubernetes cluster with 3 replicas',
      'Write a Helm chart for a microservice with configurable resource limits and readiness probes',
      'Set up horizontal pod autoscaling based on CPU utilization on an EKS cluster',
    ],
  },
  {
    id: 'ce-cost-optimization',
    pathId: 'cloud-engineer',
    name: 'Cost Optimization & FinOps',
    description: 'Reserved instances, spot fleets, auto-scaling, and cloud spend governance.',
    icon: '💰',
    xpReward: 300,
    rarity: 'epic',
    requiredOutputs: 2,
    prerequisites: ['ce-kubernetes'],
    order: 5,
    whyItMatters: 'Cloud bills spiral without governance — FinOps engineers save companies millions and get recognized for it.',
    outputExamples: [
      'Audit an AWS account with Cost Explorer and identify 3 savings opportunities with estimated savings',
      'Configure an auto-scaling group with spot instances to cut EC2 costs by 60%',
      'Set up a cloud budget alert that notifies the team when spend exceeds 80% of target',
    ],
  },
  // ── DevOps ──
  {
    id: 'do-linux-shell',
    pathId: 'devops',
    name: 'Linux & Shell Scripting',
    description: 'File system, processes, cron, bash scripting, and system administration.',
    icon: '🐧',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'do-cicd',
    pathId: 'devops',
    name: 'CI/CD Pipelines',
    description: 'GitHub Actions, Jenkins, or GitLab CI: build, test, and deploy pipelines.',
    icon: '🔄',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['do-linux-shell'],
    order: 2,
  },
  {
    id: 'do-docker-k8s',
    pathId: 'devops',
    name: 'Docker & Kubernetes',
    description: 'Containerize apps, write Dockerfiles, deploy to Kubernetes, and manage workloads.',
    icon: '📦',
    xpReward: 275,
    rarity: 'rare',
    requiredOutputs: 3,
    prerequisites: ['do-cicd'],
    order: 3,
  },
  {
    id: 'do-monitoring',
    pathId: 'devops',
    name: 'Monitoring & Observability',
    description: 'Prometheus, Grafana, ELK stack, alerting, and SLIs/SLOs/SLAs.',
    icon: '📊',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['do-docker-k8s'],
    order: 4,
  },
  {
    id: 'do-security',
    pathId: 'devops',
    name: 'DevSecOps & Compliance',
    description: 'Shift-left security: SAST, DAST, secrets management, and compliance automation.',
    icon: '🔒',
    xpReward: 325,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['do-monitoring'],
    order: 5,
  },
  // ── Cybersecurity ──
  {
    id: 'cs-networking',
    pathId: 'cybersecurity',
    name: 'Networking & Protocols',
    description: 'TCP/IP, DNS, HTTP/S, firewalls, Wireshark analysis, and network topology.',
    icon: '🌐',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'cs-linux-security',
    pathId: 'cybersecurity',
    name: 'Linux Security & Hardening',
    description: 'File permissions, user management, SELinux, auditd, and system hardening.',
    icon: '🐧',
    xpReward: 175,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['cs-networking'],
    order: 2,
  },
  {
    id: 'cs-vulnerability',
    pathId: 'cybersecurity',
    name: 'Vulnerability Assessment',
    description: 'OWASP Top 10, CVE analysis, Nmap, Nessus, and security scanning.',
    icon: '🔍',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['cs-linux-security'],
    order: 3,
  },
  {
    id: 'cs-pentest',
    pathId: 'cybersecurity',
    name: 'Penetration Testing',
    description: 'Ethical hacking methodology, Metasploit, Burp Suite, and CTF challenges.',
    icon: '⚔️',
    xpReward: 350,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['cs-vulnerability'],
    order: 4,
  },
  {
    id: 'cs-incident-response',
    pathId: 'cybersecurity',
    name: 'Incident Response & Forensics',
    description: 'IR lifecycle, digital forensics, threat hunting, and post-incident reporting.',
    icon: '🚨',
    xpReward: 400,
    rarity: 'legendary',
    requiredOutputs: 3,
    prerequisites: ['cs-pentest'],
    order: 5,
  },
  // ── Product Manager ──
  {
    id: 'pm-discovery',
    pathId: 'product-manager',
    name: 'Product Discovery & User Research',
    description: 'Customer interviews, jobs-to-be-done, problem validation, and user personas.',
    icon: '🔍',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'pm-roadmap',
    pathId: 'product-manager',
    name: 'Roadmap Prioritization',
    description: 'RICE, ICE, MoSCoW, OKRs, and balancing business vs. user needs.',
    icon: '📋',
    xpReward: 175,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['pm-discovery'],
    order: 2,
  },
  {
    id: 'pm-stakeholders',
    pathId: 'product-manager',
    name: 'Stakeholder Communication',
    description: 'PRDs, alignment meetings, executive updates, and managing competing priorities.',
    icon: '🤝',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['pm-roadmap'],
    order: 3,
  },
  {
    id: 'pm-data-driven',
    pathId: 'product-manager',
    name: 'Data-Driven Decisions',
    description: 'A/B testing, funnel analysis, cohort analysis, and product metrics.',
    icon: '📈',
    xpReward: 225,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['pm-roadmap'],
    order: 4,
  },
  {
    id: 'pm-launch',
    pathId: 'product-manager',
    name: 'Product Launch & Go-to-Market',
    description: 'Launch planning, positioning, enablement, and post-launch iteration.',
    icon: '🚀',
    xpReward: 300,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['pm-stakeholders', 'pm-data-driven'],
    order: 5,
  },
  // ── Business Analyst ──
  {
    id: 'ba-requirements',
    pathId: 'business-analyst',
    name: 'Requirements Gathering',
    description: 'Stakeholder interviews, user stories, acceptance criteria, and requirements documentation.',
    icon: '📝',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'ba-data-analysis',
    pathId: 'business-analyst',
    name: 'Data Analysis & Excel',
    description: 'Pivot tables, VLOOKUP, data cleaning, statistical summaries, and charting.',
    icon: '📊',
    xpReward: 150,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['ba-requirements'],
    order: 2,
  },
  {
    id: 'ba-process-mapping',
    pathId: 'business-analyst',
    name: 'Process Mapping & BPMN',
    description: 'As-is/to-be process flows, swim lanes, BPMN notation, and process optimization.',
    icon: '🗺️',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['ba-data-analysis'],
    order: 3,
  },
  {
    id: 'ba-sql-business',
    pathId: 'business-analyst',
    name: 'SQL for Business Analysis',
    description: 'Write business queries, joins, aggregations, and data extraction for reporting.',
    icon: '🗄️',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['ba-data-analysis'],
    order: 4,
  },
  {
    id: 'ba-reporting',
    pathId: 'business-analyst',
    name: 'Dashboard Design & Reporting',
    description: 'Tableau, Power BI, or Looker: design dashboards that drive decisions.',
    icon: '📉',
    xpReward: 275,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['ba-process-mapping', 'ba-sql-business'],
    order: 5,
  },
  // ── Data Analyst ──
  {
    id: 'da-excel-spreadsheets',
    pathId: 'data-analyst',
    name: 'Excel & Spreadsheet Mastery',
    description: 'Advanced formulas, pivot tables, dynamic arrays, and business reporting.',
    icon: '📊',
    xpReward: 75,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'da-sql-analysis',
    pathId: 'data-analyst',
    name: 'SQL for Data Analysis',
    description: 'SELECT, JOINs, CTEs, window functions, and writing analytical queries.',
    icon: '🗄️',
    xpReward: 125,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['da-excel-spreadsheets'],
    order: 2,
  },
  {
    id: 'da-visualization',
    pathId: 'data-analyst',
    name: 'Data Visualization',
    description: 'Tableau, Power BI, or matplotlib: tell stories with data and build dashboards.',
    icon: '📉',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['da-sql-analysis'],
    order: 3,
  },
  {
    id: 'da-python-analysis',
    pathId: 'data-analyst',
    name: 'Python for Data Analysis',
    description: 'pandas, matplotlib, seaborn, and exploratory data analysis workflows.',
    icon: '🐍',
    xpReward: 225,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['da-sql-analysis'],
    order: 4,
  },
  {
    id: 'da-statistics',
    pathId: 'data-analyst',
    name: 'Statistical Analysis & A/B Testing',
    description: 'Descriptive stats, distributions, hypothesis testing, and experiment design.',
    icon: '🔬',
    xpReward: 275,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['da-visualization', 'da-python-analysis'],
    order: 5,
  },
  // ── Project Manager ──
  {
    id: 'pjm-planning',
    pathId: 'project-manager',
    name: 'Project Planning & Scoping',
    description: 'WBS, project charter, scope definition, timelines, and milestone planning.',
    icon: '📌',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'pjm-agile',
    pathId: 'project-manager',
    name: 'Agile & Scrum',
    description: 'Sprint planning, daily standups, backlog grooming, retrospectives, and velocity tracking.',
    icon: '🔄',
    xpReward: 150,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['pjm-planning'],
    order: 2,
  },
  {
    id: 'pjm-risk',
    pathId: 'project-manager',
    name: 'Risk Management',
    description: 'Risk register, probability/impact matrix, mitigation strategies, and contingency plans.',
    icon: '⚠️',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['pjm-agile'],
    order: 3,
  },
  {
    id: 'pjm-communication',
    pathId: 'project-manager',
    name: 'Stakeholder Communication',
    description: 'Status reports, escalation paths, executive summaries, and meeting facilitation.',
    icon: '🤝',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['pjm-agile'],
    order: 4,
  },
  {
    id: 'pjm-budget',
    pathId: 'project-manager',
    name: 'Budget & Resource Planning',
    description: 'Cost estimation, resource allocation, earned value management, and budget forecasting.',
    icon: '💰',
    xpReward: 275,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['pjm-risk', 'pjm-communication'],
    order: 5,
  },
  // ── Solutions Architect ──
  {
    id: 'sa-systems-design',
    pathId: 'solutions-architect',
    name: 'Systems Design Fundamentals',
    description: 'Scalability, availability, CAP theorem, load balancing, and system design interviews.',
    icon: '🏛️',
    xpReward: 150,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'sa-cloud-arch',
    pathId: 'solutions-architect',
    name: 'Cloud Architecture Patterns',
    description: 'Well-Architected Framework, serverless, event-driven, and multi-region designs.',
    icon: '☁️',
    xpReward: 225,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['sa-systems-design'],
    order: 2,
  },
  {
    id: 'sa-integration',
    pathId: 'solutions-architect',
    name: 'Integration Patterns & APIs',
    description: 'REST, GraphQL, event-driven architecture, message queues, and API gateways.',
    icon: '🔌',
    xpReward: 225,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['sa-systems-design'],
    order: 3,
  },
  {
    id: 'sa-security-arch',
    pathId: 'solutions-architect',
    name: 'Security Architecture',
    description: 'Zero-trust, identity management, encryption at rest/in-transit, and threat modeling.',
    icon: '🔒',
    xpReward: 275,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['sa-cloud-arch'],
    order: 4,
  },
  {
    id: 'sa-cost-scalability',
    pathId: 'solutions-architect',
    name: 'Cost, Scalability & Reliability',
    description: 'SLAs, chaos engineering, capacity planning, cost optimization, and incident runbooks.',
    icon: '📈',
    xpReward: 350,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['sa-integration', 'sa-security-arch'],
    order: 5,
  },
  // ── Software Architect ──
  {
    id: 'arch-design-patterns',
    pathId: 'software-architect',
    name: 'Design Patterns & SOLID',
    description: 'GoF patterns, SOLID principles, DRY, YAGNI, and refactoring toward clean code.',
    icon: '🔷',
    xpReward: 150,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'arch-distributed-systems',
    pathId: 'software-architect',
    name: 'Distributed Systems',
    description: 'Consensus, eventual consistency, distributed transactions, and failure modes.',
    icon: '🌐',
    xpReward: 275,
    rarity: 'rare',
    requiredOutputs: 3,
    prerequisites: ['arch-design-patterns'],
    order: 2,
  },
  {
    id: 'arch-api-design',
    pathId: 'software-architect',
    name: 'API Design & Versioning',
    description: 'Contract-first design, backward compatibility, deprecation strategies, and API governance.',
    icon: '🔌',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['arch-design-patterns'],
    order: 3,
  },
  {
    id: 'arch-system-modeling',
    pathId: 'software-architect',
    name: 'System Modeling & ADRs',
    description: 'C4 diagrams, sequence flows, Architecture Decision Records, and technical specs.',
    icon: '📐',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['arch-distributed-systems'],
    order: 4,
  },
  {
    id: 'arch-tech-leadership',
    pathId: 'software-architect',
    name: 'Technical Leadership',
    description: 'Code reviews, technical mentoring, RFC processes, and cross-team alignment.',
    icon: '👑',
    xpReward: 400,
    rarity: 'legendary',
    requiredOutputs: 3,
    prerequisites: ['arch-api-design', 'arch-system-modeling'],
    order: 5,
  },
  // ── Mobile Developer ──
  {
    id: 'mob-ui-fundamentals',
    pathId: 'mobile-developer',
    name: 'Mobile UI Fundamentals',
    description: 'Platform design patterns, Flexbox layout, safe areas, and touch interaction.',
    icon: '📱',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'mob-react-native',
    pathId: 'mobile-developer',
    name: 'React Native or Flutter',
    description: 'Component architecture, navigation, platform APIs, and cross-platform development.',
    icon: '⚛️',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['mob-ui-fundamentals'],
    order: 2,
  },
  {
    id: 'mob-state-management',
    pathId: 'mobile-developer',
    name: 'State Management & Persistence',
    description: 'Redux, Zustand, or Provider. AsyncStorage, SQLite, and offline sync.',
    icon: '🗃️',
    xpReward: 225,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['mob-react-native'],
    order: 3,
  },
  {
    id: 'mob-native-apis',
    pathId: 'mobile-developer',
    name: 'Native APIs & Push Notifications',
    description: 'Camera, location, biometrics, push notifications, and background tasks.',
    icon: '🔔',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['mob-react-native'],
    order: 4,
  },
  {
    id: 'mob-app-store',
    pathId: 'mobile-developer',
    name: 'App Store Deployment',
    description: 'Build pipelines, signing, App Store Connect, Google Play, and analytics.',
    icon: '🚀',
    xpReward: 300,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['mob-state-management', 'mob-native-apis'],
    order: 5,
  },
  // ── UI/UX Designer ──
  {
    id: 'ux-fundamentals',
    pathId: 'ui-ux-designer',
    name: 'Design Fundamentals',
    description: 'Visual hierarchy, color theory, typography, spacing, and design principles.',
    icon: '🎨',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'ux-wireframing',
    pathId: 'ui-ux-designer',
    name: 'Wireframing & Prototyping',
    description: 'Lo-fi to hi-fi wireframes, interactive prototypes, and design iteration.',
    icon: '✏️',
    xpReward: 150,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: ['ux-fundamentals'],
    order: 2,
  },
  {
    id: 'ux-user-research',
    pathId: 'ui-ux-designer',
    name: 'User Research & Testing',
    description: 'Interviews, usability tests, affinity mapping, and translating findings into design.',
    icon: '🔍',
    xpReward: 225,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['ux-wireframing'],
    order: 3,
  },
  {
    id: 'ux-figma',
    pathId: 'ui-ux-designer',
    name: 'Figma & Design Systems',
    description: 'Components, auto-layout, variants, tokens, and building a scalable design system.',
    icon: '🖼️',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['ux-wireframing'],
    order: 4,
  },
  {
    id: 'ux-design-thinking',
    pathId: 'ui-ux-designer',
    name: 'Design Thinking & Accessibility',
    description: 'Empathize, define, ideate, prototype, test. WCAG 2.1 and inclusive design.',
    icon: '💡',
    xpReward: 300,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['ux-user-research', 'ux-figma'],
    order: 5,
  },
  // ── Startup Founder ──
  {
    id: 'sf-validation',
    pathId: 'startup-founder',
    name: 'Idea Validation & Customer Discovery',
    description: 'Problem interviews, lean canvas, smoke tests, and finding your first 10 customers.',
    icon: '💡',
    xpReward: 100,
    rarity: 'common',
    requiredOutputs: 2,
    prerequisites: [],
    order: 1,
  },
  {
    id: 'sf-mvp',
    pathId: 'startup-founder',
    name: 'MVP Planning & Build',
    description: 'Scope MVP, pick a stack, ship fast, gather feedback, and iterate.',
    icon: '🔨',
    xpReward: 200,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['sf-validation'],
    order: 2,
  },
  {
    id: 'sf-growth',
    pathId: 'startup-founder',
    name: 'Growth & Acquisition',
    description: 'Distribution channels, SEO, content, paid acquisition, and retention loops.',
    icon: '📈',
    xpReward: 250,
    rarity: 'rare',
    requiredOutputs: 2,
    prerequisites: ['sf-mvp'],
    order: 3,
  },
  {
    id: 'sf-fundraising',
    pathId: 'startup-founder',
    name: 'Fundraising & Pitching',
    description: 'Pitch deck, investor outreach, term sheets, valuations, and due diligence.',
    icon: '💰',
    xpReward: 300,
    rarity: 'epic',
    requiredOutputs: 3,
    prerequisites: ['sf-mvp'],
    order: 4,
  },
  {
    id: 'sf-operations',
    pathId: 'startup-founder',
    name: 'Operations & Team Building',
    description: 'Hiring, culture, processes, OKRs, and scaling from 1 to 10 employees.',
    icon: '🏢',
    xpReward: 400,
    rarity: 'legendary',
    requiredOutputs: 3,
    prerequisites: ['sf-growth', 'sf-fundraising'],
    order: 5,
  },
];

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

const MOCK_FEED: FeedPost[] = [
  {
    id: 'fp-001',
    userId: 'alex_chen_dev',
    userName: 'Alex Chen',
    userHandle: 'alex.chen',
    avatarEmoji: '🏗️',
    avatarColor: '#0A2030',
    pathId: 'data-architect',
    pathLabel: 'Data Architect',
    pathColor: '#06B6D4',
    type: 'milestone',
    skillId: 'sql-foundations',
    skillName: 'SQL Foundations',
    content:
      'Finally nailed window functions after building a real analytics pipeline. Wrote 12 complex queries analyzing 3 years of sales data — ROW_NUMBER(), RANK(), LAG() — the whole arsenal. If you\'re stuck, just build something real with your data.',
    xpGained: 100,
    reactions: { '🔥': 12, '👏': 8, '💪': 5 },
    userReactions: [],
    comments: [
      {
        id: 'c1',
        userId: 'priya_k',
        userName: 'Priya K.',
        text: 'Window functions are game changing! Which resource helped it click for you? 🙌',
        createdAt: '2026-05-19T02:30:00Z',
      },
    ],
    timestamp: '2026-05-19T02:00:00Z',
  },
  {
    id: 'fp-002',
    userId: 'maria_santos_ai',
    userName: 'Maria Santos',
    userHandle: 'maria.builds',
    avatarEmoji: '🤖',
    avatarColor: '#1A0A3D',
    pathId: 'ai-engineer',
    pathLabel: 'AI Engineer',
    pathColor: '#7C3AED',
    type: 'output',
    skillId: 'rag-systems',
    skillName: 'RAG Systems',
    outputTitle: 'Production RAG Pipeline',
    content:
      'Shipped my first production RAG system — LangChain + Pinecone + GPT-4. Answers questions from 500+ internal PDFs in under 2 seconds. The embedding pipeline alone took a week to tune. 512-token chunks with 50-token overlap is the sweet spot.',
    xpGained: 150,
    reactions: { '🚀': 24, '🔥': 16, '💯': 9, '🧠': 11 },
    userReactions: [],
    comments: [
      {
        id: 'c2',
        userId: 'alex_chen_dev',
        userName: 'Alex Chen',
        text: 'What chunk size are you using? I keep getting poor retrieval quality.',
        createdAt: '2026-05-19T01:15:00Z',
      },
      {
        id: 'c3',
        userId: 'maria_santos_ai',
        userName: 'Maria Santos',
        text: '512 tokens with 50 overlap. Add metadata filtering — it made a huge difference.',
        createdAt: '2026-05-19T01:20:00Z',
      },
    ],
    timestamp: '2026-05-19T01:00:00Z',
  },
  {
    id: 'fp-003',
    userId: 'james_park_data',
    userName: 'James Park',
    userHandle: 'j.park',
    avatarEmoji: '📊',
    avatarColor: '#0A1230',
    pathId: 'data-architect',
    pathLabel: 'Data Architect',
    pathColor: '#06B6D4',
    type: 'streak',
    streakDays: 7,
    content:
      'Day 7. When I started I couldn\'t explain what a CTE was. Now I\'m building dimensional models from scratch. Consistency > intensity. If you\'re on day 1 or day 2, just show up tomorrow.',
    xpGained: 0,
    reactions: { '💪': 31, '🔥': 22, '❤️': 14 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-18T18:00:00Z',
  },
  {
    id: 'fp-004',
    userId: 'priya_kumar_ml',
    userName: 'Priya Kumar',
    userHandle: 'priya.builds',
    avatarEmoji: '⚡',
    avatarColor: '#1A0A3D',
    pathId: 'ai-engineer',
    pathLabel: 'AI Engineer',
    pathColor: '#7C3AED',
    type: 'milestone',
    skillId: 'prompt-engineering',
    skillName: 'Prompt Engineering',
    content:
      'Completed Prompt Engineering. Key realization: prompts are just functions. Typed inputs → defined outputs → error cases. Treat them like code, not conversation. My output quality improved 3x when I applied this framing.',
    xpGained: 200,
    reactions: { '🧠': 19, '💡': 13, '👏': 10, '🔥': 8 },
    userReactions: [],
    comments: [
      {
        id: 'c4',
        userId: 'james_park_data',
        userName: 'James Park',
        text: 'This framing is exactly what I needed. Prompts as functions. Saving this.',
        createdAt: '2026-05-18T15:45:00Z',
      },
    ],
    timestamp: '2026-05-18T15:00:00Z',
  },
  {
    id: 'fp-005',
    userId: 'diego_rivera_fs',
    userName: 'Diego Rivera',
    userHandle: 'diego.code',
    avatarEmoji: '🚀',
    avatarColor: '#061A10',
    pathId: 'fullstack',
    pathLabel: 'Full Stack',
    pathColor: '#10B981',
    type: 'output',
    skillId: 'react-rn',
    skillName: 'React & React Native',
    outputTitle: 'E-Commerce Mobile App',
    content:
      '9 months of learning. This is the app. Full e-commerce: auth, catalog, cart, Stripe payments, order tracking. Everything I know is in this one project. Building something real is the only way.',
    xpGained: 200,
    reactions: { '🚀': 41, '🔥': 28, '💯': 19, '❤️': 15 },
    userReactions: [],
    comments: [
      {
        id: 'c5',
        userId: 'maria_santos_ai',
        userName: 'Maria Santos',
        text: 'The catalog screen looks beautiful. What state management are you using?',
        createdAt: '2026-05-17T21:30:00Z',
      },
    ],
    timestamp: '2026-05-17T20:00:00Z',
  },
  {
    id: 'fp-006',
    userId: 'taylor_kim_dw',
    userName: 'Taylor Kim',
    userHandle: 'taylor.data',
    avatarEmoji: '❄️',
    avatarColor: '#0A1E30',
    pathId: 'data-architect',
    pathLabel: 'Data Architect',
    pathColor: '#06B6D4',
    type: 'output',
    skillId: 'snowflake-engineering',
    skillName: 'Snowflake Engineering',
    outputTitle: 'Multi-Cluster Warehouse Setup',
    content:
      'Got our Snowflake env production-ready. Auto-scaling multi-cluster warehouses, resource monitors, query profiling. Also: never touch the PUBLIC schema in a team environment. Learned that the hard way.',
    xpGained: 150,
    reactions: { '❄️': 15, '💡': 9, '😂': 12, '🔥': 7 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-17T10:00:00Z',
  },
  {
    id: 'fp-007',
    userId: 'sarah_l_ai',
    userName: 'Sarah Lee',
    userHandle: 'sarah.evolves',
    avatarEmoji: '🏆',
    avatarColor: '#2D1A00',
    pathId: 'ai-engineer',
    pathLabel: 'AI Engineer',
    pathColor: '#7C3AED',
    type: 'streak',
    streakDays: 30,
    content:
      '30 days. One month of showing up every single day. My portfolio went from 0 to 9 real projects. I\'m not the same person I was 30 days ago. The community here is why I didn\'t quit on day 12.',
    xpGained: 0,
    reactions: { '🏆': 67, '🔥': 45, '💪': 38, '❤️': 29 },
    userReactions: [],
    comments: [
      {
        id: 'c6',
        userId: 'priya_kumar_ml',
        userName: 'Priya Kumar',
        text: 'Day 12 was SO hard for me too. You kept me going. 🙏',
        createdAt: '2026-05-16T09:00:00Z',
      },
      {
        id: 'c7',
        userId: 'alex_chen_dev',
        userName: 'Alex Chen',
        text: 'Legend. What\'s the next 30 looking like?',
        createdAt: '2026-05-16T09:30:00Z',
      },
      {
        id: 'c8',
        userId: 'sarah_l_ai',
        userName: 'Sarah Lee',
        text: 'AI Agents. Full send. 🚀',
        createdAt: '2026-05-16T09:45:00Z',
      },
    ],
    timestamp: '2026-05-16T08:00:00Z',
  },
  {
    id: 'fp-008',
    userId: 'marcus_j_fs',
    userName: 'Marcus Johnson',
    userHandle: 'marcus.j',
    avatarEmoji: '🌐',
    avatarColor: '#061A10',
    pathId: 'fullstack',
    pathLabel: 'Full Stack',
    pathColor: '#10B981',
    type: 'milestone',
    skillId: 'backend-apis',
    skillName: 'Backend APIs',
    content:
      'Backend APIs: done. REST API + WebSocket server in Node.js. JWT auth, rate limiting, Postgres with migrations. Finally feel like a real backend developer. The gap between knowing concepts and building production systems is everything.',
    xpGained: 225,
    reactions: { '🚀': 18, '💪': 12, '🔥': 9 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-15T14:00:00Z',
  },
  {
    id: 'fp-009',
    userId: 'ananya_r_de',
    userName: 'Ananya Rao',
    userHandle: 'ananya.data',
    avatarEmoji: '🔧',
    avatarColor: '#1A0E00',
    pathId: 'data-engineer',
    pathLabel: 'Data Engineer',
    pathColor: '#F59E0B',
    type: 'output',
    skillId: 'de-spark-processing',
    skillName: 'Spark Processing',
    outputTitle: 'Petabyte-Scale ETL on Databricks',
    content:
      'Rewrote our ETL from Python loops to Spark — 300x faster. 4 hours → 48 seconds for our daily pipeline. The secret: avoid .collect(), partition by date keys early, use broadcast joins for small lookups. Databricks notebooks are genuinely a joy to profile.',
    xpGained: 150,
    reactions: { '⚡': 22, '🔥': 14, '🤯': 18 },
    userReactions: [],
    comments: [
      {
        id: 'c9',
        userId: 'alex_chen_dev',
        userName: 'Alex Chen',
        text: '300x is insane. What cluster config were you running on?',
        createdAt: '2026-05-14T11:30:00Z',
      },
    ],
    timestamp: '2026-05-14T10:00:00Z',
  },
  {
    id: 'fp-010',
    userId: 'kwame_b_be',
    userName: 'Kwame Boateng',
    userHandle: 'kwame.builds',
    avatarEmoji: '⚙️',
    avatarColor: '#1A1A2A',
    pathId: 'backend-engineer',
    pathLabel: 'Backend Engineer',
    pathColor: '#94A3B8',
    type: 'milestone',
    skillId: 'be-auth-security',
    skillName: 'Auth & Security',
    content:
      'Shipped zero-downtime auth migration: moved from sessions to JWTs with refresh token rotation. 40k active users, zero reported logouts. The key was a 72-hour overlap period where both systems validated tokens. Rate limiting + anomaly detection now live too.',
    xpGained: 275,
    reactions: { '🔐': 19, '👏': 23, '🚀': 11 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-13T16:00:00Z',
  },
  {
    id: 'fp-011',
    userId: 'kenji_n_ml',
    userName: 'Kenji Nakamura',
    userHandle: 'kenji.ml',
    avatarEmoji: '🧪',
    avatarColor: '#0D0520',
    pathId: 'ml-engineer',
    pathLabel: 'ML Engineer',
    pathColor: '#8B5CF6',
    type: 'output',
    skillId: 'ml-sklearn-algorithms',
    skillName: 'ML Algorithms',
    outputTitle: 'Customer Churn Prediction Model',
    content:
      'Built a churn prediction model — Random Forest, XGBoost, and a custom ensemble. 94% precision on holdout. The key wasn\'t the algorithm. It was feature engineering: rolling 30-day engagement windows crushed static demographic features. Never underestimate your features.',
    xpGained: 150,
    reactions: { '🧠': 21, '🔥': 15, '📊': 9 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-12T10:00:00Z',
  },
  {
    id: 'fp-012',
    userId: 'sofia_p_fe',
    userName: 'Sofia Petrov',
    userHandle: 'sofia.fe',
    avatarEmoji: '🎨',
    avatarColor: '#1A0A00',
    pathId: 'frontend-engineer',
    pathLabel: 'Frontend Engineer',
    pathColor: '#F97316',
    type: 'milestone',
    skillId: 'fe-react-framework',
    skillName: 'React Framework',
    content:
      'React Framework: done. Six months ago I was copying tutorials line by line. Today I rebuilt a legacy jQuery app into a full React SPA — custom hooks, lazy loading, Storybook docs. Don\'t just read the docs. Build until you get stuck, then read the docs.',
    xpGained: 200,
    reactions: { '🚀': 28, '💪': 16, '🎉': 11 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-11T15:00:00Z',
  },
  {
    id: 'fp-013',
    userId: 'tariq_h_do',
    userName: 'Tariq Hassan',
    userHandle: 'tariq.devops',
    avatarEmoji: '🛠️',
    avatarColor: '#051510',
    pathId: 'devops',
    pathLabel: 'DevOps Engineer',
    pathColor: '#14B8A6',
    type: 'milestone',
    skillId: 'do-cicd',
    skillName: 'CI/CD Pipelines',
    content:
      'CI/CD complete. GitHub Actions: lint → unit tests → integration tests → Docker build → staging → smoke tests → prod. 22 minutes end-to-end. We used to do this manually in 3 hours. The first time it auto-deployed at 2am while I slept? That feeling doesn\'t get old.',
    xpGained: 200,
    reactions: { '⚙️': 19, '🔥': 14, '🤖': 22 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-10T09:00:00Z',
  },
  {
    id: 'fp-014',
    userId: 'isabelle_m_ce',
    userName: 'Isabelle Müller',
    userHandle: 'isabelle.cloud',
    avatarEmoji: '☁️',
    avatarColor: '#051520',
    pathId: 'cloud-engineer',
    pathLabel: 'Cloud Engineer',
    pathColor: '#0EA5E9',
    type: 'output',
    skillId: 'ce-iac',
    skillName: 'Infrastructure as Code',
    outputTitle: 'Multi-Region AWS Terraform Stack',
    content:
      'Terraformed our entire AWS infrastructure: VPCs, ECS clusters, RDS multi-AZ, CloudFront, Route53. 11 environments — one PR to update all of them. Goodbye manual console clicks. The drift detection alone has prevented 3 incidents this month.',
    xpGained: 150,
    reactions: { '☁️': 17, '🔥': 13, '💡': 8 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-09T14:00:00Z',
  },
  {
    id: 'fp-015',
    userId: 'jordan_l_cs',
    userName: 'Jordan Lee',
    userHandle: 'jordan.sec',
    avatarEmoji: '🔐',
    avatarColor: '#1A0505',
    pathId: 'cybersecurity',
    pathLabel: 'Cybersecurity',
    pathColor: '#EF4444',
    type: 'output',
    skillId: 'cs-vulnerability',
    skillName: 'Vulnerability Assessment',
    outputTitle: 'Bug Bounty: Critical XSS + SQLi',
    content:
      'First bug bounty finds: stored XSS in a comments field + SQL injection on a search endpoint. Reported both. $2,400 combined bounty. The SQLi was textbook — input that hit the DB without sanitization. Lesson: most vulnerabilities are boring. Always check the boring stuff first.',
    xpGained: 150,
    reactions: { '🔐': 31, '🤯': 24, '💰': 18 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-08T11:00:00Z',
  },
  {
    id: 'fp-016',
    userId: 'priscilla_o_pm',
    userName: 'Priscilla Okwu',
    userHandle: 'priscilla.pm',
    avatarEmoji: '📋',
    avatarColor: '#150520',
    pathId: 'product-manager',
    pathLabel: 'Product Manager',
    pathColor: '#D946EF',
    type: 'milestone',
    skillId: 'pm-discovery',
    skillName: 'Product Discovery',
    content:
      'Discovery sprint complete: 14 user interviews, 2 JTBD workshops, 1 core hypothesis thrown out after interview #3. The insight we built the entire sprint around was wrong. Killing a bad hypothesis before you build anything is the most valuable use of your time.',
    xpGained: 200,
    reactions: { '📊': 16, '🎯': 22, '💡': 14 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-07T13:00:00Z',
  },
  {
    id: 'fp-017',
    userId: 'mei_l_ba',
    userName: 'Mei Lin',
    userHandle: 'mei.lin.ba',
    avatarEmoji: '📊',
    avatarColor: '#041A10',
    pathId: 'business-analyst',
    pathLabel: 'Business Analyst',
    pathColor: '#34D399',
    type: 'output',
    skillId: 'ba-requirements',
    skillName: 'Requirements Gathering',
    outputTitle: 'Stakeholder Requirements Workshop',
    content:
      'Ran a 3-hour requirements workshop with 8 stakeholders who "all agreed" on the project scope. Spoiler: they didn\'t. 47 requirements documented, 12 contradictions surfaced, 4 resolved on the spot. The conflicts they didn\'t know existed were the most valuable output. Never skip elicitation.',
    xpGained: 100,
    reactions: { '📋': 18, '💡': 13, '👏': 9 },
    userReactions: [],
    comments: [
      {
        id: 'c17',
        userId: 'priscilla_o_pm',
        userName: 'Priscilla Okwu',
        text: 'Same experience every time. The contradictions ARE the deliverable. 🙌',
        createdAt: '2026-05-06T11:00:00Z',
      },
    ],
    timestamp: '2026-05-06T10:00:00Z',
  },
  {
    id: 'fp-018',
    userId: 'carlos_m_da',
    userName: 'Carlos Mendez',
    userHandle: 'carlos.data',
    avatarEmoji: '📈',
    avatarColor: '#051020',
    pathId: 'data-analyst',
    pathLabel: 'Data Analyst',
    pathColor: '#38BDF8',
    type: 'milestone',
    skillId: 'da-sql-analysis',
    skillName: 'SQL for Analysis',
    content:
      'SQL for Analysis: complete. I used to VLOOKUP everything in Excel. Now I\'m writing 50-line CTEs with LAG(), LEAD(), and PERCENTILE_CONT() against 10M-row tables. The shift from spreadsheet analyst to SQL analyst isn\'t a skill upgrade. It\'s a mindset upgrade.',
    xpGained: 150,
    reactions: { '📈': 24, '🔥': 17, '💪': 11 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-05T14:00:00Z',
  },
  {
    id: 'fp-019',
    userId: 'yuki_y_pjm',
    userName: 'Yuki Yamamoto',
    userHandle: 'yuki.pm',
    avatarEmoji: '📌',
    avatarColor: '#1A0E00',
    pathId: 'project-manager',
    pathLabel: 'Project Manager',
    pathColor: '#FBBF24',
    type: 'output',
    skillId: 'pjm-agile',
    skillName: 'Agile & Scrum',
    outputTitle: 'Sprint Retrospective Framework',
    content:
      'Built a retro framework our team actually uses: Start/Stop/Continue on a Miro board, anonymous input, 5-minute voting, then 2 committed action items with owners. We went from retros nobody cared about to retros that change how we work. Retrospectives are only useful if they produce decisions.',
    xpGained: 100,
    reactions: { '📌': 14, '👏': 19, '💡': 8 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-04T09:00:00Z',
  },
  {
    id: 'fp-020',
    userId: 'fatima_a_sa',
    userName: 'Fatima Al-Hassan',
    userHandle: 'fatima.arch',
    avatarEmoji: '🏛️',
    avatarColor: '#080A20',
    pathId: 'solutions-architect',
    pathLabel: 'Solutions Architect',
    pathColor: '#6366F1',
    type: 'output',
    skillId: 'sa-systems-design',
    skillName: 'Systems Design',
    outputTitle: 'Event-Driven Microservices Architecture',
    content:
      'Designed an event-driven system for 2M daily transactions: API Gateway → Kafka → 6 microservices → PostgreSQL + Redis. The hardest part wasn\'t the architecture. It was convincing the team that eventual consistency was acceptable for 4 of the 6 flows. Architecture is 40% technical, 60% communication.',
    xpGained: 150,
    reactions: { '🏛️': 21, '🧠': 16, '🔥': 12 },
    userReactions: [],
    comments: [
      {
        id: 'c18',
        userId: 'kwame_b_be',
        userName: 'Kwame Boateng',
        text: 'How did you handle ordering guarantees on the Kafka consumers?',
        createdAt: '2026-05-03T16:30:00Z',
      },
    ],
    timestamp: '2026-05-03T15:00:00Z',
  },
  {
    id: 'fp-021',
    userId: 'lucas_b_arch',
    userName: 'Lucas Benetti',
    userHandle: 'lucas.arch',
    avatarEmoji: '🔷',
    avatarColor: '#041A08',
    pathId: 'software-architect',
    pathLabel: 'Software Architect',
    pathColor: '#22C55E',
    type: 'milestone',
    skillId: 'arch-design-patterns',
    skillName: 'Design Patterns',
    content:
      'Design Patterns: done. Not by reading a book. By looking at our legacy codebase and labeling every pattern I found — intentional or accidental. Strategy pattern used correctly in one module. Spaghetti Singleton in another that cost us 3 hours of debugging last month. Now I name things. Naming things is power.',
    xpGained: 200,
    reactions: { '🔷': 19, '💡': 22, '🏆': 8 },
    userReactions: [],
    comments: [],
    timestamp: '2026-05-02T11:00:00Z',
  },
  {
    id: 'fp-022',
    userId: 'nkechi_o_mob',
    userName: 'Nkechi Okafor',
    userHandle: 'nkechi.mobile',
    avatarEmoji: '📱',
    avatarColor: '#1A0510',
    pathId: 'mobile-developer',
    pathLabel: 'Mobile Developer',
    pathColor: '#EC4899',
    type: 'milestone',
    skillId: 'mob-react-native',
    skillName: 'React Native',
    content:
      'React Native milestone done. I have a working app in both the App Store and Play Store. 5 months from zero mobile experience. The hard parts: not React Native itself — it\'s Xcode provisioning profiles and Android keystore management. The framework is the easy part.',
    xpGained: 200,
    reactions: { '📱': 33, '🚀': 25, '🎉': 17 },
    userReactions: [],
    comments: [
      {
        id: 'c19',
        userId: 'diego_rivera_fs',
        userName: 'Diego Rivera',
        text: 'Congrats! Keystore management nearly broke me too. Should be required reading before starting.',
        createdAt: '2026-05-01T20:30:00Z',
      },
    ],
    timestamp: '2026-05-01T19:00:00Z',
  },
  {
    id: 'fp-023',
    userId: 'anna_d_ux',
    userName: 'Anna Dubois',
    userHandle: 'anna.designs',
    avatarEmoji: '✏️',
    avatarColor: '#1A0508',
    pathId: 'ui-ux-designer',
    pathLabel: 'UI/UX Designer',
    pathColor: '#FB7185',
    type: 'output',
    skillId: 'ux-figma',
    skillName: 'Figma & Prototyping',
    outputTitle: 'Design System: 40 Components',
    content:
      'Shipped a 40-component design system in Figma: tokens for color, spacing, typography; auto-layout on everything; interactive variants for all states. Dev handoff time went from 2 hours per feature to 20 minutes. The component wasn\'t the work. Making it so obvious a developer can\'t misuse it — that was the work.',
    xpGained: 150,
    reactions: { '✨': 28, '🎨': 19, '💯': 14 },
    userReactions: [],
    comments: [],
    timestamp: '2026-04-30T13:00:00Z',
  },
  {
    id: 'fp-024',
    userId: 'rajan_m_sf',
    userName: 'Rajan Mehta',
    userHandle: 'rajan.builds',
    avatarEmoji: '🚀',
    avatarColor: '#150520',
    pathId: 'startup-founder',
    pathLabel: 'Startup Founder',
    pathColor: '#E879F9',
    type: 'milestone',
    skillId: 'sf-mvp',
    skillName: 'MVP Development',
    content:
      'MVP shipped. 6 weeks from idea to paying customer. 3 features: create, share, collect. Everything else I cut. The feature I was most sure users needed? I removed it on week 3 after 8 interviews showed no one mentioned it. The hardest founder skill isn\'t building. It\'s deciding what not to build.',
    xpGained: 250,
    reactions: { '🚀': 44, '🔥': 31, '💰': 19, '🏆': 12 },
    userReactions: [],
    comments: [
      {
        id: 'c20',
        userId: 'priscilla_o_pm',
        userName: 'Priscilla Okwu',
        text: 'What was the feature you cut? Always curious what "obvious" ideas don\'t survive user interviews.',
        createdAt: '2026-04-29T17:00:00Z',
      },
      {
        id: 'c21',
        userId: 'rajan_m_sf',
        userName: 'Rajan Mehta',
        text: 'A full team collaboration system. Turns out our users work alone. Classic assumptions trap.',
        createdAt: '2026-04-29T17:20:00Z',
      },
    ],
    timestamp: '2026-04-29T16:00:00Z',
  },

  // ── Career Win seed posts — social proof of SkillForge outcomes ──────────
  {
    id: 'fp-win-001',
    userId: 'kenji_ml_sf',
    userName: 'Kenji Nakamura',
    userHandle: 'kenji.ml',
    avatarEmoji: '🧠',
    avatarColor: '#0D0520',
    pathId: 'ml-engineer',
    pathLabel: 'ML Engineer',
    pathColor: '#8B5CF6',
    type: 'career_win' as const,
    outcomeType: 'offer' as const,
    content: '🎉 Received a job offer: ML Engineer at Stripe — $175k + equity. I started this journey 8 months ago knowing Python basics. The churn model project I logged here was literally the interview project. Proof-based progression is real.',
    xpGained: 500,
    reactions: { '🏆': 87, '🎉': 64, '🚀': 41, '🔥': 38 },
    userReactions: [],
    comments: [
      { id: 'c-w1a', userId: 'ananya_d_sf', userName: 'Ananya Sharma', text: 'This is the post I needed today. Congrats! 🎉', createdAt: '2026-05-01T09:15:00Z' },
      { id: 'c-w1b', userId: 'kenji_ml_sf', userName: 'Kenji Nakamura', text: 'The churn model project I logged 3 months ago — they asked me to walk through it live. Log everything, even the "small" wins.', createdAt: '2026-05-01T09:30:00Z' },
    ],
    timestamp: '2026-05-01T08:45:00Z',
  },
  {
    id: 'fp-win-002',
    userId: 'sofia_fe_sf',
    userName: 'Sofia Petrov',
    userHandle: 'sofia.fe',
    avatarEmoji: '⚡',
    avatarColor: '#1A0A00',
    pathId: 'fullstack',
    pathLabel: 'Full Stack',
    pathColor: '#2563EB',
    type: 'career_win' as const,
    outcomeType: 'promotion' as const,
    content: '🚀 Got promoted: Promoted to Senior Frontend Engineer at Shopify. 6 months of consistent logging on SkillForge. My manager literally cited my React architecture project as the reason I was ready for the promotion. Keep building in public.',
    xpGained: 400,
    reactions: { '🚀': 72, '🏆': 53, '🔥': 44, '💰': 29 },
    userReactions: [],
    comments: [
      { id: 'c-w2a', userId: 'marcus_j_sf', userName: 'Marcus Johnson', text: 'What was the architecture project? I\'m on the same path — this is inspiring.', createdAt: '2026-05-10T14:20:00Z' },
      { id: 'c-w2b', userId: 'sofia_fe_sf', userName: 'Sofia Petrov', text: 'Rebuilt a legacy class-based React app to functional + hooks. ~200 components. I wrote up every decision in the output log.', createdAt: '2026-05-10T14:45:00Z' },
    ],
    timestamp: '2026-05-10T13:00:00Z',
  },
  {
    id: 'fp-win-003',
    userId: 'tariq_dev_sf',
    userName: 'Tariq Hassan',
    userHandle: 'tariq.devops',
    avatarEmoji: '🔧',
    avatarColor: '#051510',
    pathId: 'data-architect',
    pathLabel: 'Data Architect',
    pathColor: '#0891B2',
    type: 'career_win' as const,
    outcomeType: 'interview' as const,
    content: '🎯 Landed an interview: Staff Data Architect at Databricks. First time I\'ve gotten past the resume screen at a FAANG-adjacent company. The interviewer specifically mentioned my Snowflake schema project. Logging outputs in the right format made the difference.',
    xpGained: 300,
    reactions: { '🎯': 58, '🔥': 47, '🏆': 33, '🚀': 28 },
    userReactions: [],
    comments: [
      { id: 'c-w3a', userId: 'taylor_d_sf', userName: 'Taylor Kim', text: 'Staff at Databricks is massive. How\'d you prep for the architecture round?', createdAt: '2026-05-18T11:10:00Z' },
      { id: 'c-w3b', userId: 'tariq_dev_sf', userName: 'Tariq Hassan', text: 'Honestly just walked them through my logged projects here. Real schemas, real decisions, real tradeoffs. That\'s what they want.', createdAt: '2026-05-18T11:30:00Z' },
    ],
    timestamp: '2026-05-18T10:30:00Z',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initUserSkills(pathId: CareerPathId): Record<string, UserSkill> {
  const path = CAREER_PATHS.find((p) => p.id === pathId)!;
  const result: Record<string, UserSkill> = {};
  path.skillIds.forEach((skillId) => {
    const skill = ALL_SKILLS.find((s) => s.id === skillId)!;
    result[skillId] = {
      skillId,
      status: skill.prerequisites.length === 0 ? 'available' : 'locked',
      outputCount: 0,
    };
  });
  return result;
}

function unlockDependentSkills(
  completedSkillId: string,
  pathId: CareerPathId,
  userSkills: Record<string, UserSkill>
): Record<string, UserSkill> {
  const path = CAREER_PATHS.find((p) => p.id === pathId)!;
  const updated = { ...userSkills };

  path.skillIds.forEach((skillId) => {
    const skill = ALL_SKILLS.find((s) => s.id === skillId)!;
    if (updated[skillId]?.status !== 'locked') return;

    const allPrereqsMet = skill.prerequisites.every(
      (prereqId) => updated[prereqId]?.status === 'completed'
    );
    if (allPrereqsMet) {
      updated[skillId] = { ...updated[skillId], status: 'available' };
    }
  });

  return updated;
}

function checkAchievements(
  outputCount: number,
  completedSkillCount: number,
  xp: number,
  streak: number,
  unlockedIds: string[]
): string[] {
  const newUnlocks: string[] = [];

  if (outputCount >= 1 && !unlockedIds.includes('first-steps')) newUnlocks.push('first-steps');
  if (outputCount >= 5 && !unlockedIds.includes('builder')) newUnlocks.push('builder');
  if (completedSkillCount >= 1 && !unlockedIds.includes('skill-mastered')) newUnlocks.push('skill-mastered');
  if (streak >= 7 && !unlockedIds.includes('consistent')) newUnlocks.push('consistent');
  if (streak >= 14 && !unlockedIds.includes('on-fire')) newUnlocks.push('on-fire');
  if (streak >= 30 && !unlockedIds.includes('thirty-day-legend')) newUnlocks.push('thirty-day-legend');
  if (xp >= 500 && !unlockedIds.includes('evolution')) newUnlocks.push('evolution');
  if (completedSkillCount >= 3 && !unlockedIds.includes('triple-master')) newUnlocks.push('triple-master');

  return newUnlocks;
}

function saveToStorage(data: object): void {
  try {
    localStorage.setItem('skillforge_v1', JSON.stringify(data));
  } catch {
    // Notify UI (e.g. avatar too large) — components listen for this event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('skillforge:storage-quota-exceeded'));
    }
  }
}

function loadFromStorage(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem('skillforge_v1');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface PendingCelebration {
  skillId: string;
  xpGained: number;
  leveledUp: boolean;
  newLevel: number;
}

interface AppState {
  hasOnboarded: boolean;
  user: User | null;
  userSkills: Record<string, UserSkill>;
  outputs: Output[];
  unlockedAchievementIds: string[];
  communityFeed: FeedPost[];
  userFeedPosts: FeedPost[]; // user-generated posts, persisted to localStorage
  pendingCelebration: PendingCelebration | null;
  selectedSkillId: string | null;
  customPaths: CustomPath[];
  prioritizedPathId: string | null; // path pinned to Home (null → falls back to careerPathId)
  roadmaps: RoadmapEntry[]; // lifecycle tracking per enrolled path
  celebratedMilestones: string[]; // tracks "${pathId}-${tierPct}" keys already shown
  showWelcomeCard: boolean; // true on first Dashboard load after onboarding — ephemeral, not persisted
  savedPostIds: string[]; // post IDs bookmarked by the user
  colorScheme: 'dark' | 'light'; // persisted theme preference
  careerOutcomes: CareerOutcome[]; // self-reported real-world career wins

  completeOnboarding: (name: string, pathId: CareerPathId | string, email?: string, experienceLevel?: ExperienceLevel) => void;
  logOutput: (payload: LogOutputPayload) => LogOutputResult;
  reactToPost: (postId: string, emoji: string) => void;
  toggleSavePost: (postId: string) => void;
  setSelectedSkill: (skillId: string | null) => void;
  clearCelebration: () => void;
  resetApp: () => void;
  addCustomPath: (path: { name: string; icon: string; description: string; color: string; skills: CustomSkill[] }) => string; // returns new path ID
  switchPath: (pathId: string) => void;
  setPrioritizedPath: (pathId: string) => void;
  enrollInRoadmap: (pathId: string) => void; // enroll as SECONDARY + init skills
  setPriorityRoadmap: (pathId: string) => void; // promote to PRIORITY, demote current priority to SECONDARY
  pauseRoadmap: (pathId: string) => void; // ACTIVE → PAUSED
  archiveRoadmap: (pathId: string) => void; // → ARCHIVED
  reactivateRoadmap: (pathId: string) => void; // PAUSED/ARCHIVED → ACTIVE SECONDARY
  addRoadmapItem: (name: string, icon: string) => string; // creates item in personal library, returns new skillId
  useStreakFreeze: () => void;
  markMilestoneCelebrated: (key: string) => void;
  dismissWelcomeCard: () => void;
  updateAvatar: (emoji: string) => void;
  updateAvatarImage: (uri: string) => void;
  updateBio: (bio: string) => void;
  updateName: (name: string) => void;
  updateTargetRole: (role: string) => void;
  setComebackGoal: (weeklyGoal: number) => void;
  setPaceMode: (mode: PaceMode) => void;    // sprint / steady / recovery
  validateSkill: (skillId: string) => void; // marks skill validated + grants bonus XP
  logCareerOutcome: (payload: LogOutcomePayload) => number; // returns xpAwarded
  deleteCareerOutcome: (outcomeId: string) => void;
  togglePinOutput: (outputId: string) => void; // pin/unpin output in Portfolio (max 3)
  updateEmail: (email: string) => void;
  deleteOutput: (outputId: string) => void;
  addComment: (postId: string, text: string) => void;
  setColorScheme: (scheme: 'dark' | 'light') => void;
}

const saved = loadFromStorage();

// Re-evaluate achievements against restored state.
// 1. Add any that were earned but not recorded (e.g. pre-fix accounts).
// 2. Remove any that are no longer valid (e.g. output deleted without revoking the badge).
const _savedOutputs: Output[]      = saved?.outputs ?? [];
const _savedUnlocked: string[]      = saved?.unlockedAchievementIds ?? [];
const _savedUser                    = saved?.user ?? null;
const _savedUserSkills              = saved?.userSkills ?? {};
const _savedCompletedSkillCount     = Object.values(_savedUserSkills).filter((us: any) => us.status === 'completed').length;

// Checks whether a given achievement id is still valid given the current saved state
function _achievementStillValid(id: string): boolean {
  if (id === 'first-steps')    return _savedOutputs.length >= 1;
  if (id === 'builder')        return _savedOutputs.length >= 5;
  if (id === 'skill-mastered') return _savedCompletedSkillCount >= 1;
  if (id === 'triple-master')  return _savedCompletedSkillCount >= 3;
  // Streak and XP-threshold achievements are persistent once earned
  return true;
}

const _rehydratedAchievements: string[] = _savedUser
  ? (() => {
      // Step 1: remove any that are no longer valid
      const stillValid = _savedUnlocked.filter(_achievementStillValid);
      // Step 2: add any that were missed (positive rehydration)
      const missed = checkAchievements(
        _savedOutputs.length,
        _savedCompletedSkillCount,
        _savedUser.xp,
        _savedUser.streak,
        stillValid,
      );
      return [...stillValid, ...missed];
    })()
  : _savedUnlocked;

// Heal orphaned XP: if the rehydration revoked achievements, deduct their XP
// so user.xp stays consistent with what the achievements actually granted.
const _revokedOnLoad = _savedUser
  ? _savedUnlocked.filter((id) => !_rehydratedAchievements.includes(id))
  : [];
const _revokedXPOnLoad = _revokedOnLoad.reduce((sum, id) => {
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
  return sum + (ach?.xpGranted ?? 0);
}, 0);

// Also heal NaN in xpGained on stored outputs (guard against corrupt data)
const _savedOutputsHealed = _savedOutputs.map((o) => ({
  ...o,
  xpGained: Number.isFinite(o.xpGained) ? o.xpGained : 0,
}));

// Hard-floor: if there are no outputs AND no streak history (streak + longestStreak both 0),
// ALL earned XP must come from achievements only — there's no way streak milestone bonuses
// accumulated. Strip any phantom output XP from deleted/lost records.
const _validAchievementXP = _rehydratedAchievements.reduce((sum, id) => {
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
  return sum + (ach?.xpGranted ?? 0);
}, 0);
const _healedXP = _savedUser
  ? (() => {
      const afterRevoke = Math.max(0, _savedUser.xp - _revokedXPOnLoad);
      const hasNoHistory =
        _savedOutputsHealed.length === 0 &&
        (_savedUser.streak ?? 0) === 0 &&
        (_savedUser.longestStreak ?? 0) === 0;
      // For users with no outputs and no streak history, cap XP to what valid
      // achievements can account for. Preserves streak milestone XP for active users.
      return hasNoHistory ? Math.min(afterRevoke, _validAchievementXP) : afterRevoke;
    })()
  : 0;

export const useAppStore = create<AppState>((set, get) => ({
  hasOnboarded: saved?.hasOnboarded ?? false,
  user: saved?.user
    ? { ...saved.user, xp: _healedXP, level: getLevelFromXP(_healedXP) }
    : null,
  userSkills: _savedUserSkills,
  outputs: _savedOutputsHealed,
  unlockedAchievementIds: _rehydratedAchievements,
  communityFeed: [...((saved as any)?.userFeedPosts ?? []), ...MOCK_FEED],
  userFeedPosts: (saved as any)?.userFeedPosts ?? [],
  pendingCelebration: null,
  selectedSkillId: null,
  customPaths: (saved as any)?.customPaths ?? [],
  prioritizedPathId: (saved as any)?.prioritizedPathId ?? null,
  roadmaps: (() => {
    const r: RoadmapEntry[] = (saved as any)?.roadmaps ?? [];
    // Migration: existing users with no roadmaps array → create initial PRIORITY entry
    if (r.length === 0 && saved?.hasOnboarded && (saved as any)?.user?.careerPathId) {
      r.push({
        pathId: (saved as any).user.careerPathId,
        priorityStatus: 'PRIORITY',
        roadmapStatus: 'ACTIVE',
        startedAt: (saved as any).user?.joinedAt ?? new Date().toISOString(),
      });
    }
    return r;
  })(),
  celebratedMilestones: (saved as any)?.celebratedMilestones ?? [],
  showWelcomeCard: false,
  savedPostIds: (saved as any)?.savedPostIds ?? [],
  colorScheme: ((saved as any)?.colorScheme ?? 'dark') as 'dark' | 'light',
  careerOutcomes: (saved as any)?.careerOutcomes ?? [],

  completeOnboarding: (name: string, pathId: CareerPathId | string, email?: string, experienceLevel?: ExperienceLevel) => {
    const userId = `user_${Date.now()}`;
    const pathMeta = CAREER_PATHS.find(p => p.id === pathId);
    const isBuiltInPath = !!pathMeta;

    // For custom paths, find the path definition so we can use its icon/color
    const customPathMeta = !isBuiltInPath
      ? get().customPaths.find(p => p.id === pathId)
      : null;

    const user: User = {
      id: userId,
      name,
      handle: name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') || 'explorer',
      email: email?.trim() || undefined,
      careerPathId: pathId,
      xp: 0,
      level: 1,
      streak: 0,
      longestStreak: 0,
      lastActiveDate: new Date().toISOString().slice(0, 10),
      bio: '',
      avatarEmoji: pathMeta?.icon ?? customPathMeta?.icon ?? '⚡',
      avatarColor: pathMeta?.dimColor ?? '#0A0A0F',
      joinedAt: new Date().toISOString(),
      streakFreezes: 0,
      experienceLevel: experienceLevel ?? 'beginner',
    };

    // ── Skills initialization ─────────────────────────────────────────────────
    // Built-in paths: initialize from the catalog. Custom paths: preserve
    // userSkills already set by addCustomPath (called just before this in the
    // onboarding flow) so we don't wipe out the custom skill entries.
    let userSkills = isBuiltInPath ? initUserSkills(pathId as CareerPathId) : { ...get().userSkills };

    // ── Pre-credit skills based on experience level (built-in paths only) ────
    // 'building': mark first skill in_progress (half-way) — they have some foundation
    // 'experienced': mark first 2 skills completed — prior experience credited
    if (isBuiltInPath && pathMeta && (experienceLevel === 'building' || experienceLevel === 'experienced')) {
      const orderedSkillIds = pathMeta.skillIds;
      const now = new Date().toISOString();

      if (experienceLevel === 'building') {
        // Pre-credit skill 1 as in_progress (1 output logged)
        const skill1Id = orderedSkillIds[0];
        if (skill1Id && userSkills[skill1Id]) {
          userSkills = {
            ...userSkills,
            [skill1Id]: { skillId: skill1Id, status: 'in_progress', outputCount: 1 },
          };
        }
      } else {
        // 'experienced': pre-complete first 2 skills, unlock their dependents
        const toPrecredit = orderedSkillIds.slice(0, 2);
        for (const skillId of toPrecredit) {
          if (!userSkills[skillId]) continue;
          const skill = ALL_SKILLS.find((s) => s.id === skillId);
          userSkills = {
            ...userSkills,
            [skillId]: {
              skillId,
              status: 'completed',
              outputCount: skill?.requiredOutputs ?? 1,
              completedAt: now,
            },
          };
          userSkills = unlockDependentSkills(skillId, pathId as CareerPathId, userSkills);
        }
      }
    }

    const initialRoadmap: RoadmapEntry = {
      pathId,
      priorityStatus: 'PRIORITY',
      roadmapStatus: 'ACTIVE',
      startedAt: new Date().toISOString(),
    };
    const state = { hasOnboarded: true, user, userSkills, prioritizedPathId: pathId, roadmaps: [initialRoadmap], showWelcomeCard: true };
    set(state);
    // Anonymous-only analytics: identify by id, never name/email (see analytics.ts).
    identify(userId, { career_path: pathId, joined_at: user.joinedAt });
    track('onboarding_completed', {
      career_path: pathId,
      is_custom_path: !isBuiltInPath,
      has_email: !!email?.trim(),
      experience_level: experienceLevel ?? 'beginner',
    });
  },

  logOutput: (payload: LogOutputPayload): LogOutputResult => {
    const state = get();
    if (!state.user) return { skillCompleted: false, xpGained: 0, leveledUp: false, newLevel: 1 };

    const skill = ALL_SKILLS.find((s) => s.id === payload.skillId);

    // For custom path items (not in ALL_SKILLS catalog), find the skill in customPaths
    let customSkillName: string | null = null;
    if (!skill) {
      for (const cp of state.customPaths) {
        const cs = cp.skills.find((s) => s.id === payload.skillId);
        if (cs) { customSkillName = cs.name; break; }
      }
      if (customSkillName === null) {
        // Not tied to any milestone — still award XP for the work done
        customSkillName = 'General Work';
      }
    }
    const skillName = skill?.name ?? customSkillName!;

    const OUTPUT_XP_BY_TYPE: Record<string, number> = {
      project:    75,
      cert:       200,
      github:     60,
      book:       50,
      script:     50,
      diagram:    75,
      reflection: 30, // lighter-weight — recovery-mode engagement
      event:      65, // workshops, activities, events organised — real-world execution
      other:      50, // catch-all for anything that doesn't fit another category
    };
    const baseXP = OUTPUT_XP_BY_TYPE[payload.type] ?? 50;
    // ISSUE-010: quality bonuses — reward detailed descriptions and key takeaways
    const qualityBonus = payload.description.length >= 120 ? 20
      : payload.description.length >= 50 ? 10
      : 0;
    const takeawayBonus = (payload.keyTakeaway?.trim().length ?? 0) > 0 ? 15 : 0;
    const OUTPUT_XP = baseXP + qualityBonus + takeawayBonus;
    const existingUserSkill = state.userSkills[payload.skillId] ?? {
      skillId: payload.skillId,
      status: 'available' as SkillStatus,
      outputCount: 0,
    };

    const newOutputCount = existingUserSkill.outputCount + 1;
    // Custom items complete after 1 output; built-in skills use their requiredOutputs
    const requiredOutputs = skill?.requiredOutputs ?? 1;
    const wouldComplete = newOutputCount >= requiredOutputs;

    // ── Evidence gate (built-in skills only) ────────────────────────────────
    // A skill may not complete unless at least one of its outputs is 'verified'
    // (has a link) or 'documented' (description ≥ 80 chars). This prevents
    // users from spamming minimal entries to fake mastery.
    const currentEvidenceTier = getEvidenceTier(payload.link, payload.description);
    let evidenceRequired = false;
    if (wouldComplete && skill) {
      const hasQualityEvidence =
        currentEvidenceTier !== 'logged' || // current output qualifies
        state.outputs
          .filter((o) => o.skillId === payload.skillId)
          .some((o) => {
            const t = o.evidenceTier ?? getEvidenceTier(o.link, o.description);
            return t !== 'logged';
          });
      evidenceRequired = !hasQualityEvidence;
    }

    const skillCompleted = wouldComplete && !evidenceRequired;
    // Only built-in skills award bonus XP on completion
    const skillXP = skillCompleted && skill ? skill.xpReward : 0;
    const totalXPGained = OUTPUT_XP + skillXP;

    const newXP = state.user.xp + totalXPGained;
    const oldLevel = state.user.level;
    const newLevel = getLevelFromXP(newXP);
    const leveledUp = newLevel > oldLevel;

    const newOutput: Output = {
      id: `out_${Date.now()}`,
      skillId: payload.skillId,
      skillName,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      link: payload.link,
      xpGained: totalXPGained,
      createdAt: new Date().toISOString(),
      evidenceTier: currentEvidenceTier,
    };

    let updatedUserSkills = {
      ...state.userSkills,
      [payload.skillId]: {
        ...existingUserSkill,
        outputCount: newOutputCount,
        status: skillCompleted
          ? ('completed' as SkillStatus)
          : ('in_progress' as SkillStatus),
        completedAt: skillCompleted ? new Date().toISOString() : undefined,
      },
    };

    // Only unlock dependent skills for built-in career path skills (use skill's own pathId, not enrolled path)
    if (skillCompleted && skill && CAREER_PATHS.some(p => p.id === skill.pathId)) {
      updatedUserSkills = unlockDependentSkills(payload.skillId, skill.pathId as CareerPathId, updatedUserSkills);
    }

    // Unlock next skill in custom path sequence when current skill completes
    if (skillCompleted && !skill) {
      for (const cp of state.customPaths) {
        const idx = cp.skills.findIndex(s => s.id === payload.skillId);
        if (idx >= 0 && idx < cp.skills.length - 1) {
          const nextSkill = cp.skills[idx + 1];
          if (updatedUserSkills[nextSkill.id]?.status === 'locked') {
            updatedUserSkills = {
              ...updatedUserSkills,
              [nextSkill.id]: {
                skillId: nextSkill.id,
                status: 'available' as SkillStatus,
                outputCount: updatedUserSkills[nextSkill.id]?.outputCount ?? 0,
              },
            };
          }
          break;
        }
      }
    }

    const newOutputs = [...state.outputs, newOutput];

    // Check achievements
    const completedSkillCount = Object.values(updatedUserSkills).filter(
      (us) => us.status === 'completed'
    ).length;
    const newAchievementIds = checkAchievements(
      newOutputs.length,
      completedSkillCount,
      newXP,
      state.user.streak,
      state.unlockedAchievementIds
    );
    const bonusXP = newAchievementIds.reduce((sum, id) => {
      const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
      return sum + (ach?.xpGranted ?? 0);
    }, 0);

    const finalXP = newXP + bonusXP;
    const finalLevel = getLevelFromXP(finalXP);

    // ── Streak calculation ────────────────────────────────────────────────────
    // Compare today's date (local) against the last date the user logged anything.
    const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const lastActive = state.user.lastActiveDate;
    let newStreak = state.user.streak;

    if (!lastActive) {
      // First ever log — start at 1
      newStreak = 1;
    } else if (lastActive === todayStr) {
      // Already logged today — streak unchanged
      newStreak = state.user.streak;
    } else {
      // Check consecutive / grace-period / broken
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

      if (lastActive === yesterdayStr) {
        newStreak = state.user.streak + 1; // consecutive day
      } else if (lastActive === twoDaysAgoStr) {
        newStreak = state.user.streak; // grace period: preserve streak, don't increment
      } else {
        newStreak = 1; // streak broken
      }
    }

    const newLongestStreak = Math.max(state.user.longestStreak, newStreak);

    // Award a streak freeze when streak first hits a multiple of 7
    const hitsFreezeMilestone = newStreak > 0 && newStreak % 7 === 0 && state.user.streak % 7 !== 0;
    const newFreezes = (state.user.streakFreezes ?? 0) + (hitsFreezeMilestone ? 1 : 0);

    // One-time milestone bonus when streak first crosses 7 / 14 / 30
    const streakMilestoneBonus =
      (newStreak === 7  && state.user.streak < 7)  ? 25  :
      (newStreak === 14 && state.user.streak < 14) ? 50  :
      (newStreak === 30 && state.user.streak < 30) ? 100 : 0;

    // Re-check streak-based achievements with the updated streak value
    const streakAchievementIds = checkAchievements(
      newOutputs.length,
      completedSkillCount,
      finalXP,
      newStreak,
      [...state.unlockedAchievementIds, ...newAchievementIds]
    );
    const streakAchievementBonusXP = streakAchievementIds.reduce((sum, id) => {
      const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
      return sum + (ach?.xpGranted ?? 0);
    }, 0);
    const absoluteFinalXP = finalXP + streakAchievementBonusXP + streakMilestoneBonus;
    const absoluteFinalLevel = getLevelFromXP(absoluteFinalXP);
    const allNewAchievementIds = [...newAchievementIds, ...streakAchievementIds];

    const updatedUser: User = {
      ...state.user,
      xp: absoluteFinalXP,
      level: absoluteFinalLevel,
      streak: newStreak,
      longestStreak: newLongestStreak,
      lastActiveDate: todayStr,
      streakFreezes: newFreezes,
    };

    // Add to feed
    const feedPost: FeedPost = {
      id: `fp_${Date.now()}`,
      userId: state.user.id,
      userName: state.user.name,
      userHandle: state.user.handle,
      avatarEmoji: state.user.avatarEmoji,
      avatarColor: state.user.avatarColor,
      avatarUri: state.user.avatarUri,
      // Use the logged skill's actual pathId so secondary-roadmap posts appear under the correct path filter.
      // Fall back to the user's primary careerPathId for custom skills (they have no built-in pathId).
      pathId: skill?.pathId ?? state.user.careerPathId,
      pathLabel: CAREER_PATHS.find((p) => p.id === (skill?.pathId ?? state.user!.careerPathId))?.name ?? '',
      pathColor: CAREER_PATHS.find((p) => p.id === (skill?.pathId ?? state.user!.careerPathId))?.color ?? '#7C3AED',
      type: skillCompleted ? 'milestone' : 'output',
      skillId: payload.skillId,
      skillName,
      outputTitle: payload.title,
      content: payload.description,
      xpGained: totalXPGained,
      reactions: {},
      userReactions: [],
      comments: [],
      timestamp: new Date().toISOString(),
      isCurrentUser: true,
    };

    const updatedUserFeedPosts = [feedPost, ...state.userFeedPosts];
    const updatedFeed = [feedPost, ...state.communityFeed];
    const updatedAchievementIds = [...state.unlockedAchievementIds, ...allNewAchievementIds];

    const celebration: PendingCelebration | null = skillCompleted
      ? { skillId: payload.skillId, xpGained: totalXPGained, leveledUp: absoluteFinalLevel > oldLevel, newLevel: absoluteFinalLevel }
      : null;

    const newState = {
      user: updatedUser,
      userSkills: updatedUserSkills,
      outputs: newOutputs,
      communityFeed: updatedFeed,
      userFeedPosts: updatedUserFeedPosts,
      unlockedAchievementIds: updatedAchievementIds,
      pendingCelebration: celebration,
    };

    set(newState);

    // ── Analytics ─────────────────────────────────────────────────────────────
    const daysSinceJoin = state.user.joinedAt
      ? Math.floor((Date.now() - new Date(state.user.joinedAt).getTime()) / 86_400_000)
      : 0;
    const isFirstOutput = newOutputs.length === 1;
    if (isFirstOutput && state.user.joinedAt) {
      const minutesSinceJoin = Math.round(
        (Date.now() - new Date(state.user.joinedAt).getTime()) / 60_000
      );
      track('first_output_logged', {
        output_type: payload.type,
        skill_id: payload.skillId,
        skill_name: skillName,
        xp_gained: totalXPGained,
        time_to_first_output_minutes: minutesSinceJoin,
        career_path: state.user.careerPathId,
      });
    }
    track('output_logged', {
      output_type: payload.type,
      skill_id: payload.skillId,
      skill_name: skillName,
      xp_gained: totalXPGained,
      total_outputs: newOutputs.length,
      is_first_output: isFirstOutput,
      days_since_join: daysSinceJoin,
      streak: newStreak,
    });
    if (skillCompleted) {
      track('skill_completed', {
        skill_id: payload.skillId,
        skill_name: skillName,
        xp_reward: skill?.xpReward ?? 0,
        rarity: skill?.rarity ?? 'common',
        output_count: newOutputCount,
      });
    }
    if (absoluteFinalLevel > oldLevel) {
      track('level_up', { old_level: oldLevel, new_level: absoluteFinalLevel, total_xp: absoluteFinalXP });
    }
    allNewAchievementIds.forEach((achId) => {
      const ach = ALL_ACHIEVEMENTS.find((a) => a.id === achId);
      if (ach) track('achievement_unlocked', { achievement_id: achId, achievement_title: ach.title, rarity: ach.rarity });
    });
    if (streakMilestoneBonus > 0) {
      track('streak_milestone', { streak: newStreak, bonus_xp: streakMilestoneBonus });
    }
    // Retention milestone events — fire once per cohort day (D1 / D7 / D30)
    if (daysSinceJoin === 1 && newOutputs.length === 1) {
      track('retention_d1_activated');
    } else if (daysSinceJoin === 7) {
      track('retention_d7', { total_outputs: newOutputs.length, streak: newStreak });
    } else if (daysSinceJoin === 30) {
      track('retention_d30', { total_outputs: newOutputs.length, streak: newStreak });
    }
    // ─────────────────────────────────────────────────────────────────────────

    return {
      skillCompleted,
      xpGained: totalXPGained,
      leveledUp: absoluteFinalLevel > oldLevel,
      newLevel: absoluteFinalLevel,
      newSkillId: skillCompleted ? payload.skillId : undefined,
      streakBonusXP: streakMilestoneBonus > 0 ? streakMilestoneBonus : undefined,
      newStreak,
      evidenceRequired: evidenceRequired || undefined,
    };
  },

  reactToPost: (postId: string, emoji: string) => {
    const state = get();
    const post = state.communityFeed.find(p => p.id === postId);
    const wasReacted = post?.userReactions.includes(emoji) ?? false;
    const updatedFeed = state.communityFeed.map((post) => {
      if (post.id !== postId) return post;
      const hasReacted = post.userReactions.includes(emoji);
      const newReactions = { ...post.reactions };
      const newUserReactions = [...post.userReactions];

      if (hasReacted) {
        newReactions[emoji] = Math.max(0, (newReactions[emoji] ?? 1) - 1);
        if (newReactions[emoji] === 0) delete newReactions[emoji];
        return { ...post, reactions: newReactions, userReactions: newUserReactions.filter((e) => e !== emoji) };
      } else {
        newReactions[emoji] = (newReactions[emoji] ?? 0) + 1;
        return { ...post, reactions: newReactions, userReactions: [...newUserReactions, emoji] };
      }
    });
    // Keep userFeedPosts in sync so reactions on user's own posts survive reload
    const updatedUserFeedPosts = state.userFeedPosts.map(p => {
      const updated = updatedFeed.find(f => f.id === p.id);
      return updated ?? p;
    });
    set({ communityFeed: updatedFeed, userFeedPosts: updatedUserFeedPosts });
    if (!wasReacted) {
      track('post_reacted', { post_id: postId, emoji, post_type: post?.type });
    }
  },

  toggleSavePost: (postId: string) => {
    const current = get().savedPostIds;
    const isSaved = current.includes(postId);
    const updated = isSaved ? current.filter((id) => id !== postId) : [...current, postId];
    set({ savedPostIds: updated });
    saveToStorage({ ...get(), savedPostIds: updated });
  },

  setSelectedSkill: (skillId: string | null) => set({ selectedSkillId: skillId }),

  clearCelebration: () => set({ pendingCelebration: null }),

  resetApp: () => {
    try { localStorage.removeItem('skillforge_v1'); } catch {}
    set({
      hasOnboarded: false,
      user: null,
      userSkills: {},
      outputs: [],
      unlockedAchievementIds: [],
      communityFeed: MOCK_FEED,
      userFeedPosts: [],
      pendingCelebration: null,
      customPaths: [],
      prioritizedPathId: null,
      roadmaps: [],
      celebratedMilestones: [],
    });
  },

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

  useStreakFreeze: () => {
    const state = get();
    if (!state.user || (state.user.streakFreezes ?? 0) <= 0) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const updatedUser = {
      ...state.user,
      streakFreezes: (state.user.streakFreezes ?? 1) - 1,
      lastActiveDate: todayStr, // mark today as active so streak won't break tonight
    };
    set({ user: updatedUser });
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

  markMilestoneCelebrated: (key: string) => {
    const state = get();
    if (state.celebratedMilestones.includes(key)) return; // idempotent
    const updated = [...state.celebratedMilestones, key];
    set({ celebratedMilestones: updated });
  },

  dismissWelcomeCard: () => {
    set({ showWelcomeCard: false });
    // Not persisted — ephemeral for the current session only
  },

  updateAvatar: (emoji: string) => {
    const state = get();
    if (!state.user) return;
    // Switching back to emoji clears any uploaded photo
    set({ user: { ...state.user, avatarEmoji: emoji, avatarUri: undefined } });
  },

  updateAvatarImage: (uri: string) => {
    const state = get();
    if (!state.user) return;
    set({ user: { ...state.user, avatarUri: uri } });
  },

  updateBio: (bio: string) => {
    const state = get();
    if (!state.user) return;
    set({ user: { ...state.user, bio } });
  },

  updateName: (name: string) => {
    const state = get();
    if (!state.user) return;
    const handle = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') || 'user';
    set({ user: { ...state.user, name, handle } });
  },

  updateTargetRole: (role: string) => {
    const state = get();
    if (!state.user) return;
    set({ user: { ...state.user, targetRole: role.trim() || undefined } });
  },

  setComebackGoal: (weeklyGoal: number) => {
    const state = get();
    if (!state.user) return;
    set({ user: { ...state.user, weeklyOutputGoal: weeklyGoal } });
  },

  setPaceMode: (mode: PaceMode) => {
    const state = get();
    if (!state.user) return;
    set({ user: { ...state.user, paceMode: mode } });
    track('pace_mode_set', { mode });
  },

  validateSkill: (skillId: string) => {
    const state = get();
    if (!state.user) return;
    const us = state.userSkills[skillId];
    if (!us || us.status !== 'completed' || us.validated) return; // guard: must be completed and not already validated
    const VALIDATION_BONUS_XP = 50;
    const newXP = state.user.xp + VALIDATION_BONUS_XP;
    const newLevel = getLevelFromXP(newXP);
    set({
      user: { ...state.user, xp: newXP, level: newLevel },
      userSkills: {
        ...state.userSkills,
        [skillId]: {
          ...us,
          validated: true,
          validatedAt: new Date().toISOString(),
        },
      },
    });
  },

  updateEmail: (email: string) => {
    const state = get();
    if (!state.user) return;
    set({ user: { ...state.user, email: email.trim() || undefined } });
  },

  deleteOutput: (outputId: string) => {
    const state = get();
    if (!state.user) return;

    const output = state.outputs.find((o) => o.id === outputId);
    if (!output) return;

    const newOutputs = state.outputs.filter((o) => o.id !== outputId);

    // Recompute skill output count from remaining outputs (source of truth)
    const remainingForSkill = newOutputs.filter((o) => o.skillId === output.skillId).length;
    const skill = ALL_SKILLS.find((s) => s.id === output.skillId);
    const requiredOutputs = skill?.requiredOutputs ?? 1;

    const newUserSkills = { ...state.userSkills };
    const existingUs = state.userSkills[output.skillId];
    if (existingUs) {
      let newStatus: SkillStatus = existingUs.status;
      // Revert completed → in_progress / available if we no longer meet the bar
      if (existingUs.status === 'completed' && remainingForSkill < requiredOutputs) {
        newStatus = remainingForSkill > 0 ? 'in_progress' : 'available';
      } else if (existingUs.status === 'in_progress' && remainingForSkill === 0) {
        newStatus = 'available';
      }
      newUserSkills[output.skillId] = {
        ...existingUs,
        outputCount: remainingForSkill,
        status: newStatus,
        completedAt: newStatus === 'completed' ? existingUs.completedAt : undefined,
      };
    }

    // Deduct exactly the XP that was awarded when this output was logged.
    // Guard against NaN/undefined in stored xpGained (shouldn't happen, but legacy data may differ).
    const safeOutputXP = Number.isFinite(output.xpGained) ? output.xpGained : 0;
    const xpAfterOutput = Math.max(0, state.user.xp - safeOutputXP);

    // Re-evaluate output-count and skill-count achievements — revoke ones that
    // the user no longer qualifies for after this deletion (e.g. deleting the
    // only output means 'first-steps' is no longer earned).
    const newCompletedSkillCount = Object.values(newUserSkills).filter(
      (us) => us.status === 'completed'
    ).length;
    const achievementsToRevoke = state.unlockedAchievementIds.filter((id) => {
      if (id === 'first-steps')    return newOutputs.length < 1;
      if (id === 'builder')        return newOutputs.length < 5;
      if (id === 'skill-mastered') return newCompletedSkillCount < 1;
      if (id === 'triple-master')  return newCompletedSkillCount < 3;
      // Streak and XP-threshold achievements are not revoked by output deletion
      return false;
    });
    const revokedAchievementXP = achievementsToRevoke.reduce((sum, id) => {
      const ach = ALL_ACHIEVEMENTS.find((a) => a.id === id);
      return sum + (ach?.xpGranted ?? 0);
    }, 0);

    const finalXP = Math.max(0, xpAfterOutput - revokedAchievementXP);
    const newLevel = getLevelFromXP(finalXP);
    const newUser = { ...state.user, xp: finalXP, level: newLevel };
    const updatedAchievementIds = state.unlockedAchievementIds.filter(
      (id) => !achievementsToRevoke.includes(id)
    );

    // Remove the feed post generated by this output (match on skillId + title + isCurrentUser).
    // This ensures the community feed stays in sync when outputs are deleted.
    const updatedUserFeedPosts = state.userFeedPosts.filter(
      (p) => !(p.isCurrentUser && p.skillId === output.skillId && p.outputTitle === output.title)
    );
    const updatedCommunityFeed = [
      ...updatedUserFeedPosts,
      ...state.communityFeed.filter((p) => !p.isCurrentUser),
    ];

    const totalXPDeducted = safeOutputXP + revokedAchievementXP;
    set({ outputs: newOutputs, userSkills: newUserSkills, user: newUser, unlockedAchievementIds: updatedAchievementIds, userFeedPosts: updatedUserFeedPosts, communityFeed: updatedCommunityFeed });
    track('output_deleted', { output_type: output.type, xp_deducted: totalXPDeducted, achievements_revoked: achievementsToRevoke.length });
  },

  logCareerOutcome: (payload: LogOutcomePayload): number => {
    const state = get();
    if (!state.user) return 0;

    const xpAwarded = OUTCOME_XP[payload.type];
    const newXP = state.user.xp + xpAwarded;
    const newLevel = getLevelFromXP(newXP);

    const outcome: CareerOutcome = {
      id: `outcome_${Date.now()}`,
      type: payload.type,
      title: payload.title.trim(),
      company: payload.company?.trim() || undefined,
      note: payload.note?.trim() || undefined,
      xpAwarded,
      date: payload.date,
      createdAt: new Date().toISOString(),
    };

    // Build a feed post so the win shows up in the community feed
    const pathEntry = CAREER_PATHS.find((p) => p.id === state.user!.careerPathId);
    const winLabels: Record<OutcomeType, string> = {
      interview:       '🎯 Landed an interview',
      offer:           '🎉 Received a job offer',
      promotion:       '🚀 Got promoted',
      role_change:     '✨ Changed roles',
      certification:   '🏅 Earned a certification',
      salary_increase: '💰 Got a raise',
      portfolio:       '🌐 Published to portfolio',
      freelance:       '💼 Won a freelance client',
    };
    const winContent = payload.company
      ? `${winLabels[payload.type]}: ${payload.title.trim()} @ ${payload.company.trim()}${payload.note ? ` — ${payload.note.trim()}` : ''}`
      : `${winLabels[payload.type]}: ${payload.title.trim()}${payload.note ? ` — ${payload.note.trim()}` : ''}`;

    const winPost: FeedPost = {
      id: `fp_win_${Date.now()}`,
      userId: state.user.id,
      userName: state.user.name,
      userHandle: state.user.handle,
      avatarEmoji: state.user.avatarEmoji,
      avatarColor: state.user.avatarColor,
      avatarUri: state.user.avatarUri,
      pathId: state.user.careerPathId,
      pathLabel: pathEntry?.name ?? 'Career',
      pathColor: pathEntry?.color ?? Colors.primary,
      type: 'career_win',
      outcomeType: payload.type,
      content: winContent,
      xpGained: xpAwarded,
      reactions: {},
      userReactions: [],
      comments: [],
      timestamp: new Date().toISOString(),
      isCurrentUser: true,
    };

    const updatedUserFeedPosts = [winPost, ...state.userFeedPosts];
    const updatedFeed = [winPost, ...state.communityFeed];

    set({
      careerOutcomes: [outcome, ...state.careerOutcomes],
      user: { ...state.user, xp: newXP, level: newLevel },
      userFeedPosts: updatedUserFeedPosts,
      communityFeed: updatedFeed,
    });
    track('career_outcome_logged', { type: payload.type, xp_awarded: xpAwarded });
    return xpAwarded;
  },

  deleteCareerOutcome: (outcomeId: string) => {
    const state = get();
    if (!state.user) return;
    const outcome = state.careerOutcomes.find((o) => o.id === outcomeId);
    if (!outcome) return;
    const newXP = Math.max(0, state.user.xp - outcome.xpAwarded);
    const newLevel = getLevelFromXP(newXP);
    set({
      careerOutcomes: state.careerOutcomes.filter((o) => o.id !== outcomeId),
      user: { ...state.user, xp: newXP, level: newLevel },
    });
    track('career_outcome_deleted', { type: outcome.type });
  },

  togglePinOutput: (outputId: string) => {
    const state = get();
    if (!state.user) return;
    const current = state.user.pinnedOutputIds ?? [];
    const isPinned = current.includes(outputId);
    const MAX_PINS = 3;
    let updated: string[];
    if (isPinned) {
      updated = current.filter((id) => id !== outputId);
    } else {
      if (current.length >= MAX_PINS) return; // already at max, do nothing
      updated = [...current, outputId];
    }
    set({ user: { ...state.user, pinnedOutputIds: updated } });
    track('portfolio_pin_toggled', { pinned: !isPinned, output_id: outputId });
  },

  addComment: (postId: string, text: string) => {
    const state = get();
    if (!state.user || !text.trim()) return;
    const isOwnPost = state.communityFeed.find((p) => p.id === postId)?.isCurrentUser ?? false;
    const newComment = {
      id: `c_${Date.now()}`,
      userId: state.user.id,
      userName: state.user.name,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const updatedFeed = state.communityFeed.map((post) =>
      post.id !== postId ? post : { ...post, comments: [...post.comments, newComment] }
    );
    // Keep userFeedPosts in sync so comments on user's own posts survive reload
    const updatedUserFeedPosts = state.userFeedPosts.map(p => {
      const updated = updatedFeed.find(f => f.id === p.id);
      return updated ?? p;
    });
    set({ communityFeed: updatedFeed, userFeedPosts: updatedUserFeedPosts });
    track('comment_posted', { post_id: postId, is_own_post: isOwnPost });
  },

  setColorScheme: (scheme: 'dark' | 'light') => {
    set({ colorScheme: scheme });
  },
}));

// ─── Persistence Subscriber ───────────────────────────────────────────────────
// Single source-of-truth for what gets persisted. Fires on every state change;
// short-circuits via reference equality when no persisted field changed.
// Adding a new persisted field requires only updating AppState + this selector.

function getPersistable(state: AppState) {
  return {
    hasOnboarded: state.hasOnboarded,
    user: state.user,
    userSkills: state.userSkills,
    outputs: state.outputs,
    unlockedAchievementIds: state.unlockedAchievementIds,
    customPaths: state.customPaths,
    prioritizedPathId: state.prioritizedPathId,
    roadmaps: state.roadmaps,
    celebratedMilestones: state.celebratedMilestones,
    userFeedPosts: state.userFeedPosts,
    savedPostIds: state.savedPostIds,
    colorScheme: state.colorScheme,
    careerOutcomes: state.careerOutcomes,
  };
}

let _lastPersisted: ReturnType<typeof getPersistable> | null = null;

useAppStore.subscribe((state) => {
  const p = getPersistable(state);
  if (
    _lastPersisted !== null &&
    _lastPersisted.hasOnboarded === p.hasOnboarded &&
    _lastPersisted.user === p.user &&
    _lastPersisted.userSkills === p.userSkills &&
    _lastPersisted.outputs === p.outputs &&
    _lastPersisted.unlockedAchievementIds === p.unlockedAchievementIds &&
    _lastPersisted.customPaths === p.customPaths &&
    _lastPersisted.prioritizedPathId === p.prioritizedPathId &&
    _lastPersisted.roadmaps === p.roadmaps &&
    _lastPersisted.celebratedMilestones === p.celebratedMilestones &&
    _lastPersisted.userFeedPosts === p.userFeedPosts &&
    _lastPersisted.savedPostIds === p.savedPostIds &&
    _lastPersisted.colorScheme === p.colorScheme &&
    _lastPersisted.careerOutcomes === p.careerOutcomes
  ) return;
  _lastPersisted = p;
  saveToStorage(p);
});
