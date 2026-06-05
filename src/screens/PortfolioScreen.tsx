import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  useAppStore,
  CAREER_PATHS,
  ALL_SKILLS,
  getEvidenceTier,
} from '../store/appStore';
import {
  useThemeColors,
  ColorsType,
  Colors,
  Spacing,
  Radius,
  FontSize,
  PathColors,
  timeAgo,
} from '../utils/theme';
import { useToast } from '../components/Toast';
import { Output } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const BUILD_TYPES = new Set(['project', 'github', 'script', 'diagram']);
const CERT_TYPE = 'cert';
const BOOK_TYPE = 'book';
const MAX_PINS = 3;

const TYPE_META: Record<string, { icon: string; label: string }> = {
  project:  { icon: '🔨', label: 'Project' },
  github:   { icon: '💻', label: 'GitHub' },
  script:   { icon: '⚙️', label: 'Script' },
  diagram:  { icon: '📐', label: 'Design' },
  cert:     { icon: '🏅', label: 'Cert' },
  book:     { icon: '📖', label: 'Book' },
};

// ─── Score helpers ────────────────────────────────────────────────────────────

function computePortfolioScore(outputs: Output[]): {
  totalBuilds: number;
  verifiedCount: number;
  documentedCount: number;
  score: number;        // 0-100
  label: string;
  labelColor: string;
} {
  const portfolioItems = outputs.filter(
    (o) => BUILD_TYPES.has(o.type) || o.type === CERT_TYPE
  );
  const totalBuilds = portfolioItems.length;

  if (totalBuilds === 0) {
    return {
      totalBuilds: 0,
      verifiedCount: 0,
      documentedCount: 0,
      score: 0,
      label: 'No Builds Yet',
      labelColor: Colors.textMuted,
    };
  }

  let verifiedCount = 0;
  let documentedCount = 0;
  let points = 0;

  portfolioItems.forEach((o) => {
    const tier = o.evidenceTier ?? getEvidenceTier(o.link, o.description);
    if (tier === 'verified') { verifiedCount++; points += 2; }
    else if (tier === 'documented') { documentedCount++; points += 1; }
  });

  const score = Math.round((points / (totalBuilds * 2)) * 100);

  let label: string;
  let labelColor: string;
  if (score < 25) { label = 'Getting Started'; labelColor = Colors.textSub; }
  else if (score < 55) { label = 'Building Up'; labelColor = '#F59E0B'; }
  else if (score < 80) { label = 'Strong Portfolio'; labelColor = '#7C3AED'; }
  else { label = 'Portfolio Pro ✦'; labelColor = Colors.success; }

  return { totalBuilds, verifiedCount, documentedCount, score, label, labelColor };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ score, color }: { score: number; color: string }) {
  const Colors = useThemeColors();
  return (
    <View style={{ height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' }}>
      <View
        style={{
          height: '100%',
          width: `${score}%` as any,
          backgroundColor: color,
          borderRadius: 3,
          // @ts-ignore web transition
          transition: 'width 0.8s ease',
        }}
      />
    </View>
  );
}

function EvidencePill({ tier }: { tier: 'verified' | 'documented' | 'logged' }) {
  const Colors = useThemeColors();
  if (tier === 'verified') {
    return (
      <View style={[pillStyles.pill, { borderColor: Colors.success + '40', backgroundColor: Colors.success + '15' }]}>
        <Text style={[pillStyles.text, { color: Colors.success }]}>🔗 Verified</Text>
      </View>
    );
  }
  if (tier === 'documented') {
    return (
      <View style={[pillStyles.pill, { borderColor: Colors.primaryLight + '40', backgroundColor: Colors.primaryLight + '15' }]}>
        <Text style={[pillStyles.text, { color: Colors.primaryLight }]}>📝 Documented</Text>
      </View>
    );
  }
  return null; // no pill for 'logged'
}

const pillStyles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontSize: 11, fontWeight: '600' },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortfolioScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const Colors = useThemeColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { showToast } = useToast();

  const user = useAppStore((s) => s.user);
  const outputs = useAppStore((s) => s.outputs);
  const customPaths = useAppStore((s) => s.customPaths);
  const togglePinOutput = useAppStore((s) => s.togglePinOutput);

  const [showStudyLog, setShowStudyLog] = useState(false);

  if (!user) return null;

  // ── Path meta ──────────────────────────────────────────────────────────────
  const pathId = user.careerPathId;
  const builtInPath = CAREER_PATHS.find((p) => p.id === pathId);
  const customPath = customPaths.find((p) => p.id === pathId);
  const pathName = builtInPath?.name ?? customPath?.name ?? 'Your Path';
  const pathIcon = builtInPath?.icon ?? customPath?.icon ?? '⚡';
  const pathColorObj = PathColors[pathId] ?? {
    primary: customPath?.color ?? Colors.primary,
    dim: (customPath?.color ?? Colors.primary) + '18',
    text: Colors.primaryLight,
    border: (customPath?.color ?? Colors.primary) + '40',
  };

  // ── Computed data ──────────────────────────────────────────────────────────
  const pinnedIds = user.pinnedOutputIds ?? [];
  // Filter to only IDs that still exist in outputs
  const validPinnedIds = pinnedIds.filter((id) => outputs.some((o) => o.id === id));

  const portfolioScore = useMemo(() => computePortfolioScore(outputs), [outputs]);

  const featured: Output[] = useMemo(() => {
    const pinned = validPinnedIds
      .map((id) => outputs.find((o) => o.id === id))
      .filter(Boolean) as Output[];
    // If no pins, auto-feature top 3 by evidence quality
    if (pinned.length === 0) {
      const candidates = outputs
        .filter((o) => BUILD_TYPES.has(o.type) || o.type === CERT_TYPE)
        .sort((a, b) => {
          const tierScore = (o: Output) => {
            const t = o.evidenceTier ?? getEvidenceTier(o.link, o.description);
            return t === 'verified' ? 2 : t === 'documented' ? 1 : 0;
          };
          return tierScore(b) - tierScore(a);
        });
      return candidates.slice(0, 3);
    }
    return pinned;
  }, [validPinnedIds, outputs]);

  const featuredIds = new Set(featured.map((o) => o.id));

  const builds = useMemo(
    () => outputs.filter((o) => BUILD_TYPES.has(o.type) && !featuredIds.has(o.id)),
    [outputs, featuredIds]
  );

  const certs = useMemo(
    () => outputs.filter((o) => o.type === CERT_TYPE && !featuredIds.has(o.id)),
    [outputs, featuredIds]
  );

  const books = useMemo(
    () => outputs.filter((o) => o.type === BOOK_TYPE),
    [outputs]
  );

  // ── Skill count ────────────────────────────────────────────────────────────
  const skillsDemonstrated = useMemo(() => {
    const ids = new Set(outputs.map((o) => o.skillId).filter(Boolean));
    return ids.size;
  }, [outputs]);

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = () => {
    const featuredLines = featured
      .map((o) => {
        const link = o.link ? ` → ${o.link}` : '';
        return `• ${o.title}${link}`;
      })
      .join('\n');

    const shareText = [
      `${user.name} — ${pathIcon} ${pathName} Portfolio`,
      `@${user.handle} · Built on SkillForge`,
      ``,
      featured.length > 0 ? `Featured Work:\n${featuredLines}` : null,
      ``,
      `${portfolioScore.totalBuilds} build${portfolioScore.totalBuilds !== 1 ? 's' : ''} · ${portfolioScore.verifiedCount} verified · ${skillsDemonstrated} skill${skillsDemonstrated !== 1 ? 's' : ''} demonstrated`,
      ``,
      `skillforge.app`,
    ]
      .filter((l) => l !== null)
      .join('\n');

    try {
      if (typeof document !== 'undefined') {
        const el = document.createElement('textarea');
        el.value = shareText;
        el.setAttribute('readonly', '');
        el.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast({ message: 'Portfolio copied to clipboard!', emoji: '📋', variant: 'success' });
        return;
      }
    } catch {}
    navigator.clipboard
      ?.writeText(shareText)
      .then(() => showToast({ message: 'Portfolio copied to clipboard!', emoji: '📋', variant: 'success' }))
      .catch(() => showToast({ message: 'Copy failed', emoji: '⚠️', variant: 'warning' }));
  };

  // ── Pin helpers ────────────────────────────────────────────────────────────
  const isPinned = (id: string) => validPinnedIds.includes(id);
  const atPinLimit = validPinnedIds.length >= MAX_PINS;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Portfolio</Text>
        <TouchableOpacity
          onPress={handleShare}
          style={styles.shareBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Share portfolio"
        >
          <Text style={styles.shareBtnText}>Share 🔗</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Portfolio Identity Card ─────────────────────────────────────── */}
        <View style={[styles.identityCard, { borderColor: pathColorObj.border, backgroundColor: pathColorObj.dim }]}>
          <View style={styles.identityRow}>
            <Text style={styles.identityIcon}>{pathIcon}</Text>
            <View style={styles.identityText}>
              <Text style={styles.identityName}>{user.name}</Text>
              <Text style={[styles.identityPath, { color: pathColorObj.text }]}>
                {pathName} · @{user.handle}
              </Text>
            </View>
          </View>

          <View style={styles.identityStats}>
            <View style={styles.identityStat}>
              <Text style={[styles.identityStatValue, { color: Colors.text }]}>
                {portfolioScore.totalBuilds}
              </Text>
              <Text style={styles.identityStatLabel}>builds</Text>
            </View>
            <View style={styles.identityStatDivider} />
            <View style={styles.identityStat}>
              <Text style={[styles.identityStatValue, { color: Colors.success }]}>
                {portfolioScore.verifiedCount}
              </Text>
              <Text style={styles.identityStatLabel}>verified</Text>
            </View>
            <View style={styles.identityStatDivider} />
            <View style={styles.identityStat}>
              <Text style={[styles.identityStatValue, { color: Colors.primaryLight }]}>
                {skillsDemonstrated}
              </Text>
              <Text style={styles.identityStatLabel}>
                {skillsDemonstrated === 1 ? 'skill started' : 'skills started'}
              </Text>
            </View>
          </View>

          {portfolioScore.totalBuilds > 0 && (
            <View style={styles.scoreSection}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>PORTFOLIO STRENGTH</Text>
                <Text style={[styles.scoreTag, { color: portfolioScore.labelColor }]}>
                  {portfolioScore.label}
                </Text>
              </View>
              <ScoreBar score={portfolioScore.score} color={portfolioScore.labelColor} />
              <Text style={styles.scoreHint}>
                {portfolioScore.verifiedCount === 0
                  ? 'Add links to your builds to unlock Verified status'
                  : portfolioScore.verifiedCount < portfolioScore.totalBuilds
                  ? `${portfolioScore.totalBuilds - portfolioScore.verifiedCount} build${portfolioScore.totalBuilds - portfolioScore.verifiedCount !== 1 ? 's' : ''} still missing a link`
                  : 'All builds are verified — employers can see your work'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Featured Work ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>⭐ FEATURED WORK</Text>
              {validPinnedIds.length > 0 && (
                <Text style={styles.sectionSub}>
                  {validPinnedIds.length}/{MAX_PINS} pinned
                </Text>
              )}
            </View>
            {validPinnedIds.length === 0 && portfolioScore.totalBuilds > 0 && (
              <Text style={styles.autoFeaturedBadge}>Auto-selected</Text>
            )}
          </View>

          {featured.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🏗️</Text>
              <Text style={styles.emptyTitle}>No builds yet</Text>
              <Text style={styles.emptyBody}>
                Log a project, GitHub repo, or script to start building your portfolio.
              </Text>
            </View>
          ) : (
            featured.map((output) => {
              const meta = TYPE_META[output.type] ?? { icon: '📦', label: 'Output' };
              const tier = output.evidenceTier ?? getEvidenceTier(output.link, output.description);
              const pinned = isPinned(output.id);
              return (
                <View key={output.id} style={styles.featuredCard}>
                  <View style={styles.featuredCardHeader}>
                    <View style={styles.featuredTypeBadge}>
                      <Text style={styles.featuredTypeIcon}>{meta.icon}</Text>
                      <Text style={styles.featuredTypeLabel}>{meta.label}</Text>
                    </View>
                    <EvidencePill tier={tier} />
                    {validPinnedIds.length > 0 && (
                      <TouchableOpacity
                        onPress={() => togglePinOutput(output.id)}
                        style={styles.unpinBtn}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Unpin ${output.title}`}
                      >
                        <Text style={styles.unpinBtnText}>📌 Unpin</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.featuredTitle}>{output.title}</Text>
                  {output.skillName && (
                    <Text style={styles.featuredSkill}>{output.skillName}</Text>
                  )}
                  {output.description ? (
                    <Text style={styles.featuredDescription} numberOfLines={3}>
                      {output.description}
                    </Text>
                  ) : null}
                  {output.link ? (
                    <TouchableOpacity
                      style={styles.linkBtn}
                      onPress={() => {
                        if (typeof window !== 'undefined') {
                          window.open(output.link, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="link"
                      accessibilityLabel={`Open ${output.title}`}
                    >
                      <Text style={styles.linkBtnText} numberOfLines={1}>
                        🔗 {output.link.replace(/^https?:\/\//, '')}
                      </Text>
                      <Text style={styles.linkArrow}>↗</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* ── Builds ─────────────────────────────────────────────────────── */}
        {builds.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>🔨 BUILDS</Text>
              <Text style={styles.sectionCount}>{builds.length}</Text>
            </View>
            <Text style={styles.pinHint}>
              {atPinLimit
                ? '📌 3 featured — unpin one to feature another'
                : `⭐ Tap to feature up to ${MAX_PINS} builds`}
            </Text>
            {builds.map((output) => {
              const meta = TYPE_META[output.type] ?? { icon: '📦', label: 'Output' };
              const tier = output.evidenceTier ?? getEvidenceTier(output.link, output.description);
              const canPin = !atPinLimit;
              return (
                <View key={output.id} style={styles.buildCard}>
                  <View style={styles.buildIconBox}>
                    <Text style={styles.buildIcon}>{meta.icon}</Text>
                  </View>
                  <View style={styles.buildInfo}>
                    <Text style={styles.buildTitle} numberOfLines={1}>
                      {output.title}
                    </Text>
                    <Text style={styles.buildMeta}>
                      {[meta.label, output.skillName, output.link ? output.link.replace(/^https?:\/\//, '') : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.buildRight}>
                    {tier !== 'logged' && <EvidencePill tier={tier} />}
                    <TouchableOpacity
                      onPress={() => canPin && togglePinOutput(output.id)}
                      style={[styles.pinBtn, !canPin && styles.pinBtnDisabled]}
                      activeOpacity={canPin ? 0.7 : 1}
                      accessibilityRole="button"
                      accessibilityLabel={`Feature ${output.title}`}
                      accessibilityState={{ disabled: !canPin }}
                    >
                      <Text style={[styles.pinBtnText, !canPin && styles.pinBtnTextDisabled]}>
                        ⭐
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Certifications ──────────────────────────────────────────────── */}
        {certs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>🏅 CERTIFICATIONS</Text>
              <Text style={styles.sectionCount}>{certs.length}</Text>
            </View>
            {certs.map((output) => {
              const tier = output.evidenceTier ?? getEvidenceTier(output.link, output.description);
              return (
                <View key={output.id} style={styles.buildCard}>
                  <View style={[styles.buildIconBox, { backgroundColor: Colors.gold + '18' }]}>
                    <Text style={styles.buildIcon}>🏅</Text>
                  </View>
                  <View style={styles.buildInfo}>
                    <Text style={styles.buildTitle} numberOfLines={1}>
                      {output.title}
                    </Text>
                    <Text style={styles.buildMeta}>
                      {[output.skillName, timeAgo(output.createdAt)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.buildRight}>
                    {tier !== 'logged' && <EvidencePill tier={tier} />}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Study Log (books, de-emphasized / collapsed) ─────────────────── */}
        {books.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeaderRow}
              onPress={() => setShowStudyLog((v) => !v)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${showStudyLog ? 'Collapse' : 'Expand'} study log`}
            >
              <Text style={[styles.sectionTitle, { color: Colors.textSub }]}>
                📚 STUDY LOG
              </Text>
              <View style={styles.studyLogRight}>
                <Text style={[styles.sectionCount, { color: Colors.textSub }]}>
                  {books.length}
                </Text>
                <Text style={[styles.chevron, { color: Colors.textSub }]}>
                  {showStudyLog ? '▲' : '▼'}
                </Text>
              </View>
            </TouchableOpacity>
            {showStudyLog && (
              <>
                <Text style={styles.studyLogNote}>
                  Books you've read — "what you studied," not "what you built."
                </Text>
                {books.map((output) => (
                  <View
                    key={output.id}
                    style={[styles.buildCard, { opacity: 0.65 }]}
                  >
                    <View style={styles.buildIconBox}>
                      <Text style={styles.buildIcon}>📖</Text>
                    </View>
                    <View style={styles.buildInfo}>
                      <Text style={[styles.buildTitle, { color: Colors.textSub }]} numberOfLines={1}>
                        {output.title}
                      </Text>
                      <Text style={styles.buildMeta}>
                        {[output.skillName, timeAgo(output.createdAt)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* ── Empty state — no outputs at all ─────────────────────────────── */}
        {outputs.length === 0 && (
          <View style={styles.fullEmptyState}>
            <Text style={styles.fullEmptyIcon}>🏗️</Text>
            <Text style={styles.fullEmptyTitle}>Your portfolio is empty</Text>
            <Text style={styles.fullEmptyBody}>
              Log projects, GitHub repos, scripts, and certs to build a showcase employers can see.
            </Text>
            <TouchableOpacity
              style={styles.fullEmptyCTA}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.fullEmptyCTAText}>Start Building →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(Colors: ColorsType) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.bg,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    backBtn: {
      padding: 8,
      marginRight: 4,
    },
    backIcon: {
      fontSize: 20,
      color: Colors.text,
    },
    headerTitle: {
      flex: 1,
      fontSize: FontSize.lg,
      fontWeight: '700',
      color: Colors.text,
    },
    shareBtn: {
      backgroundColor: Colors.primary + '25',
      borderRadius: Radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: Colors.primary + '50',
    },
    shareBtnText: {
      fontSize: FontSize.sm,
      fontWeight: '600',
      color: Colors.primaryLight,
    },

    // Scroll
    scrollContent: {
      paddingBottom: 40,
    },

    // Identity card
    identityCard: {
      margin: Spacing.md,
      borderRadius: Radius.lg,
      borderWidth: 1,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    identityIcon: {
      fontSize: 32,
    },
    identityText: {
      flex: 1,
      gap: 2,
    },
    identityName: {
      fontSize: FontSize.lg,
      fontWeight: '700',
      color: Colors.text,
    },
    identityPath: {
      fontSize: FontSize.sm,
      fontWeight: '500',
    },
    identityStats: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    identityStat: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    identityStatValue: {
      fontSize: FontSize.xl,
      fontWeight: '800',
    },
    identityStatLabel: {
      fontSize: 11,
      color: Colors.textSub,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    identityStatDivider: {
      width: 1,
      height: 32,
      backgroundColor: Colors.border,
      marginHorizontal: Spacing.sm,
    },
    scoreSection: {
      gap: 6,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    scoreLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: Colors.textSub,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    scoreTag: {
      fontSize: FontSize.sm,
      fontWeight: '700',
    },
    scoreHint: {
      fontSize: 11,
      color: Colors.textMuted,
      marginTop: 2,
    },

    // Sections
    section: {
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.lg,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.textSub,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    sectionSub: {
      fontSize: 11,
      color: Colors.textMuted,
    },
    sectionCount: {
      fontSize: FontSize.sm,
      fontWeight: '600',
      color: Colors.textMuted,
    },
    autoFeaturedBadge: {
      fontSize: 11,
      color: Colors.textMuted,
      fontStyle: 'italic',
    },
    pinHint: {
      fontSize: 11,
      color: Colors.textMuted,
      marginBottom: Spacing.sm,
    },

    // Featured card
    featuredCard: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      gap: 8,
    },
    featuredCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    featuredTypeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: Colors.cardAlt,
      borderRadius: Radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    featuredTypeIcon: {
      fontSize: 12,
    },
    featuredTypeLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: Colors.textSub,
    },
    unpinBtn: {
      marginLeft: 'auto' as any,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.sm,
      backgroundColor: Colors.cardAlt,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    unpinBtnText: {
      fontSize: 11,
      fontWeight: '600',
      color: Colors.textSub,
    },
    featuredTitle: {
      fontSize: FontSize.base,
      fontWeight: '700',
      color: Colors.text,
      lineHeight: 20,
    },
    featuredSkill: {
      fontSize: FontSize.sm,
      color: Colors.textSub,
    },
    featuredDescription: {
      fontSize: FontSize.sm,
      color: Colors.textSub,
      lineHeight: 18,
    },
    linkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: Colors.cardAlt,
      borderRadius: Radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: Colors.border,
      marginTop: 2,
    },
    linkBtnText: {
      flex: 1,
      fontSize: 12,
      color: Colors.primaryLight,
      fontWeight: '500',
    },
    linkArrow: {
      fontSize: 12,
      color: Colors.primaryLight,
    },

    // Build cards
    buildCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.sm,
      marginBottom: Spacing.xs,
      gap: Spacing.sm,
    },
    buildIconBox: {
      width: 40,
      height: 40,
      borderRadius: Radius.sm,
      backgroundColor: Colors.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    buildIcon: {
      fontSize: 18,
    },
    buildInfo: {
      flex: 1,
      gap: 2,
    },
    buildTitle: {
      fontSize: FontSize.sm,
      fontWeight: '600',
      color: Colors.text,
    },
    buildMeta: {
      fontSize: 11,
      color: Colors.textMuted,
    },
    buildRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    pinBtn: {
      width: 32,
      height: 32,
      borderRadius: Radius.sm,
      backgroundColor: Colors.cardAlt,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinBtnDisabled: {
      opacity: 0.35,
    },
    pinBtnText: {
      fontSize: 14,
    },
    pinBtnTextDisabled: {
      opacity: 0.5,
    },

    // Study log
    studyLogRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    chevron: {
      fontSize: 10,
    },
    studyLogNote: {
      fontSize: 11,
      color: Colors.textMuted,
      fontStyle: 'italic',
      marginBottom: Spacing.sm,
    },

    // Empty states
    emptyCard: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: 8,
    },
    emptyIcon: {
      fontSize: 32,
    },
    emptyTitle: {
      fontSize: FontSize.base,
      fontWeight: '700',
      color: Colors.text,
    },
    emptyBody: {
      fontSize: FontSize.sm,
      color: Colors.textSub,
      textAlign: 'center',
      lineHeight: 18,
    },

    // Full empty state (no outputs at all)
    fullEmptyState: {
      margin: Spacing.xl,
      backgroundColor: Colors.surface,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    fullEmptyIcon: {
      fontSize: 48,
      marginBottom: 4,
    },
    fullEmptyTitle: {
      fontSize: FontSize.lg,
      fontWeight: '700',
      color: Colors.text,
      textAlign: 'center',
    },
    fullEmptyBody: {
      fontSize: FontSize.sm,
      color: Colors.textSub,
      textAlign: 'center',
      lineHeight: 20,
    },
    fullEmptyCTA: {
      marginTop: Spacing.sm,
      backgroundColor: Colors.primary,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
    },
    fullEmptyCTAText: {
      fontSize: FontSize.base,
      fontWeight: '700',
      color: '#fff',
    },

    bottomPad: {
      height: 40,
    },
  });
}
