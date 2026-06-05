import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  Image,
} from 'react-native';
import { FeedPost } from '../types';
import { Colors, ColorsType, useThemeColors, Spacing, Radius, FontSize, timeAgo } from '../utils/theme';

interface FeedCardProps {
  post: FeedPost;
  onReact: (postId: string, emoji: string) => void;
  onComment?: (postId: string, text: string) => void;
  onSave?: (postId: string) => void;
  isSaved?: boolean;
  index: number;
}

const QUICK_REACTIONS = ['⚡', '🔥', '💪', '🚀', '👏'];

export default function FeedCard({ post, onReact, onComment, onSave, isSaved = false, index }: FeedCardProps) {
  const Colors = useThemeColors();
  const styles = makeStyles(Colors);
  const mountAnim = useRef(new Animated.Value(0)).current;
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);

  useEffect(() => {
    Animated.timing(mountAnim, {
      toValue: 1,
      duration: 350,
      delay: index * 55,
      useNativeDriver: false,
    }).start();
  }, []);

  const reactionEntries = Object.entries(post.reactions).filter(([, count]) => count > 0);

  const isMilestone = post.type === 'milestone';
  const isStreak = post.type === 'streak';
  const isCareerWin = post.type === 'career_win';

  const WIN_OUTCOME_META: Record<string, { icon: string; label: string }> = {
    interview:       { icon: '🎯', label: 'Interview Landed' },
    offer:           { icon: '🎉', label: 'Offer Received' },
    promotion:       { icon: '🚀', label: 'Promotion' },
    role_change:     { icon: '✨', label: 'Role Change' },
    certification:   { icon: '🏅', label: 'Certification Earned' },
    salary_increase: { icon: '💰', label: 'Raise' },
    portfolio:       { icon: '🌐', label: 'Portfolio Published' },
    freelance:       { icon: '💼', label: 'Freelance Win' },
  };
  const winMeta = post.outcomeType ? WIN_OUTCOME_META[post.outcomeType] : null;

  const typeIcon = isMilestone ? '⚡' : isStreak ? '🔥' : isCareerWin ? (winMeta?.icon ?? '🏆') : '🔨';
  const typeLabel = isMilestone
    ? 'Milestone Unlocked'
    : isStreak
    ? `${post.streakDays}-Day Streak`
    : isCareerWin
    ? (winMeta?.label ?? 'Career Win')
    : 'Output Logged';

  return (
    <Animated.View
      style={[
        styles.card,
        post.isCurrentUser && styles.cardSelf,
        {
          opacity: mountAnim,
          transform: [
            {
              translateY: mountAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Author Row */}
      <View style={styles.authorRow}>
        {post.avatarUri ? (
          <Image source={{ uri: post.avatarUri }} style={[styles.avatar, styles.avatarPhoto]} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: post.avatarColor }]}>
            <Text style={styles.avatarEmoji}>{post.avatarEmoji}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{post.userName}</Text>
            {post.isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
          </View>
          <Text style={styles.userMeta}>
            @{post.userHandle} · {timeAgo(post.timestamp)}
          </Text>
        </View>
        <View
          style={[
            styles.pathTag,
            { backgroundColor: post.pathColor + '18', borderColor: post.pathColor + '35' },
          ]}
        >
          <Text style={[styles.pathTagText, { color: post.pathColor }]}>
            {post.pathLabel}
          </Text>
        </View>
      </View>

      {/* Milestone inner card — gradient card for milestone posts */}
      {isMilestone ? (
        <View style={styles.milestoneCard}>
          <View style={styles.milestoneHeader}>
            <Text style={styles.milestoneIcon}>{typeIcon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.milestoneTitle}>{typeLabel}</Text>
              {post.skillName && (
                <Text style={[styles.milestoneSkill, { color: post.pathColor }]}>
                  {post.skillName}
                </Text>
              )}
            </View>
            {post.xpGained > 0 && (
              <View style={styles.xpBadge}>
                <Text style={styles.xpBadgeText}>+{post.xpGained} XP</Text>
              </View>
            )}
          </View>
          <Text style={styles.milestoneContent}>{post.content}</Text>
        </View>
      ) : isCareerWin ? (
        /* Career win card — gold accent, prominent win label */
        <View style={styles.winCard}>
          <View style={styles.winHeader}>
            <Text style={styles.winIcon}>{typeIcon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.winLabel}>🏆 CAREER WIN</Text>
              <Text style={styles.winType}>{typeLabel}</Text>
            </View>
            {post.xpGained > 0 && (
              <View style={styles.winXpBadge}>
                <Text style={styles.winXpText}>+{post.xpGained} XP</Text>
              </View>
            )}
          </View>
          <Text style={styles.winContent}>{post.content}</Text>
        </View>
      ) : (
        <>
          {/* Streak / output badge */}
          <View
            style={[
              styles.typeBadge,
              isStreak && styles.streakBadge,
            ]}
          >
            <Text style={styles.typeBadgeIcon}>{typeIcon}</Text>
            <Text style={[styles.typeBadgeLabel, isStreak && styles.streakLabel]}>
              {typeLabel}
            </Text>
            {post.skillName && (
              <>
                <Text style={styles.separator}>·</Text>
                <Text style={[styles.skillText, { color: post.pathColor }]}>
                  {post.skillName}
                </Text>
              </>
            )}
            {post.xpGained > 0 && (
              <View style={[styles.xpBadge, { marginLeft: 'auto' as any }]}>
                <Text style={styles.xpBadgeText}>+{post.xpGained} XP</Text>
              </View>
            )}
          </View>
          <Text style={styles.postContent}>{post.content}</Text>
        </>
      )}

      {/* Reactions */}
      <View style={styles.reactRow}>
        {/* Active reactions */}
        {reactionEntries.map(([emoji, count]) => (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactChip,
              post.userReactions.includes(emoji) && styles.reactChipActive,
            ]}
            onPress={() => onReact(post.id, emoji)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              post.userReactions.includes(emoji)
                ? `Remove ${emoji} reaction, ${count} total`
                : `React with ${emoji}, ${count} total`
            }
          >
            <Text style={styles.reactEmoji}>{emoji}</Text>
            <Text
              style={[
                styles.reactCount,
                post.userReactions.includes(emoji) && styles.reactCountActive,
              ]}
            >
              {count}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Quick-add reactions */}
        {QUICK_REACTIONS.filter((e) => !post.reactions[e]).slice(0, 3).map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={styles.quickReact}
            onPress={() => onReact(post.id, emoji)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`Add ${emoji} reaction`}
          >
            <Text style={styles.reactEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}

        {/* Bookmark */}
        {onSave && (
          <TouchableOpacity
            style={[styles.bookmarkBtn, isSaved && styles.bookmarkBtnSaved]}
            onPress={() => onSave(post.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove bookmark' : 'Bookmark this post'}
          >
            <Text style={styles.bookmarkIcon}>{isSaved ? '🔖' : '📌'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Comments */}
      {post.comments.length > 0 && (
        <View style={styles.comments}>
          <View style={styles.commentsDivider} />
          {post.comments.slice(0, 2).map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <Text style={styles.commentAuthor}>{comment.userName}</Text>
              <Text style={styles.commentText}>{comment.text}</Text>
            </View>
          ))}
          {post.comments.length > 2 && (
            <TouchableOpacity
              onPress={() => setShowCommentInput(true)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${post.comments.length - 2} more comments`}
            >
              <Text style={styles.moreComments}>+{post.comments.length - 2} more comments</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Comment input */}
      {onComment && (
        <View style={styles.commentInputWrap}>
          {showCommentInput ? (
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={Colors.textMuted}
                value={commentText}
                onChangeText={setCommentText}
                onSubmitEditing={() => {
                  if (commentText.trim()) {
                    onComment(post.id, commentText);
                    setCommentText('');
                    setShowCommentInput(false);
                  }
                }}
                returnKeyType="send"
                autoFocus
                maxLength={280}
                accessibilityLabel="Add a comment"
              />
              <TouchableOpacity
                style={[styles.commentSendBtn, !commentText.trim() && { opacity: 0.35 }]}
                onPress={() => {
                  if (commentText.trim()) {
                    onComment(post.id, commentText);
                    setCommentText('');
                    setShowCommentInput(false);
                  }
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Send comment"
                accessibilityState={{ disabled: !commentText.trim() }}
              >
                <Text style={styles.commentSendText}>→</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.commentPrompt}
              onPress={() => setShowCommentInput(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add a comment"
            >
              <Text style={styles.commentPromptText}>💬 Comment</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const makeStyles = (Colors: ColorsType) => StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  cardSelf: {
    borderColor: Colors.primary + '45',
    // @ts-ignore
    boxShadow: '0 0 14px rgba(124,58,237,0.08)',
  },

  // Author
  authorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    flexShrink: 0,
  },
  avatarEmoji: {
    fontSize: 18,
  },
  avatarPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
  },
  youBadge: {
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: 1,
  },
  userMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  pathTag: {
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    marginTop: 2,
    flexShrink: 0,
  },
  pathTagText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // Milestone inner card
  milestoneCard: {
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: Spacing.sm,
    // @ts-ignore - web-only gradient
    backgroundImage: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(79,70,229,0.10))',
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primary + '35',
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  milestoneIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  milestoneTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: 0.5,
  },
  milestoneSkill: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  milestoneContent: {
    fontSize: FontSize.sm,
    color: Colors.textSub,
    lineHeight: 20,
  },

  // Career win card — gold accent
  winCard: {
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: Spacing.sm,
    // @ts-ignore - web-only gradient
    backgroundImage: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(251,191,36,0.07))',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  winHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  winIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  winLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  winType: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  winXpBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  winXpText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gold,
  },
  winContent: {
    fontSize: FontSize.sm,
    color: Colors.textSub,
    lineHeight: 20,
  },

  // Regular type badge
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    flexWrap: 'wrap',
  },
  streakBadge: {
    backgroundColor: Colors.warning + '14',
    borderColor: Colors.warning + '40',
  },
  typeBadgeIcon: {
    fontSize: 14,
  },
  typeBadgeLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSub,
  },
  streakLabel: {
    color: Colors.warning,
  },
  separator: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  skillText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  xpBadge: {
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.gold + '35',
  },
  xpBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.gold,
  },
  postContent: {
    fontSize: FontSize.base,
    color: Colors.textSub,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },

  // Reactions
  reactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  reactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reactChipActive: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primary + '55',
  },
  quickReact: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    // @ts-ignore
    borderStyle: 'dashed',
  },
  reactEmoji: {
    fontSize: 13,
  },
  reactCount: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSub,
  },
  reactCountActive: {
    color: Colors.primaryLight,
  },
  bookmarkBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginLeft: 'auto' as any,
  },
  bookmarkBtnSaved: {
    backgroundColor: Colors.goldDim,
    borderColor: Colors.gold + '59',
  },
  bookmarkIcon: {
    fontSize: 13,
  },

  // Comments
  comments: {
    marginTop: Spacing.sm,
    gap: 6,
  },
  commentsDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 4,
  },
  comment: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  commentAuthor: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSub,
  },
  commentText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  moreComments: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  // Comment input
  commentInputWrap: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  commentPrompt: {
    paddingVertical: 4,
  },
  commentPromptText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  commentSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendText: {
    fontSize: FontSize.base,
    color: Colors.white,
    fontWeight: '700',
  },
});
