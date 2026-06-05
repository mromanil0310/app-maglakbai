// ─── Market Demand — Curated Seed Data ────────────────────────────────────────
// Demand levels are derived from a cross-reference of three publicly available
// industry reports covering the 2025–2026 tech job market:
//
//   • Stack Overflow Developer Survey 2025 — 49,000+ developers across 177 countries.
//     Covers most-used and most-wanted technologies, hiring manager priorities.
//     https://survey.stackoverflow.co/2025/technology
//
//   • LinkedIn Skills on the Rise 2026 / Jobs on the Rise 2026 — based on actual
//     LinkedIn job posting data, identifies fastest-growing roles and skills.
//     https://news.linkedin.com/2026/Skills-on-the-rise-2026
//
//   • GitHub Octoverse 2025 — language and tool adoption trends across 100M+ repos.
//     TypeScript overtook Python/JS; Python dominates AI/data; Docker saw largest
//     single-year usage jump of any technology surveyed.
//     https://octoverse.github.com/
//
// Levels:
//   high    — consistently appears in top demanded skills per the sources above
//   rising  — growing in frequency; not yet dominant but clearly trending up
//   stable  — baseline expectation for the role; present but not differentiating
//
// ⚠️  Skill IDs here must exactly match the `id` field in src/data/skills.ts.
//     Run `grep "id:" src/data/skills.ts` to verify before adding new entries.
//
// Community signals supplement these over time. Once signalCount > 10 for any
// skill, community data is blended in by fetchMarketDemand() (source → 'mixed').
// Refresh CURATED_DATE when levels are updated against new report editions.

import type { MarketDemand } from '../types';

export const CURATED_DATE = '2026-06-01';

/** Attribution string shown in the UI alongside demand labels. */
export const DEMAND_SOURCE_LABEL = 'Stack Overflow · LinkedIn · GitHub';

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
  { skillId: 'be-language-core',         pathId: 'backend-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'be-rest-design',           pathId: 'backend-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'be-database-optimization', pathId: 'backend-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'be-auth-security',         pathId: 'backend-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'be-microservices',         pathId: 'backend-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Frontend Engineer ────────────────────────────────────────────────────────
  { skillId: 'fe-html-css-js',     pathId: 'frontend-engineer', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'fe-react-framework', pathId: 'frontend-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'fe-typescript',      pathId: 'frontend-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'fe-performance',     pathId: 'frontend-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'fe-testing-a11y',    pathId: 'frontend-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Cloud Engineer ───────────────────────────────────────────────────────────
  // Actual skill IDs: ce-cloud-fundamentals, ce-networking, ce-iac, ce-kubernetes, ce-cost-optimization
  { skillId: 'ce-cloud-fundamentals', pathId: 'cloud-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ce-kubernetes',         pathId: 'cloud-engineer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ce-iac',                pathId: 'cloud-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ce-cost-optimization',  pathId: 'cloud-engineer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ce-networking',         pathId: 'cloud-engineer', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── DevOps ───────────────────────────────────────────────────────────────────
  // Actual skill IDs: do-linux-shell, do-cicd, do-docker-k8s, do-monitoring, do-security
  { skillId: 'do-cicd',       pathId: 'devops', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'do-docker-k8s', pathId: 'devops', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'do-monitoring',  pathId: 'devops', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'do-security',    pathId: 'devops', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'do-linux-shell', pathId: 'devops', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Cybersecurity ────────────────────────────────────────────────────────────
  // Actual skill IDs: cs-networking, cs-linux-security, cs-vulnerability, cs-pentest, cs-incident-response
  { skillId: 'cs-vulnerability',      pathId: 'cybersecurity', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cs-linux-security',     pathId: 'cybersecurity', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cs-pentest',            pathId: 'cybersecurity', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cs-incident-response',  pathId: 'cybersecurity', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'cs-networking',         pathId: 'cybersecurity', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Product Manager ──────────────────────────────────────────────────────────
  // Actual skill IDs: pm-discovery, pm-roadmap, pm-stakeholders, pm-data-driven, pm-launch
  { skillId: 'pm-discovery',    pathId: 'product-manager', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pm-roadmap',      pathId: 'product-manager', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pm-data-driven',  pathId: 'product-manager', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pm-launch',       pathId: 'product-manager', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pm-stakeholders', pathId: 'product-manager', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Business Analyst ─────────────────────────────────────────────────────────
  // Actual skill IDs: ba-requirements, ba-data-analysis, ba-process-mapping, ba-sql-business, ba-reporting
  { skillId: 'ba-requirements',    pathId: 'business-analyst', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ba-sql-business',    pathId: 'business-analyst', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ba-reporting',       pathId: 'business-analyst', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ba-process-mapping', pathId: 'business-analyst', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ba-data-analysis',   pathId: 'business-analyst', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Data Analyst ─────────────────────────────────────────────────────────────
  // Actual skill IDs: da-excel-spreadsheets, da-sql-analysis, da-visualization, da-python-analysis, da-statistics
  { skillId: 'da-sql-analysis',      pathId: 'data-analyst', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'da-visualization',     pathId: 'data-analyst', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'da-python-analysis',   pathId: 'data-analyst', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'da-excel-spreadsheets', pathId: 'data-analyst', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'da-statistics',        pathId: 'data-analyst', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Project Manager ──────────────────────────────────────────────────────────
  // Actual skill IDs: pjm-planning, pjm-agile, pjm-risk, pjm-communication, pjm-budget
  { skillId: 'pjm-agile',        pathId: 'project-manager', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pjm-budget',       pathId: 'project-manager', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pjm-planning',     pathId: 'project-manager', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pjm-risk',         pathId: 'project-manager', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'pjm-communication', pathId: 'project-manager', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Solutions Architect ──────────────────────────────────────────────────────
  // Actual skill IDs: sa-systems-design, sa-cloud-arch, sa-integration, sa-security-arch, sa-cost-scalability
  { skillId: 'sa-cloud-arch',       pathId: 'solutions-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sa-systems-design',   pathId: 'solutions-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sa-security-arch',    pathId: 'solutions-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sa-cost-scalability', pathId: 'solutions-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sa-integration',      pathId: 'solutions-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Software Architect ───────────────────────────────────────────────────────
  // Actual skill IDs: arch-design-patterns, arch-distributed-systems, arch-api-design, arch-system-modeling, arch-tech-leadership
  { skillId: 'arch-design-patterns',    pathId: 'software-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'arch-api-design',         pathId: 'software-architect', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'arch-distributed-systems', pathId: 'software-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'arch-system-modeling',    pathId: 'software-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'arch-tech-leadership',    pathId: 'software-architect', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Mobile Developer ─────────────────────────────────────────────────────────
  // Actual skill IDs: mob-ui-fundamentals, mob-react-native, mob-state-management, mob-native-apis, mob-app-store
  { skillId: 'mob-react-native',    pathId: 'mobile-developer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'mob-state-management', pathId: 'mobile-developer', level: 'high',  signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'mob-ui-fundamentals', pathId: 'mobile-developer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'mob-native-apis',     pathId: 'mobile-developer', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'mob-app-store',       pathId: 'mobile-developer', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── UI/UX Designer ───────────────────────────────────────────────────────────
  // Actual skill IDs: ux-fundamentals, ux-wireframing, ux-user-research, ux-figma, ux-design-thinking
  { skillId: 'ux-user-research',   pathId: 'ui-ux-designer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ux-figma',           pathId: 'ui-ux-designer', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ux-design-thinking', pathId: 'ui-ux-designer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ux-fundamentals',    pathId: 'ui-ux-designer', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'ux-wireframing',     pathId: 'ui-ux-designer', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },

  // ── Startup Founder ──────────────────────────────────────────────────────────
  // Actual skill IDs: sf-validation, sf-mvp, sf-growth, sf-fundraising, sf-operations
  { skillId: 'sf-validation',  pathId: 'startup-founder', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sf-mvp',         pathId: 'startup-founder', level: 'high',   signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sf-growth',      pathId: 'startup-founder', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sf-operations',  pathId: 'startup-founder', level: 'rising', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
  { skillId: 'sf-fundraising', pathId: 'startup-founder', level: 'stable', signalCount: 0, lastUpdated: CURATED_DATE, source: 'curated' },
];

/** O(1) lookup: skillId → MarketDemand */
export const MARKET_DEMAND_MAP: Record<string, MarketDemand> = Object.fromEntries(
  CURATED_MARKET_DEMAND.map((d) => [d.skillId, d])
);

/**
 * Returns the count of high-demand and rising skills for a given career path.
 * Used internally; prefer getPathDemandLabel() for UI display.
 */
export function getPathDemandSummary(pathId: string): { high: number; rising: number; total: number } {
  const entries = CURATED_MARKET_DEMAND.filter((d) => d.pathId === pathId);
  return {
    high:   entries.filter((d) => d.level === 'high').length,
    rising: entries.filter((d) => d.level === 'rising').length,
    total:  entries.length,
  };
}

/**
 * Returns a qualitative demand label for a career path — meant for path
 * selection screens (onboarding picker, catalog) where raw counts are confusing.
 *
 * Logic:
 *   🔥 High demand — ≥50% of the path's skills appear in the top demanded skills
 *      for that role in current job postings.
 *   ↗  Growing     — the field has momentum; some high-demand skills + rising trends.
 *   (empty string) — no curated data (custom paths, or paths not yet researched).
 *
 * Color guidance: 'high' → #FCA5A5 (warm red), 'growing' → #FCD34D (amber)
 */
export function getPathDemandLabel(
  pathId: string,
): { label: string; sentiment: 'high' | 'growing' | 'none' } {
  const entries = CURATED_MARKET_DEMAND.filter((d) => d.pathId === pathId);
  if (entries.length === 0) return { label: '', sentiment: 'none' };

  const highCount   = entries.filter((d) => d.level === 'high').length;
  const risingCount = entries.filter((d) => d.level === 'rising').length;

  if (highCount / entries.length >= 0.5) {
    return { label: '🔥 High demand', sentiment: 'high' };
  }
  if (highCount > 0 || risingCount > 0) {
    return { label: '↗ Growing', sentiment: 'growing' };
  }
  return { label: '', sentiment: 'none' };
}
