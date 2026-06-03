import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Animated,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppStore, CAREER_PATHS } from '../store/appStore';
import { useThemeColors, ColorsType, Colors, Spacing, FontSize, Radius, PathColors } from '../utils/theme';
import FeedCard from '../components/FeedCard';
import { FeedPost } from '../types';
import { page } from '../utils/analytics';

export default function FeedScreen() {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => makeStyles(Colors), [Colors]);
  const communityFeed = useAppStore((s) => s.communityFeed);
  const reactToPost = useAppStore((s) => s.reactToPost);
  const addComment = useAppStore((s) => s.addComment);
  const savedPostIds = useAppStore((s) => s.savedPostIds);
  const toggleSavePost = useAppStore((s) => s.toggleSavePost);
  const user = useAppStore((s) => s.user);
  const customPaths = useAppStore((s) => s.customPaths);
  const outputs = useAppStore((s) => s.outputs);
  const navigation = useNavigation<any>();
  const headerAnim = useRef(new Animated.Value(1)).current;

  // Active path filter — 'all' shows everything
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const hasPersonalPost = communityFeed.some(p => p.isCurrentUser);

  // Build filter list dynamically from paths that have posts in the feed.
  // This supports all 17 built-in paths + any custom paths automatically.
  const feedPathIds = new Set(communityFeed.map(p => p.pathId));

  const builtInPathFilters = CAREER_PATHS
    .filter(cp => feedPathIds.has(cp.id))
    .map(cp => {
      const pc = PathColors[cp.id];
      return {
        id: cp.id,
        label: cp.name.length > 12 ? cp.name.slice(0, 11) + '…' : cp.name,
        icon: cp.icon,
        color: pc?.primary ?? Colors.primary,
        dimColor: pc?.dim ?? Colors.primaryDim,
        borderColor: pc?.border ?? Colors.primary + '50',
      };
    });

  const customPathFilters = customPaths
    .filter(cp => feedPathIds.has(cp.id))
    .map(cp => ({
      id: cp.id,
      label: cp.name.length > 12 ? cp.name.slice(0, 11) + '…' : cp.name,
      icon: cp.icon,
      color: cp.color,
      dimColor: cp.color + '15',
      borderColor: cp.color + '40',
    }));

  const hasWinPosts = communityFeed.some(p => p.type === 'career_win');
  const allFilters = [
    { id: 'all', label: 'All', icon: '🌐', color: Colors.primary, dimColor: Colors.primaryDim, borderColor: Colors.primary + '50' },
    { id: 'saved', label: 'Saved', icon: '🔖', color: Colors.gold, dimColor: Colors.goldDim, borderColor: Colors.gold + '50' },
    ...(hasWinPosts ? [{ id: 'wins', label: 'Wins', icon: '🏆', color: Colors.gold, dimColor: Colors.goldDim, borderColor: Colors.gold + '50' }] : []),
    ...builtInPathFilters,
    ...customPathFilters,
  ];

  // Filtered feed
  const filteredFeed: FeedPost[] = activeFilter === 'all'
    ? communityFeed
    : activeFilter === 'saved'
    ? communityFeed.filter(p => savedPostIds.includes(p.id))
    : activeFilter === 'wins'
    ? communityFeed.filter(p => p.type === 'career_win')
    : communityFeed.filter(p => p.pathId === activeFilter);

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: false }).start();
    page('feed', { post_count: communityFeed.length, has_personal_post: hasPersonalPost });
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate a brief network delay, then re-order mock posts (shuffle non-user posts)
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  const renderItem = ({ item, index }: { item: FeedPost; index: number }) => (
    <FeedCard
      post={item}
      onReact={reactToPost}
      onComment={addComment}
      onSave={toggleSavePost}
      isSaved={savedPostIds.includes(item.id)}
      index={index}
    />
  );

  const FeedCoachingBanner = () => (
    <TouchableOpacity
      style={styles.coachingBanner}
      onPress={() => navigation.navigate('Log')}
      activeOpacity={0.88}
    >
      <Text style={styles.coachingBannerEmoji}>✍️</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.coachingBannerTitle}>Your work deserves to be seen.</Text>
        <Text style={styles.coachingBannerSub}>
          Log an output to add it to your feed. During the pilot, posts stay on your device — sharing is coming soon.
        </Text>
      </View>
      <View style={styles.coachingBannerBtn}>
        <Text style={styles.coachingBannerBtnText}>Log →</Text>
      </View>
    </TouchableOpacity>
  );

  const EmptyFilter = () => {
    if (activeFilter === 'saved') {
      return (
        <View style={styles.emptyFilter}>
          <Text style={styles.emptyFilterEmoji}>🔖</Text>
          <Text style={styles.emptyFilterTitle}>No saved posts yet</Text>
          <Text style={styles.emptyFilterSub}>
            Tap the 📌 bookmark on any post to save it here for later.
          </Text>
        </View>
      );
    }
    if (activeFilter === 'wins') {
      return (
        <View style={styles.emptyFilter}>
          <Text style={styles.emptyFilterEmoji}>🏆</Text>
          <Text style={styles.emptyFilterTitle}>No wins logged yet</Text>
          <Text style={styles.emptyFilterSub}>
            When you land an interview, offer, or promotion — log it on your Profile and it shows up here.
          </Text>
        </View>
      );
    }
    const activeFilterDef = allFilters.find(f => f.id === activeFilter);
    return (
      <View style={styles.emptyFilter}>
        <Text style={styles.emptyFilterEmoji}>{activeFilterDef?.icon ?? '🔍'}</Text>
        <Text style={styles.emptyFilterTitle}>No {activeFilterDef?.label ?? ''} posts yet</Text>
        <Text style={styles.emptyFilterSub}>
          Be the first to log an output on this path and appear here.
        </Text>
        <TouchableOpacity
          style={[styles.emptyFilterBtn, { backgroundColor: activeFilterDef?.color ?? Colors.primary }]}
          onPress={() => navigation.navigate('Log')}
          activeOpacity={0.85}
        >
          <Text style={styles.emptyFilterBtnText}>Log Output →</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Leaderboard: use this week's XP (outputs from last 7 days) for the current user.
  // Seed leaders show fixed weekly XP for a realistic competitive feel.
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartIso = weekStart.toISOString();
  const weeklyUserXP = outputs
    .filter((o) => o.createdAt >= weekStartIso)
    .reduce((sum, o) => sum + o.xpGained, 0);

  // ISSUE-007: isSeed flags these as benchmark examples, not real users
  const SEED_LEADERS = [
    { id: 'seed_1', name: 'Priya Nair', xp: 390, emoji: '⚡', isCurrentUser: false, isSeed: true },
    { id: 'seed_2', name: 'Marcus Webb', xp: 340, emoji: '🧠', isCurrentUser: false, isSeed: true },
    { id: 'seed_3', name: 'Sofia Chen', xp: 275, emoji: '🚀', isCurrentUser: false, isSeed: true },
  ];
  const leaderboardPool = user
    ? [...SEED_LEADERS, { id: user.id, name: user.name, xp: weeklyUserXP, emoji: user.avatarEmoji, isCurrentUser: true }]
    : SEED_LEADERS;
  const RANK_EMOJIS = ['🥇', '🥈', '🥉'];
  const sortedPool = [...leaderboardPool].sort((a, b) => b.xp - a.xp);
  const leaderboard = sortedPool
    .slice(0, 3)
    .map((e, i) => ({ ...e, rank: i + 1, rankEmoji: RANK_EMOJIS[i] }));
  const userRank = sortedPool.findIndex((e) => e.isCurrentUser) + 1;
  const userInTop3 = userRank > 0 && userRank <= 3;
  const userLeaderEntry = user && !userInTop3
    ? { ...sortedPool.find((e) => e.isCurrentUser)!, rank: userRank, rankEmoji: `#${userRank}` }
    : null;

  // Count badge for each path
  const getFilterCount = (filterId: string) => {
    if (filterId === 'all') return communityFeed.length;
    if (filterId === 'saved') return savedPostIds.length;
    if (filterId === 'wins') return communityFeed.filter(p => p.type === 'career_win').length;
    return communityFeed.filter(p => p.pathId === filterId).length;
  };

  const ListHeader = () => (
    <View>
      {/* Filter chips with post count */}
      {/* RES-003: wrap in a relative container so the right-edge fade can overlay it */}
      <View style={styles.filterSection}>
        <View style={styles.filterScrollWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {allFilters.map((filter) => {
            const isActive = activeFilter === filter.id;
            const count = getFilterCount(filter.id);
            return (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterChip,
                  isActive && {
                    backgroundColor: filter.dimColor,
                    borderColor: filter.color,
                  },
                ]}
                onPress={() => setActiveFilter(filter.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.filterChipIcon}>{filter.icon}</Text>
                <Text
                  style={[
                    styles.filterChipLabel,
                    isActive && { color: filter.color, fontWeight: '700' },
                  ]}
                >
                  {filter.label}
                </Text>
                <View style={[
                  styles.filterChipCount,
                  isActive && { backgroundColor: filter.color },
                ]}>
                  <Text style={[
                    styles.filterChipCountText,
                    isActive && { color: Colors.white },
                  ]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          </ScrollView>
          {/* Right-edge fade: signals more chips exist off-screen.
              Inline style is intentional: RN-web strips `background` gradients
              from StyleSheet.create(), but honours them as inline style props. */}
          <View
            style={[styles.filterFade, { background: `linear-gradient(to right, transparent, ${Colors.bg})` } as any]}
            pointerEvents="none"
          />
        </View>
      </View>
      {/* Coaching banner only when no personal post and viewing all */}
      {!hasPersonalPost && activeFilter === 'all' && <FeedCoachingBanner />}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.screenTitle}>Community</Text>
            <Text style={styles.screenSubtitle}>A preview of what builders share — your posts stay on this device</Text>
          </View>
          <View style={styles.livePill}>
            <Text style={styles.liveText}>PREVIEW</Text>
          </View>
        </View>

        {/* Weekly Leaderboard */}
        <View style={styles.leaderboard}>
          <View style={styles.leaderboardTitleRow}>
            <Text style={styles.leaderboardTitle}>🏅 WEEKLY XP LEADERBOARD</Text>
            {/* ISSUE-007: disclose that non-user entries are sample benchmarks */}
            <Text style={styles.leaderboardSampleNote}>sample benchmarks</Text>
          </View>
          <View style={styles.leaderboardRow}>
            {leaderboard.map((entry) => (
              <View key={entry.id} style={[styles.leaderboardEntry, entry.isCurrentUser && styles.leaderboardEntryYou]}>
                <Text style={styles.leaderboardEmoji}>{entry.rankEmoji}</Text>
                <Text style={[styles.leaderboardName, entry.isCurrentUser && styles.leaderboardNameYou]} numberOfLines={1}>
                  {entry.isCurrentUser ? 'You' : entry.name.split(' ')[0]}
                </Text>
                {(entry as any).isSeed && !entry.isCurrentUser && (
                  <Text style={styles.leaderboardSeedTag}>SAMPLE</Text>
                )}
                <Text style={[styles.leaderboardXP, entry.isCurrentUser && styles.leaderboardXPYou]}>{entry.xp} XP</Text>
              </View>
            ))}
          </View>
          {userLeaderEntry && (
            <View style={styles.leaderboardYouRow}>
              <View style={styles.leaderboardYouDivider} />
              <View style={styles.leaderboardEntryYouFull}>
                <Text style={styles.leaderboardYouRank}>{userLeaderEntry.rankEmoji}</Text>
                <Text style={styles.leaderboardYouName}>You</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.leaderboardYouXP}>{userLeaderEntry.xp} XP this week</Text>
                <Text style={styles.leaderboardYouGap}>
                  {leaderboard[leaderboard.length - 1].xp - userLeaderEntry.xp > 0
                    ? `${leaderboard[leaderboard.length - 1].xp - userLeaderEntry.xp} XP behind #3`
                    : ''}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>

      <FlatList
        data={filteredFeed}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={activeFilter !== 'all' ? <EmptyFilter /> : null}

        ListFooterComponent={filteredFeed.length > 0 ? () => (
          <View style={styles.footer}>
            <Text style={styles.footerText}>You're all caught up 🎉</Text>
            <Text style={styles.footerSub}>
              {activeFilter === 'all' ? 'Log an output to appear in the feed' : 'Switch to All to see more posts'}
            </Text>
          </View>
        ) : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryLight}
            colors={[Colors.primaryLight]}
          />
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ColorsType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  screenTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  screenSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primary + '35',
    marginTop: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight,
  },
  liveText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: 1,
  },

  // Leaderboard
  leaderboard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // ISSUE-007: leaderboard header row with disclosure note
  leaderboardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  leaderboardTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  leaderboardSampleNote: {
    fontSize: 9,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  leaderboardSeedTag: {
    fontSize: 7,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    backgroundColor: Colors.cardAlt,
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  leaderboardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  leaderboardEntry: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    padding: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leaderboardEmoji: {
    fontSize: 18,
  },
  leaderboardName: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSub,
  },
  leaderboardXP: {
    fontSize: FontSize.xs,
    color: Colors.gold,
    fontWeight: '700',
  },
  leaderboardEntryYou: {
    borderColor: Colors.primary + '50',
    backgroundColor: Colors.primaryDim,
  },
  leaderboardNameYou: {
    color: Colors.primaryLight,
  },
  leaderboardXPYou: {
    color: Colors.primaryLight,
  },
  leaderboardYouRow: {
    marginTop: 8,
    gap: 6,
  },
  leaderboardYouDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  leaderboardEntryYouFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '45',
    gap: 8,
  },
  leaderboardYouRank: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSub,
    minWidth: 28,
  },
  leaderboardYouName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  leaderboardYouXP: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.gold,
  },
  leaderboardYouGap: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },

  // Filter chips
  filterSection: {
    marginBottom: Spacing.md,
  },
  // RES-003: contains the ScrollView + the right-edge fade overlay
  filterScrollWrapper: {
    position: 'relative' as const,
  },
  // Right-to-transparent fade that signals more chips exist off-screen
  filterFade: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    bottom: 0,
    width: 40,
    // gradient is applied as inline style at the callsite — StyleSheet strips it
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: Spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipIcon: {
    fontSize: 13,
  },
  filterChipLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSub,
  },
  filterChipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginLeft: 2,
  },
  filterChipCount: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 2,
  },
  filterChipCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },

  // Coaching banner for new users
  coachingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.xl, borderWidth: 1,
    borderColor: Colors.primary + '40', padding: Spacing.md, marginBottom: Spacing.md,
    // @ts-ignore
    boxShadow: '0 2px 12px rgba(124,58,237,0.15)',
  },
  coachingBannerEmoji: { fontSize: 28 },
  coachingBannerTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  coachingBannerSub: { fontSize: FontSize.xs, color: Colors.textSub, lineHeight: 16 },
  coachingBannerBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  coachingBannerBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },

  // Empty filter state
  emptyFilter: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: 8,
  },
  emptyFilterEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  emptyFilterTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  emptyFilterSub: {
    fontSize: FontSize.sm,
    color: Colors.textSub,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  emptyFilterBtn: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    marginTop: 4,
  },
  emptyFilterBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 100,
    flexGrow: 1,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: 6,
  },
  footerText: {
    fontSize: FontSize.base,
    color: Colors.textSub,
    fontWeight: '500',
  },
  footerSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
