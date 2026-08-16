import PropTypes from 'prop-types';
import React, { useState } from 'react';
import {
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily } from '../../../../constants/design';
import BackSvg from '../../../../assets/icons/back.svg';
import VectorSvg from '../../../../assets/icons/vectore.svg';
import { createQuestion } from '../../../services/questionsApi';
import {
  TIME_LIMIT_OPTIONS,
  DEFAULT_TIME_LIMIT,
} from '../../../../constants/timeLimits';
import { TimeLimitSelector } from './TimeLimitSelector';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scaleW = SCREEN_WIDTH / 375;
const scaleH = SCREEN_HEIGHT / 812;

// ─── REUSABLE: BOTTOM BUTTON ──────────────────────────────────────────────────
function BottomButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[
        styles.bottomBtn,
        isPrimary ? styles.bottomBtnPrimary : styles.bottomBtnGhost,
        disabled && styles.bottomBtnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={Colors.text.primary} size="small" />
      ) : (
        <Text
          style={[styles.bottomBtnText, isPrimary && styles.bottomBtnTextBold]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
BottomButton.propTypes = {
  label: PropTypes.string.isRequired,
  onPress: PropTypes.func,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  variant: PropTypes.oneOf(['primary', 'ghost']),
};

// ─── REUSABLE: LIVE BADGE ─────────────────────────────────────────────────────
function LiveBadge({ label }) {
  return (
    <View style={styles.liveBadge}>
      <Text style={styles.liveBadgeText}>{label}</Text>
      <View style={styles.liveDot} />
    </View>
  );
}
LiveBadge.propTypes = {
  label: PropTypes.string.isRequired,
};

// ─── ADD QUESTION FORM ────────────────────────────────────────────────────────
export function AddQuestionForm({
  gameId,
  onClose,
  onQuestionAdded,
  onNavigateToDrafts,
  onNavigateToViewerQuestions,
}) {
  const { t } = useTranslation('question');

  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState(null);
  const [questionFocused, setQuestionFocused] = useState(false);
  const [responseTime, setResponseTime] = useState(DEFAULT_TIME_LIMIT);

  const isExpanded = questionFocused || questionText.length > 0;

  const canSubmit =
    questionText.trim().length > 0 &&
    options.filter((o) => o.trim().length > 0).length >= 2;

  const handleOptionChange = (text, index) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const handleAddOption = () => setOptions((prev) => [...prev, '']);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const filledOptions = options
        .filter((o) => o.trim().length > 0)
        .map((o) => ({ text: o.trim() }));

      // responseTime (seconds) maps to the backend `timeLimit` field.
      await createQuestion({
        gameId,
        questionText: questionText.trim(),
        options: filledOptions,
        timeLimit: responseTime,
      });

      onQuestionAdded();
      onClose();
    } catch (err) {
      setError(err.message || t('addQuestion.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setError(null);
    try {
      // Drafts go through the same endpoint with isDraft:true. The server still
      // requires questionText + >= 2 options, so filter blanks like publish does.
      const filledOptions = options
        .filter((o) => o.trim().length > 0)
        .map((o) => ({ text: o.trim() }));

      await createQuestion({
        gameId,
        questionText: questionText.trim(),
        options: filledOptions,
        timeLimit: responseTime,
        isDraft: true,
      });

      // Confirm the save by moving the moderator to the drafts list.
      onNavigateToDrafts();
    } catch (err) {
      setError(err.message || t('addQuestion.errorDraft'));
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <Modal animationType="slide" visible statusBarTranslucent>
      <SafeAreaView style={styles.newQuestionScreen}>
        {/* Header */}
        <View style={styles.nqHeader}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackSvg width={24} height={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.nqTitle}>{t('addQuestion.title')}</Text>
          <LiveBadge label={t('common.live')} />
        </View>

        {/* Tabs */}
        <View style={styles.nqTabsRow}>
          <TouchableOpacity
            style={styles.nqTabButton}
            onPress={onNavigateToViewerQuestions}
          >
            <VectorSvg width={24} height={24} color={Colors.text.primary} />
            <Text style={styles.nqTabText}>
              {t('addQuestion.tabViewerQuestions')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.nqTabButton}
            onPress={onNavigateToDrafts}
          >
            <VectorSvg width={24} height={24} color={Colors.text.primary} />
            <Text style={styles.nqTabText}>{t('addQuestion.tabDrafts')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.nqScroll}
          contentContainerStyle={styles.nqScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Question card */}
          <View style={styles.nqCard}>
            <Text style={styles.nqSectionLabel}>
              {isExpanded
                ? t('addQuestion.cardLabelExpanded')
                : t('addQuestion.cardLabelCollapsed')}
            </Text>

            {isExpanded && (
              <Text style={styles.nqQuestionLabel}>
                {t('addQuestion.yourQuestion')}
              </Text>
            )}

            <TextInput
              style={[
                styles.nqQuestionInput,
                questionFocused && styles.nqQuestionInputFocused,
              ]}
              value={questionText}
              onChangeText={setQuestionText}
              onFocus={() => setQuestionFocused(true)}
              onBlur={() => setQuestionFocused(false)}
              placeholder={isExpanded ? '' : t('addQuestion.yourQuestion')}
              placeholderTextColor={`${Colors.text.primary}B3`}
            />

            <Text style={styles.nqOptionalLabel}>
              {t('addQuestion.optionalAnswers')}
            </Text>
            <View style={styles.nqAnswersContainer}>
              {options.map((opt, i) => (
                <TextInput
                  key={i}
                  style={styles.nqAnswerInput}
                  value={opt}
                  onChangeText={(text) => handleOptionChange(text, i)}
                  placeholder={t('addQuestion.answerPlaceholder', {
                    number: i + 1,
                  })}
                  placeholderTextColor={Colors.text.tertiary}
                />
              ))}
            </View>

            <TouchableOpacity
              style={styles.nqAddBtn}
              onPress={handleAddOption}
              activeOpacity={0.7}
            >
              <Text style={styles.nqAddBtnText}>+</Text>
            </TouchableOpacity>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          {/* Response time — visible only when expanded */}
          {isExpanded && (
            <View style={styles.nqResponseTimeRow}>
              <View style={styles.nqResponseTimeTexts}>
                <Text style={styles.nqResponseTimeTitle}>
                  {t('addQuestion.responseTimeTitle')}
                </Text>
                <Text style={styles.nqResponseTimeSubtitle}>
                  {t('addQuestion.responseTimeSubtitle')}
                </Text>
              </View>
              <TimeLimitSelector
                options={TIME_LIMIT_OPTIONS}
                value={responseTime}
                onChange={setResponseTime}
                unitLabel={t('addQuestion.seconds')}
              />
            </View>
          )}
        </ScrollView>

        {/* Bottom nav */}
        <View style={styles.nqBottomNav}>
          <BottomButton
            label={t('addQuestion.draftSaved')}
            variant="ghost"
            loading={savingDraft}
            onPress={handleSaveDraft}
          />
          <BottomButton
            label={t('addQuestion.publish')}
            variant="primary"
            disabled={!canSubmit}
            loading={submitting}
            onPress={handleSubmit}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

AddQuestionForm.propTypes = {
  gameId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onQuestionAdded: PropTypes.func.isRequired,
  onNavigateToDrafts: PropTypes.func.isRequired,
  onNavigateToViewerQuestions: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  newQuestionScreen: {
    flex: 1,
    backgroundColor: Colors.surface.white,
  },
  nqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16 * scaleW,
    height: 65 * scaleH,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
    backgroundColor: Colors.surface.white,
  },
  nqTitle: {
    fontFamily: FontFamily.primary,
    fontSize: 18 * scaleW,
    fontWeight: '700',
    lineHeight: 24 * scaleW,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6 * scaleW,
    paddingVertical: 6 * scaleH,
    paddingHorizontal: 10 * scaleW,
    borderRadius: 9999,
    backgroundColor: Colors.neutral[100],
  },
  liveBadgeText: {
    fontFamily: FontFamily.primary,
    fontSize: 12 * scaleW,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  liveDot: {
    width: 8 * scaleW,
    height: 8 * scaleW,
    borderRadius: 4 * scaleW,
    backgroundColor: Colors.live,
  },
  nqTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16 * scaleW,
    paddingVertical: 12 * scaleH,
    justifyContent: 'space-between',
  },
  nqTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12 * scaleW,
    paddingVertical: 8 * scaleH,
    paddingHorizontal: 16 * scaleW,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 8 * scaleW,
    height: 40 * scaleH,
  },
  nqTabText: {
    fontFamily: FontFamily.primary,
    fontSize: 14 * scaleW,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  nqScroll: {
    flex: 1,
  },
  nqScrollContent: {
    paddingHorizontal: 16 * scaleW,
    paddingTop: 16 * scaleH,
    paddingBottom: 127 * scaleH,
  },
  nqCard: {
    backgroundColor: Colors.surface.white,
    borderRadius: 16 * scaleW,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
    padding: 16 * scaleW,
    shadowColor: Colors.text.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    gap: 16 * scaleW,
  },
  nqSectionLabel: {
    fontFamily: FontFamily.primary,
    fontSize: 14 * scaleW,
    fontWeight: '500',
    lineHeight: 18 * scaleW,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  nqQuestionInput: {
    borderRadius: 24 * scaleW,
    borderWidth: 1,
    borderColor: Colors.neutral[900],
    paddingTop: 12 * scaleH,
    paddingBottom: 12 * scaleH,
    paddingLeft: 16 * scaleW,
    paddingRight: 16 * scaleW,
    fontSize: 14 * scaleW,
    fontFamily: FontFamily.primary,
    fontWeight: '400',
    color: Colors.text.primary,
    backgroundColor: Colors.surface.white,
  },
  nqQuestionInputFocused: {
    borderColor: Colors.primary.default,
    borderWidth: 1.5,
  },
  nqQuestionLabel: {
    fontFamily: FontFamily.primary,
    fontSize: 13 * scaleW,
    fontWeight: '400',
    color: Colors.text.secondary,
    marginBottom: 4 * scaleH,
  },
  nqOptionalLabel: {
    fontFamily: FontFamily.primary,
    fontSize: 14 * scaleW,
    fontWeight: '400',
    color: Colors.text.secondary,
  },
  nqAnswersContainer: {
    gap: 8 * scaleH,
  },
  nqAnswerInput: {
    height: 48 * scaleH,
    borderRadius: 16 * scaleW,
    backgroundColor: Colors.neutral[100],
    paddingHorizontal: 16 * scaleW,
    fontSize: 14 * scaleW,
    fontFamily: FontFamily.primary,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  nqAddBtn: {
    width: 40 * scaleW,
    height: 40 * scaleW,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  nqAddBtnText: {
    color: Colors.text.primary,
    fontSize: 22 * scaleW,
    lineHeight: 26 * scaleW,
  },
  nqBottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8 * scaleW,
    paddingVertical: 12 * scaleH,
    paddingHorizontal: 16 * scaleW,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    backgroundColor: Colors.surface.white,
  },
  errorText: {
    color: Colors.error.main,
    fontSize: 12 * scaleW,
    fontFamily: FontFamily.primary,
  },
  bottomBtn: {
    flex: 1,
    height: 44 * scaleH,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBtnPrimary: {
    backgroundColor: Colors.primary.default,
  },
  bottomBtnGhost: {
    borderWidth: 1,
    borderColor: Colors.surface.white,
  },
  bottomBtnDisabled: {
    opacity: 0.5,
  },
  bottomBtnText: {
    fontFamily: FontFamily.primary,
    fontSize: 14 * scaleW,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  bottomBtnTextBold: {
    fontWeight: '700',
  },
  nqResponseTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8 * scaleW,
    paddingVertical: 8 * scaleH,
    paddingHorizontal: 8 * scaleW,
    marginTop: 16 * scaleH,
  },
  nqResponseTimeTexts: {
    flex: 1,
    gap: 2 * scaleH,
  },
  nqResponseTimeTitle: {
    fontFamily: FontFamily.primary,
    fontSize: 14 * scaleW,
    fontWeight: '500',
    lineHeight: 18 * scaleW,
    color: Colors.text.primary,
  },
  nqResponseTimeSubtitle: {
    fontFamily: FontFamily.primary,
    fontSize: 12 * scaleW,
    fontWeight: '400',
    lineHeight: 16 * scaleW,
    color: Colors.text.secondary,
  },
  nqResponseTimeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8 * scaleW,
  },
  // nqResponseTimeBtn: {
  //     width: 32 * scaleW,
  //     height: 32 * scaleW,
  //     borderRadius: 9999,
  //     borderWidth: 1,
  //     borderColor: Colors.primary.default,
  //     alignItems: 'center',
  //     justifyContent: 'center',
  // },
  // nqResponseTimeBtnDisabled: {
  //     borderColor: Colors.neutral[300],
  //     opacity: 0.4,
  // },
  // nqResponseTimeBtnText: {
  //     fontFamily: FontFamily.primary,
  //     fontSize: 20 * scaleW,
  //     lineHeight: 24 * scaleW,
  //     color: Colors.primary.default,
  // },
  // nqResponseTimeCounter: {
  //     minWidth: 52 * scaleW,
  //     paddingHorizontal: 6 * scaleW,
  //     paddingVertical: 4 * scaleH,
  //     borderRadius: 8 * scaleW,
  //     backgroundColor: Colors.neutral[100],
  //     alignItems: 'center',
  //     justifyContent: 'center',
  // },
  // nqResponseTimeValue: {
  //     fontFamily: FontFamily.primary,
  //     fontSize: 16 * scaleW,
  //     fontWeight: '700',
  //     lineHeight: 22 * scaleW,
  //     color: Colors.text.primary,
  //     textAlign: 'center',
  // },
  // nqResponseTimeUnit: {
  //     fontFamily: FontFamily.primary,
  //     fontSize: 10 * scaleW,
  //     fontWeight: '400',
  //     color: Colors.text.secondary,
  //     textAlign: 'center',
  // },
});
