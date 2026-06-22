import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
} from 'react-native';
import { ValidationQuestion } from '../types';
import { useThemeColors, ColorsType, Spacing, Radius, FontSize } from '../utils/theme';

// ── Constants ────────────────────────────────────────────────────────────────

const VALIDATION_BONUS_XP = 100;
// Pass bar scales with the question count: 70% rounded up (7 of 10).
const passThresholdFor = (count: number) => Math.max(1, Math.ceil(count * 0.7));

// ── Sub-components ────────────────────────────────────────────────────────────

interface ChoiceRowProps {
  text: string;
  index: number;
  selected: boolean;
  revealed: boolean;
  correct: boolean;
  pathColor: string;
  onPress: () => void;
}

function ChoiceRow({ text, index, selected, revealed, correct, pathColor, onPress }: ChoiceRowProps) {
  const Colors = useThemeColors();
  const Letters = ['A', 'B', 'C', 'D'];

  const getBg = () => {
    if (!revealed) return selected ? pathColor + '18' : Colors.cardAlt;
    if (correct) return Colors.success + '18';
    if (selected && !correct) return Colors.danger + '18';
    return Colors.cardAlt;
  };
  const getBorder = () => {
    if (!revealed) return selected ? pathColor : Colors.border;
    if (correct) return Colors.success;
    if (selected && !correct) return Colors.danger;
    return Colors.border;
  };
  const getLabelBg = () => {
    if (!revealed) return selected ? pathColor : Colors.border;
    if (correct) return Colors.success;
    if (selected && !correct) return Colors.danger;
    return Colors.border;
  };
  const getLabelColor = () => (selected || (revealed && correct)) ? '#fff' : Colors.textMuted;

  return (
    <TouchableOpacity
      style={[
        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: Radius.md,
          borderWidth: 1, padding: 12, marginBottom: 8,
          backgroundColor: getBg(), borderColor: getBorder() },
      ]}
      onPress={onPress}
      disabled={revealed}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View style={[
        { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
        { backgroundColor: getLabelBg() },
      ]}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: getLabelColor() }}>
          {revealed && correct ? '✓' : revealed && selected && !correct ? '✗' : Letters[index]}
        </Text>
      </View>
      <Text style={{ flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 }}>
        {text}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ValidationChallengeModalProps {
  visible: boolean;
  skillName: string;
  skillIcon: string;
  questions: ValidationQuestion[];
  pathColor: string;
  onPass: () => void;   // called after user passes and taps continue
  onDismiss: () => void;
  // GROW-002 test-out mode (all optional → existing post-build validation unaffected):
  shuffle?: boolean;            // randomize question order on open + each retry
  maxAttempts?: number;        // cap retries; once hit, retry is replaced by build-only CTA
  attemptsUsed?: number;       // failed attempts already spent (persisted across opens)
  onAttemptFail?: () => void;  // called once per FAILED attempt (to persist the counter)
  xpReward?: number;           // headline XP shown on pass (defaults to VALIDATION_BONUS_XP)
  strict?: boolean;            // all-or-nothing: every answer must be correct, and the FIRST
                               // wrong answer ends the attempt immediately. Also shows the honor code.
}

type Phase = 'quiz' | 'result';

export default function ValidationChallengeModal({
  visible,
  skillName,
  skillIcon,
  questions,
  pathColor,
  onPass,
  onDismiss,
  shuffle = false,
  maxAttempts,
  attemptsUsed = 0,
  onAttemptFail,
  xpReward = VALIDATION_BONUS_XP,
  strict = false,
}: ValidationChallengeModalProps) {
  const Colors = useThemeColors();
  const styles = React.useMemo(() => makeStyles(Colors), [Colors]);

  // GROW-002: in test-out mode each attempt presents a freshly-shuffled question order.
  const prepareQuestions = React.useCallback(
    () => (shuffle ? [...questions].sort(() => Math.random() - 0.5) : questions),
    [shuffle, questions],
  );

  const [quizQuestions, setQuizQuestions] = useState<ValidationQuestion[]>(prepareQuestions);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>(Array(quizQuestions.length).fill(null));
  const [currentSelection, setCurrentSelection] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState<Phase>('quiz');
  const [score, setScore] = useState(0);
  // Failed attempts spent within this open session (added to the persisted attemptsUsed).
  const [sessionFails, setSessionFails] = useState(0);
  // Strict (all-or-nothing) mode: set the moment a wrong answer is confirmed → ends the attempt.
  const [strictFailed, setStrictFailed] = useState(false);
  const failReportedRef = useRef(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.85)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      const fresh = prepareQuestions();
      setQuizQuestions(fresh);
      setQuestionIndex(0);
      setSelectedAnswers(Array(fresh.length).fill(null));
      setCurrentSelection(null);
      setRevealed(false);
      setPhase('quiz');
      setScore(0);
      setSessionFails(0);
      setStrictFailed(false);
      failReportedRef.current = false;
      slideAnim.setValue(0);
    }
  }, [visible]);

  const question = quizQuestions[questionIndex];
  if (!question) return null;

  const isLastQuestion = questionIndex === quizQuestions.length - 1;
  // Strict (test-out) requires every answer correct; otherwise the existing 70% bar.
  const passThreshold = strict ? quizQuestions.length : passThresholdFor(quizQuestions.length);
  const passed = score >= passThreshold;
  // In strict mode a single wrong answer ends the attempt — the next tap goes to the result.
  const attemptOver = isLastQuestion || (strict && strictFailed);
  // Attempts remaining after the current (failed) attempt is counted.
  const attemptsRemaining = maxAttempts != null ? Math.max(0, maxAttempts - attemptsUsed - sessionFails) : Infinity;
  const canRetry = attemptsRemaining > 0;

  const handleSelect = (choiceIndex: number) => {
    if (revealed) return;
    setCurrentSelection(choiceIndex);
  };

  const handleConfirm = () => {
    if (currentSelection === null) return;

    const isCorrect = currentSelection === question.correctIndex;
    const newScore = score + (isCorrect ? 1 : 0);

    const newAnswers = [...selectedAnswers];
    newAnswers[questionIndex] = currentSelection;
    setSelectedAnswers(newAnswers);
    setScore(newScore);
    setRevealed(true);
    // Strict (all-or-nothing): one wrong answer ends the attempt — no point continuing.
    if (strict && !isCorrect) setStrictFailed(true);
  };

  const handleNext = () => {
    if (attemptOver) {
      // Show result. If this attempt failed, count it once and notify the parent so the
      // attempt counter persists (GROW-002). `score` is current here (set last confirm).
      const didPass = score >= passThreshold;
      if (!didPass && !failReportedRef.current) {
        failReportedRef.current = true;
        setSessionFails((n) => n + 1);
        onAttemptFail?.();
      }
      setPhase('result');
      Animated.parallel([
        Animated.spring(resultScale, { toValue: 1, tension: 55, friction: 8, useNativeDriver: false }),
        Animated.timing(resultOpacity, { toValue: 1, duration: 280, useNativeDriver: false }),
      ]).start();
    } else {
      // Slide to next question
      Animated.timing(slideAnim, { toValue: -1, duration: 200, useNativeDriver: false }).start(() => {
        setQuestionIndex((i) => i + 1);
        setCurrentSelection(null);
        setRevealed(false);
        slideAnim.setValue(1);
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: false }).start();
      });
    }
  };

  const handleRetry = () => {
    if (!canRetry) return; // attempts exhausted → build-only (parent shows the fallback)
    const fresh = prepareQuestions(); // re-shuffle for the next attempt
    setQuizQuestions(fresh);
    setQuestionIndex(0);
    setSelectedAnswers(Array(fresh.length).fill(null));
    setCurrentSelection(null);
    setRevealed(false);
    setScore(0);
    setPhase('quiz');
    failReportedRef.current = false;
    resultScale.setValue(0.85);
    resultOpacity.setValue(0);
    slideAnim.setValue(0);
  };

  const progressPct = ((questionIndex + (revealed ? 1 : 0)) / quizQuestions.length) * 100;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {phase === 'quiz' ? (
            <>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerIcon}>{skillIcon}</Text>
                  <View>
                    <Text style={styles.headerSkill} numberOfLines={1}>{skillName}</Text>
                    <Text style={styles.headerSub}>Knowledge Challenge</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onDismiss} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPct}%` as any,
                      backgroundColor: pathColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                Question {questionIndex + 1} of {quizQuestions.length}
              </Text>

              {/* GROW-002 strict test-out: state the stakes + honor code, always visible. */}
              {strict && (
                <View style={styles.honorBanner}>
                  <Text style={styles.honorTitle}>🤝 All or nothing · honor code</Text>
                  <Text style={styles.honorText}>
                    Every answer must be correct — one wrong answer ends this attempt. Answer from your
                    own knowledge: no looking things up or searching online. This is how you honestly
                    prove what you already know.
                  </Text>
                </View>
              )}

              {/* Question */}
              <Animated.View
                style={[
                  styles.questionWrap,
                  {
                    transform: [
                      {
                        translateX: slideAnim.interpolate({
                          inputRange: [-1, 0, 1],
                          outputRange: [-40, 0, 40],
                        }),
                      },
                    ],
                    opacity: slideAnim.interpolate({
                      inputRange: [-1, -0.2, 0, 0.2, 1],
                      outputRange: [0, 0, 1, 0, 0],
                    }),
                  },
                ]}
              >
                <Text style={styles.questionText}>{question.prompt}</Text>

                {/* Choices */}
                <View style={styles.choicesWrap}>
                  {question.choices.map((choice, i) => (
                    <ChoiceRow
                      key={i}
                      text={choice}
                      index={i}
                      selected={currentSelection === i}
                      revealed={revealed}
                      correct={i === question.correctIndex}
                      pathColor={pathColor}
                      onPress={() => handleSelect(i)}
                    />
                  ))}
                </View>

                {/* Explanation (shown after reveal) */}
                {revealed && (
                  <View style={[styles.explanation, { borderColor: currentSelection === question.correctIndex ? Colors.success + '40' : Colors.danger + '40' }]}>
                    <Text style={styles.explanationIcon}>
                      {currentSelection === question.correctIndex ? '✓' : '✗'}
                    </Text>
                    <View style={styles.explanationBody}>
                      <Text style={styles.explanationText}>{question.explanation}</Text>
                      {question.source ? (
                        <Text style={styles.explanationSource}>📚 {question.source}</Text>
                      ) : null}
                    </View>
                  </View>
                )}
              </Animated.View>

              {/* Action button */}
              {!revealed ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: currentSelection !== null ? pathColor : Colors.border }]}
                  onPress={handleConfirm}
                  disabled={currentSelection === null}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={[styles.actionBtnText, { color: currentSelection !== null ? '#fff' : Colors.textMuted }]}>
                    Confirm Answer
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: pathColor }]}
                  onPress={handleNext}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.actionBtnText}>
                    {attemptOver ? 'See Results →' : 'Next Question →'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            /* Result screen */
            <Animated.View style={[styles.result, { opacity: resultOpacity, transform: [{ scale: resultScale }] }]}>
              <Text style={[styles.resultEmoji, { color: passed ? Colors.success : Colors.gold }]}>
                {passed ? '🎓' : '📚'}
              </Text>
              <Text style={[styles.resultTitle, { color: passed ? Colors.success : Colors.text }]}>
                {passed ? 'Knowledge Validated!' : strict ? 'Not this time' : 'Almost there!'}
              </Text>
              <Text style={styles.resultScore}>
                {strict && !passed
                  ? 'One wrong answer'
                  : `${score} / ${quizQuestions.length} correct`}
              </Text>
              <Text style={styles.resultSub}>
                {passed
                  ? `You've proved you understand ${skillName}. Validated badge added to your profile.`
                  : canRetry
                    ? `${strict
                        ? 'All-or-nothing: one wrong answer ends the attempt.'
                        : `You got ${score} out of ${quizQuestions.length}.`}${maxAttempts != null ? ` ${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} left.` : ''} Try again when ready.`
                    : `${strict ? 'No attempts left.' : `You got ${score} out of ${quizQuestions.length}.`} Build this skill by logging real outputs instead.`}
              </Text>

              {passed && (
                <View style={[styles.xpBadge, { borderColor: Colors.gold + '40', backgroundColor: Colors.goldDim }]}>
                  <Text style={styles.xpBadgeText}>+{xpReward} XP · Validated ✓</Text>
                </View>
              )}

              {/* Score breakdown */}
              <View style={styles.scoreRow}>
                {quizQuestions.map((q, i) => {
                  const ans = selectedAnswers[i];
                  const correct = ans === q.correctIndex;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.scoreDot,
                        { backgroundColor: correct ? Colors.success : Colors.danger },
                      ]}
                    />
                  );
                })}
              </View>

              <View style={styles.resultBtns}>
                {passed ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: pathColor, width: '100%' }]}
                    onPress={onPass}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={styles.actionBtnText}>Continue ⚡</Text>
                  </TouchableOpacity>
                ) : canRetry ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: pathColor, flex: 1 }]}
                      onPress={handleRetry}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionBtnText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryBtn, { flex: 1 }]}
                      onPress={onDismiss}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                    >
                      <Text style={styles.secondaryBtnText}>Later</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  // GROW-002: attempts exhausted → no more retries; route to build-only.
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: pathColor, width: '100%' }]}
                    onPress={onDismiss}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={styles.actionBtnText}>Build it instead →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (Colors: ColorsType) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,8,16,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: Colors.border,
    maxHeight: '90%',
    // @ts-ignore
    boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    fontSize: 26,
  },
  headerSkill: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text,
    maxWidth: 200,
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    // @ts-ignore
    transition: 'width 0.3s ease',
  },
  progressLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  honorBanner: {
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  honorTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 2,
  },
  honorText: {
    fontSize: FontSize.xs,
    color: Colors.textSub,
    lineHeight: 17,
  },
  questionWrap: {
    marginBottom: Spacing.md,
  },
  questionText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 26,
    marginBottom: Spacing.md,
  },
  choicesWrap: {
    gap: 0,
  },
  explanation: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
  },
  explanationIcon: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 0,
    marginTop: 2,
  },
  explanationBody: {
    flex: 1,
  },
  explanationText: {
    fontSize: FontSize.xs,
    color: Colors.textSub,
    lineHeight: 17,
  },
  explanationSource: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionBtn: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    // @ts-ignore
    boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
  },
  actionBtnText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.white,
  },
  // Result screen
  result: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 10,
  },
  resultEmoji: {
    fontSize: 56,
  },
  resultTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultScore: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: Colors.text,
  },
  resultSub: {
    fontSize: FontSize.sm,
    color: Colors.textSub,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  xpBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  xpBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#F59E0B',
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  scoreDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  resultBtns: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  secondaryBtn: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardAlt,
  },
  secondaryBtnText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textSub,
  },
});
