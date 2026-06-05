// ─── Market Demand — Curated Seed Data ────────────────────────────────────────
// Manually researched demand levels for PH tech job market (June 2026).
// Source: human curation of JobStreet PH, Kalibrr, LinkedIn PH job postings.
// Refreshed: monthly by the SkillForge team (update CURATED_DATE when revised).
//
// Levels:
//   high    — consistently in the top skills demanded across 60%+ of postings for this role
//   rising  — growing in frequency over the last 90 days; not yet dominant
//   stable  — baseline expectation; present but not differentiating
//
// Community signals supplement these over time. Once signalCount > 10 for any skill,
// the community data is blended in by the fetchMarketDemand() helper (source → 'mixed').

import type { MarketDemand } from '../types';

export const CURATED_DATE = '2026-06-01';

export const CURATED_MARKET_DEMAND: MarketDemand[] = [
  // ── Data Architect ──────────────────────────────────────────────────────────
  { skillId: 'sql-foundations',        pathId: 'data-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'python-automation',      pathId: 'data-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'snowflake-engineering',  pathId: 'data-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'data-modeling',          pathId: 'data-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ai-workflow-design',     pathId: 'data-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── AI Engineer ─────────────────────────────────────────────────────────────
  { skillId: 'python-fundamentals',    pathId: 'ai-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'rest-apis',              pathId: 'ai-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'prompt-engineering',     pathId: 'ai-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'vector-databases',       pathId: 'ai-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'rag-systems',            pathId: 'ai-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ai-agents',              pathId: 'ai-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Full Stack ───────────────────────────────────────────────────────────────
  { skillId: 'html-css',               pathId: 'fullstack', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'javascript',             pathId: 'fullstack', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'react-rn',               pathId: 'fullstack', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'backend-apis',           pathId: 'fullstack', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'database-design',        pathId: 'fullstack', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cloud-deployment',       pathId: 'fullstack', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Data Engineer ────────────────────────────────────────────────────────────
  { skillId: 'de-python-data',         pathId: 'data-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'de-sql-advanced',        pathId: 'data-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'de-spark-processing',    pathId: 'data-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'de-airflow-pipelines',   pathId: 'data-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'de-kafka-streaming',     pathId: 'data-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── ML Engineer ─────────────────────────────────────────────────────────────
  { skillId: 'ml-python-stats',        pathId: 'ml-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ml-sklearn-algorithms',  pathId: 'ml-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ml-deep-learning',       pathId: 'ml-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ml-mlops',               pathId: 'ml-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ml-feature-engineering', pathId: 'ml-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Backend Engineer ─────────────────────────────────────────────────────────
  { skillId: 'be-language-core',       pathId: 'backend-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'be-rest-design',         pathId: 'backend-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'be-database-optimization', pathId: 'backend-engineer', level: 'high', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'be-auth-security',       pathId: 'backend-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'be-microservices',       pathId: 'backend-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Frontend Engineer ────────────────────────────────────────────────────────
  { skillId: 'fe-html-css-js',         pathId: 'frontend-engineer', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'fe-react-framework',     pathId: 'frontend-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'fe-typescript',          pathId: 'frontend-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'fe-performance',         pathId: 'frontend-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'fe-testing-a11y',        pathId: 'frontend-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Cloud Engineer ───────────────────────────────────────────────────────────
  { skillId: 'cloud-core-services',    pathId: 'cloud-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cloud-iac',              pathId: 'cloud-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cloud-containers',       pathId: 'cloud-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cloud-networking',       pathId: 'cloud-engineer', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cloud-security',         pathId: 'cloud-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── DevOps ───────────────────────────────────────────────────────────────────
  { skillId: 'devops-linux',           pathId: 'devops', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'devops-cicd',            pathId: 'devops', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'devops-kubernetes',      pathId: 'devops', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'devops-monitoring',      pathId: 'devops', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'devops-security',        pathId: 'devops', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Cybersecurity ────────────────────────────────────────────────────────────
  { skillId: 'cyber-networking',       pathId: 'cybersecurity', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cyber-threat-analysis',  pathId: 'cybersecurity', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cyber-pentesting',       pathId: 'cybersecurity', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cyber-siem',             pathId: 'cybersecurity', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cyber-cloud-security',   pathId: 'cybersecurity', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Product Manager ──────────────────────────────────────────────────────────
  { skillId: 'pm-discovery',           pathId: 'product-manager', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pm-roadmapping',         pathId: 'product-manager', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pm-metrics',             pathId: 'product-manager', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pm-stakeholders',        pathId: 'product-manager', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pm-ai-product',          pathId: 'product-manager', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Business Analyst ─────────────────────────────────────────────────────────
  { skillId: 'ba-requirements',        pathId: 'business-analyst', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ba-sql-reporting',       pathId: 'business-analyst', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ba-process-mapping',     pathId: 'business-analyst', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ba-excel-advanced',      pathId: 'business-analyst', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ba-ai-tools',            pathId: 'business-analyst', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Data Analyst ─────────────────────────────────────────────────────────────
  { skillId: 'da-sql',                 pathId: 'data-analyst', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'da-visualization',       pathId: 'data-analyst', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'da-python-analysis',     pathId: 'data-analyst', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'da-statistics',          pathId: 'data-analyst', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'da-storytelling',        pathId: 'data-analyst', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Project Manager ──────────────────────────────────────────────────────────
  { skillId: 'pjm-agile',              pathId: 'project-manager', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pjm-risk',               pathId: 'project-manager', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pjm-tools',              pathId: 'project-manager', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pjm-stakeholders',       pathId: 'project-manager', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pjm-ai-automation',      pathId: 'project-manager', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Solutions Architect ──────────────────────────────────────────────────────
  { skillId: 'sa-cloud-platforms',     pathId: 'solutions-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sa-system-design',       pathId: 'solutions-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sa-security-arch',       pathId: 'solutions-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sa-cost-optimization',   pathId: 'solutions-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sa-ai-integration',      pathId: 'solutions-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Software Architect ───────────────────────────────────────────────────────
  { skillId: 'swa-design-patterns',    pathId: 'software-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'swa-microservices',      pathId: 'software-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'swa-api-strategy',       pathId: 'software-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'swa-observability',      pathId: 'software-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'swa-ai-architecture',    pathId: 'software-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Mobile Developer ─────────────────────────────────────────────────────────
  { skillId: 'mob-react-native',       pathId: 'mobile-developer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'mob-state-management',   pathId: 'mobile-developer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'mob-native-apis',        pathId: 'mobile-developer', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'mob-performance',        pathId: 'mobile-developer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'mob-publishing',         pathId: 'mobile-developer', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── UI/UX Designer ───────────────────────────────────────────────────────────
  { skillId: 'ux-research',            pathId: 'ui-ux-designer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ux-figma',               pathId: 'ui-ux-designer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ux-design-systems',      pathId: 'ui-ux-designer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ux-prototyping',         pathId: 'ui-ux-designer', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ux-ai-ux',               pathId: 'ui-ux-designer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Startup Founder ──────────────────────────────────────────────────────────
  { skillId: 'sf-validation',          pathId: 'startup-founder', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sf-mvp-building',        pathId: 'startup-founder', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sf-growth',              pathId: 'startup-founder', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sf-fundraising',         pathId: 'startup-founder', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sf-ai-leverage',         pathId: 'startup-founder', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
];

/** O(1) lookup: skillId → MarketDemand */
export const MARKET_DEMAND_MAP: Record<string, MarketDemand> = Object.fromEntries(
  CURATED_MARKET_DEMAND.map((d) => [d.skillId, d])
);
