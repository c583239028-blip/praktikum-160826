// WHY (D-05): orphaned screen — no importer in the app. Kept as reference, NOT deleted,
// because it is the only surviving implementation of the gift + question-resolve flow.
// Deletion is blocked until that logic is migrated to the production screens — see the
// gift-migration ticket. Do not wire this file into routing; it is dev reference only.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { getAppSocket } from '../services/socket.service';
import { updateBalances } from '../store/slices/walletSlice';
import { API_BASE_URL } from '../services/apiConfig';
import { apiFetch } from '../services/apiHelpers';
import { userService } from '../services/userService';
import Badge from '../components/game/ui/Badge';
import Card from '../components/game/ui/Card';
import Field from '../components/game/ui/Field';
import Btn from '../components/game/ui/Btn';
import { SOCKET_EVENTS } from '@worldplay/shared/src/constants/socketEvents.js';

const BASE_URL = `${API_BASE_URL}/api`;

// ─── UI primitives ────────────────────────────────────────────
// Badge, Card, Field and Btn were extracted to
// packages/client/src/components/game/{Badge,Card,Field,Btn}.js
// so role screens can reuse them instead of redefining them inline.

const NoQuestion = () => {
  const { t } = useTranslation('game');
  return (
    <Card>
      <Text
        style={{ color: '#9ca3af', textAlign: 'center', paddingVertical: 20 }}
      >
        {t('no_active_question')}
      </Text>
    </Card>
  );
};

// ─── WINNER_TAKES_ALL form ────────────────────────────────────
const WinnerForm = ({ gameId, onCreated }) => {
  const { t } = useTranslation('game');
  const [questionText, setQuestionText] = useState('');
  const [player1Name, setPlayer1Name] = useState('');
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!questionText.trim())
      return Alert.alert(t('error_title'), t('error_question_text_required'));
    if (!player1Name.trim() || !player2Name.trim())
      return Alert.alert(t('error_title'), t('error_player_names_required'));
    setLoading(true);
    try {
      const body = {
        gameId,
        questionText,
        rewardType: 'WINNER_TAKES_ALL',
        options: [
          {
            text: player1Name,
            isCorrect: false,
            ...(player1Id.trim() ? { linkedPlayerId: player1Id.trim() } : {}),
          },
          { text: player2Name, isCorrect: false },
        ],
      };
      const data = await apiFetch(`${BASE_URL}/questions`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const q = data.question || data;
      Alert.alert(
        t('question_created_title'),
        t('question_id_prefix', { id: q.id || '—' })
      );
      onCreated(q);
    } catch (e) {
      console.error('Create winner question error:', e);
      Alert.alert(t('error_title'), e.message || t('error_network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Badge label={t('badge_who_wins')} color="#60a5fa" />
      <View style={{ height: 14 }} />
      <Field
        label={t('field_question_text')}
        value={questionText}
        onChangeText={setQuestionText}
        placeholder={t('placeholder_who_wins')}
      />
      <Field
        label={t('field_player_a_name')}
        value={player1Name}
        onChangeText={setPlayer1Name}
        placeholder={t('placeholder_player_a_name')}
      />
      <Field
        label={t('field_player_a_id')}
        value={player1Id}
        onChangeText={setPlayer1Id}
        placeholder={t('placeholder_uuid')}
      />
      <Field
        label={t('field_player_b_name')}
        value={player2Name}
        onChangeText={setPlayer2Name}
        placeholder={t('placeholder_player_b_name')}
      />
      <Btn
        label={t('btn_create_question')}
        onPress={handleCreate}
        color="#60a5fa"
        loading={loading}
      />
    </>
  );
};
WinnerForm.propTypes = {
  gameId: PropTypes.string.isRequired,
  onCreated: PropTypes.func.isRequired,
};

// ─── STANDARD form (multiple choice) ─────────────────────────
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const StandardForm = ({ gameId, onCreated }) => {
  const { t } = useTranslation('game');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [loading, setLoading] = useState(false);

  const updateText = (index, value) => {
    const updated = [...options];
    updated[index] = { ...updated[index], text: value };
    setOptions(updated);
  };

  const setCorrect = (index) => {
    setOptions(options.map((opt, i) => ({ ...opt, isCorrect: i === index })));
  };

  const addOption = () => {
    if (options.length < 4)
      setOptions([...options, { text: '', isCorrect: false }]);
  };

  const removeOption = (index) => {
    if (options.length <= 2) return;
    const updated = options.filter((_, i) => i !== index);
    const hasCorrect = updated.some((o) => o.isCorrect);
    if (!hasCorrect) updated[0] = { ...updated[0], isCorrect: true };
    setOptions(updated);
  };

  const handleCreate = async () => {
    if (!questionText.trim())
      return Alert.alert(t('error_title'), t('error_question_text_required'));
    const filled = options.filter((o) => o.text.trim());
    if (filled.length < 2)
      return Alert.alert(t('error_title'), t('error_min_options'));
    if (!filled.some((o) => o.isCorrect))
      return Alert.alert(t('error_title'), t('error_mark_correct'));
    setLoading(true);
    try {
      const body = {
        gameId,
        questionText,
        rewardType: 'STANDARD',
        options: filled.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
      };
      const data = await apiFetch(`${BASE_URL}/questions`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const q = data.question || data;
      Alert.alert(
        t('question_created_title'),
        t('question_id_prefix', { id: q.id || '—' })
      );
      onCreated(q);
    } catch (e) {
      console.error('Create standard question error:', e);
      Alert.alert(t('error_title'), e.message || t('error_network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Badge label={t('badge_multiple_choice')} color="#a78bfa" />
      <View style={{ height: 14 }} />
      <Field
        label={t('field_question_text')}
        value={questionText}
        onChangeText={setQuestionText}
        placeholder={t('placeholder_write_question')}
      />
      <Text style={stdStyles.optionsTitle}>{t('options_instructions')}</Text>
      {options.map((opt, i) => (
        <View key={i} style={stdStyles.optBlock}>
          <View style={stdStyles.optRow}>
            <View style={stdStyles.optLetter}>
              <Text style={stdStyles.optLetterText}>{OPTION_LABELS[i]}</Text>
            </View>
            <TextInput
              style={[
                stdStyles.optInput,
                opt.isCorrect && stdStyles.optInputCorrect,
              ]}
              value={opt.text}
              onChangeText={(v) => updateText(i, v)}
              placeholder={t('placeholder_option', {
                letter: OPTION_LABELS[i],
              })}
              placeholderTextColor="#4b5563"
              autoCapitalize="none"
            />
          </View>
          <View style={stdStyles.optActions}>
            <TouchableOpacity
              style={[
                stdStyles.correctBtn,
                opt.isCorrect && stdStyles.correctBtnActive,
              ]}
              onPress={() => setCorrect(i)}
            >
              <Text
                style={[
                  stdStyles.correctBtnText,
                  opt.isCorrect && stdStyles.correctBtnTextActive,
                ]}
              >
                {opt.isCorrect ? t('btn_correct') : t('btn_mark_correct')}
              </Text>
            </TouchableOpacity>
            {options.length > 2 && (
              <TouchableOpacity
                style={stdStyles.removeBtn}
                onPress={() => removeOption(i)}
              >
                <Text style={stdStyles.removeBtnText}>{t('btn_remove')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
      {options.length < 4 && (
        <TouchableOpacity style={stdStyles.addBtn} onPress={addOption}>
          <Text style={stdStyles.addBtnText}>
            {t('btn_add_option', { count: options.length })}
          </Text>
        </TouchableOpacity>
      )}
      <Btn
        label={t('btn_create_question')}
        onPress={handleCreate}
        color="#a78bfa"
        loading={loading}
      />
    </>
  );
};
StandardForm.propTypes = {
  gameId: PropTypes.string.isRequired,
  onCreated: PropTypes.func.isRequired,
};

const stdStyles = StyleSheet.create({
  optionsTitle: {
    color: '#6b7280',
    fontSize: 11,
    marginBottom: 10,
    textAlign: 'right',
  },
  optBlock: {
    backgroundColor: '#1a2235',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 10,
    overflow: 'hidden',
  },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  optLetter: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optLetterText: { color: '#9ca3af', fontWeight: '800', fontSize: 13 },
  optInput: {
    flex: 1,
    backgroundColor: 'transparent',
    color: '#f9fafb',
    fontSize: 14,
    paddingVertical: 4,
  },
  optInputCorrect: { color: '#a78bfa' },
  optActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  correctBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  correctBtnActive: { backgroundColor: '#a78bfa22', borderColor: '#a78bfa' },
  correctBtnText: { color: '#6b7280', fontWeight: '700', fontSize: 12 },
  correctBtnTextActive: { color: '#a78bfa' },
  removeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8717122',
    borderWidth: 1,
    borderColor: '#f87171',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
  addBtn: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    borderStyle: 'dashed',
    padding: 11,
    alignItems: 'center',
    marginBottom: 12,
  },
  addBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 13 },
});

// ─── Load existing question ────────────────────────────────────
const LoadForm = ({ gameId, onCreated }) => {
  const { t } = useTranslation('game');
  const [openQuestions, setOpenQuestions] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedQ, setSelectedQ] = useState(null);

  const fetchOpenQuestions = async () => {
    if (!gameId) return Alert.alert(t('error_title'), t('error_enter_game_id'));
    setLoadingList(true);
    setOpenQuestions([]);
    setSelectedQ(null);
    try {
      const data = await apiFetch(`${BASE_URL}/questions/game/${gameId}`);
      const questions = Array.isArray(data) ? data : data.questions || [];
      const open = questions.filter((q) => !q.isResolved);
      if (open.length === 0)
        Alert.alert(t('no_questions_title'), t('no_questions_found'));
      setOpenQuestions(open);
    } catch (e) {
      console.error('Fetch open questions error:', e);
      Alert.alert(t('error_title'), e.message || t('error_network'));
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchOpenQuestions();
  }, []);

  const handleSelect = (q) => {
    setSelectedQ(q);
    onCreated(q);
    Alert.alert(t('question_loaded_title'), q.questionText || q.text || q.id);
  };

  return (
    <>
      <Badge label={t('badge_open_questions')} color="#fbbf24" />
      <View style={{ height: 12 }} />
      {loadingList && (
        <ActivityIndicator color="#fbbf24" style={{ marginVertical: 20 }} />
      )}
      {!loadingList && openQuestions.length === 0 && (
        <Text
          style={{ color: '#6b7280', textAlign: 'center', paddingVertical: 16 }}
        >
          {t('no_open_questions')}
        </Text>
      )}
      {openQuestions.map((q) => (
        <TouchableOpacity
          key={q.id}
          style={[
            loadStyles.item,
            selectedQ?.id === q.id && loadStyles.itemSelected,
          ]}
          onPress={() => handleSelect(q)}
        >
          <View style={loadStyles.itemHeader}>
            <Text style={loadStyles.itemText} numberOfLines={2}>
              {q.questionText || q.text || '—'}
            </Text>
            <View
              style={[
                loadStyles.typeBadge,
                {
                  backgroundColor:
                    q.rewardType === 'WINNER_TAKES_ALL'
                      ? '#60a5fa22'
                      : '#a78bfa22',
                  borderColor:
                    q.rewardType === 'WINNER_TAKES_ALL' ? '#60a5fa' : '#a78bfa',
                },
              ]}
            >
              <Text
                style={{
                  color:
                    q.rewardType === 'WINNER_TAKES_ALL' ? '#60a5fa' : '#a78bfa',
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                {q.rewardType === 'WINNER_TAKES_ALL' ? '🏆' : '📝'}
              </Text>
            </View>
          </View>
          <Text style={loadStyles.itemId}>{q.id?.slice(0, 8)}…</Text>
        </TouchableOpacity>
      ))}
      {!loadingList && (
        <Btn
          label={t('btn_refresh')}
          onPress={fetchOpenQuestions}
          color="#374151"
        />
      )}
    </>
  );
};
LoadForm.propTypes = {
  gameId: PropTypes.string.isRequired,
  onCreated: PropTypes.func.isRequired,
};

const loadStyles = StyleSheet.create({
  item: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  itemSelected: { borderColor: '#fbbf24', backgroundColor: '#fbbf2411' },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemText: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginRight: 8,
  },
  itemId: { color: '#6b7280', fontSize: 11 },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});

// ─── CreateQuestionSection (wrapper) ─────────────────────────
const CreateQuestionSection = ({ gameId, onCreated }) => {
  const { t } = useTranslation('game');
  const [mode, setMode] = useState('winner');

  const MODES = [
    { id: 'winner', label: t('tab_who_wins') },
    { id: 'standard', label: t('tab_multiple_choice') },
    { id: 'load', label: t('tab_load') },
  ];

  return (
    <Card>
      <View style={modeStyles.row}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[modeStyles.btn, mode === m.id && modeStyles.btnActive]}
            onPress={() => setMode(m.id)}
          >
            <Text
              style={[
                modeStyles.btnText,
                mode === m.id && modeStyles.btnTextActive,
              ]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 16 }} />
      {mode === 'winner' && (
        <WinnerForm gameId={gameId} onCreated={onCreated} />
      )}
      {mode === 'standard' && (
        <StandardForm gameId={gameId} onCreated={onCreated} />
      )}
      {mode === 'load' && <LoadForm gameId={gameId} onCreated={onCreated} />}
    </Card>
  );
};
CreateQuestionSection.propTypes = {
  gameId: PropTypes.string.isRequired,
  onCreated: PropTypes.func.isRequired,
};
const modeStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  btnActive: { backgroundColor: '#ffa50222', borderColor: '#ffa502' },
  btnText: { color: '#6b7280', fontWeight: '700', fontSize: 12 },
  btnTextActive: { color: '#ffa502' },
});

// ─── ResolveQuestionSection ───────────────────────────────────
// WINNER_TAKES_ALL → select the winner
// STANDARD         → one button to close (correct answer is known from creation)
const ResolveQuestionSection = ({ question }) => {
  const { t } = useTranslation('game');
  const [loading, setLoading] = useState(false);
  if (!question) return null;

  const isWinner = question.rewardType === 'WINNER_TAKES_ALL';
  const options = question.options || [];
  const correctOpt = options.find((o) => o.isCorrect);

  const handleResolve = async (optionId) => {
    setLoading(true);
    try {
      await apiFetch(`${BASE_URL}/questions/${question.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ optionId }),
      });
      Alert.alert(t('question_closed_title'), t('pot_distributed'));
    } catch (e) {
      Alert.alert(t('error_title'), e.message || t('error_server_connection'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Badge label={t('badge_close_question')} color="#f87171" />
      <Text style={resolve.questionText}>
        {question.questionText || question.text}
      </Text>

      {isWinner ? (
        <>
          <Text style={resolve.subTitle}>{t('select_winner')}</Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[resolve.optBtn, loading && { opacity: 0.6 }]}
              onPress={() => handleResolve(opt.id)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={resolve.optLabel}>🏆 {opt.text || opt.label}</Text>
              )}
            </TouchableOpacity>
          ))}
        </>
      ) : (
        <>
          {correctOpt && (
            <View style={resolve.correctBox}>
              <Text style={resolve.correctLabel}>
                {t('correct_answer_label')}
              </Text>
              <Text style={resolve.correctText}>{correctOpt.text}</Text>
            </View>
          )}
          <Btn
            label={t('btn_close_distribute')}
            onPress={() => correctOpt && handleResolve(correctOpt.id)}
            color="#f87171"
            loading={loading}
            disabled={!correctOpt}
          />
        </>
      )}
    </Card>
  );
};
ResolveQuestionSection.propTypes = {
  question: PropTypes.shape({
    id: PropTypes.string,
    rewardType: PropTypes.string,
    questionText: PropTypes.string,
    text: PropTypes.string,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        text: PropTypes.string,
        label: PropTypes.string,
        isCorrect: PropTypes.bool,
      })
    ),
  }),
};
ResolveQuestionSection.defaultProps = { question: null };
const resolve = StyleSheet.create({
  questionText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 12,
    textAlign: 'right',
  },
  subTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  optBtn: {
    backgroundColor: '#fbbf24',
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  optLabel: { color: '#000', fontWeight: '800', fontSize: 14 },
  correctBox: {
    backgroundColor: '#a78bfa22',
    borderWidth: 1,
    borderColor: '#a78bfa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  correctLabel: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  correctText: {
    color: '#f9fafb',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
});

// ─── BettingSection ───────────────────────────────────────────
const BettingSection = ({ question }) => {
  const { t } = useTranslation('game');
  const [wager, setWager] = useState('10');
  const [loadingOption, setLoadingOption] = useState(null);
  if (!question) return null;
  const options = question.options || [];

  const handleBet = async (optionId, optionLabel) => {
    if (!wager || Number(wager) <= 0)
      return Alert.alert(t('error_title'), t('error_invalid_wager'));
    setLoadingOption(optionId);
    try {
      await apiFetch(`${BASE_URL}/user-answers/submit`, {
        method: 'POST',
        body: JSON.stringify({
          questionId: question.id,
          selectedOptionId: optionId,
          wager: Number(wager),
        }),
      });
      Alert.alert(
        t('bet_placed_title'),
        t('bet_placed_msg', { wager, option: optionLabel })
      );
    } catch (e) {
      Alert.alert(t('error_title'), e.message || t('error_network'));
    } finally {
      setLoadingOption(null);
    }
  };

  return (
    <Card>
      <Badge label={t('badge_bets')} color="#a78bfa" />
      <Text style={bet.questionText}>
        {question.questionText || question.text}
      </Text>
      <Field
        label={t('field_wager_amount')}
        value={wager}
        onChangeText={setWager}
        placeholder={t('placeholder_10')}
        keyboardType="numeric"
      />
      <View style={{ gap: 10, marginTop: 4 }}>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={opt.id}
            style={[bet.optBtn, loadingOption === opt.id && { opacity: 0.6 }]}
            onPress={() => handleBet(opt.id, opt.text || opt.label)}
            disabled={!!loadingOption}
          >
            {loadingOption === opt.id ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={bet.optLabel}>
                {OPTION_LABELS[i] ? `${OPTION_LABELS[i]}. ` : ''}
                {opt.text || opt.label}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );
};
BettingSection.propTypes = {
  question: PropTypes.shape({
    id: PropTypes.string,
    questionText: PropTypes.string,
    text: PropTypes.string,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        text: PropTypes.string,
        label: PropTypes.string,
      })
    ),
  }),
};
BettingSection.defaultProps = { question: null };
const bet = StyleSheet.create({
  questionText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 12,
    textAlign: 'right',
  },
  optBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },
  optLabel: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

// ─── SendGiftSection ──────────────────────────────────────────
const SendGiftSection = ({ gameId }) => {
  const { t } = useTranslation('game');
  const [senderId, setSenderId] = useState('');
  const [receiverPlayerId, setReceiverPlayerId] = useState('');
  const [moderatorId, setModeratorId] = useState('');
  const [giftValue, setGiftValue] = useState('');
  const [giftGameId, setGiftGameId] = useState(gameId || '');
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);

  useEffect(() => {
    if (gameId) setGiftGameId(gameId);
  }, [gameId]);

  const handleSend = async () => {
    if (
      !senderId ||
      !receiverPlayerId ||
      !moderatorId ||
      !giftValue ||
      !giftGameId
    )
      return Alert.alert(t('error_title'), t('error_all_fields_required'));
    setLoading(true);
    setLastResponse(null);
    try {
      const body = {
        senderId,
        receiverPlayerId,
        moderatorId,
        giftValue: Number(giftValue),
        gameId: giftGameId,
      };
      const data = await apiFetch(`${BASE_URL}/economy/gifts/send`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setLastResponse({ ok: true, data });
      Alert.alert(
        t('gift_sent_title'),
        t('gift_sent_msg', { amount: giftValue })
      );
    } catch (e) {
      Alert.alert(t('error_title'), `${t('error_network')}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Badge label={t('badge_send_gift')} color="#34d399" />
      <View style={{ height: 14 }} />
      <Field
        label={t('field_sender_id')}
        value={senderId}
        onChangeText={setSenderId}
        placeholder={t('placeholder_uuid')}
      />
      <Field
        label={t('field_receiver_id')}
        value={receiverPlayerId}
        onChangeText={setReceiverPlayerId}
        placeholder={t('placeholder_uuid')}
      />
      <Field
        label={t('field_moderator_id')}
        value={moderatorId}
        onChangeText={setModeratorId}
        placeholder={t('placeholder_uuid')}
      />
      <Field
        label={t('field_game_id')}
        value={giftGameId}
        onChangeText={setGiftGameId}
        placeholder={t('placeholder_uuid')}
      />
      <Field
        label={t('field_gift_amount')}
        value={giftValue}
        onChangeText={setGiftValue}
        placeholder={t('placeholder_100')}
        keyboardType="numeric"
      />
      <Btn
        label={t('btn_send_gift')}
        onPress={handleSend}
        color="#34d399"
        loading={loading}
      />
      {lastResponse && (
        <View
          style={{
            marginTop: 12,
            padding: 10,
            backgroundColor: lastResponse.ok ? '#052e16' : '#450a0a',
            borderRadius: 8,
          }}
        >
          <Text
            style={{
              color: lastResponse.ok ? '#34d399' : '#f87171',
              fontSize: 12,
              fontWeight: '700',
            }}
          >
            {lastResponse.ok ? t('status_success') : t('status_error')}
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>
            {JSON.stringify(lastResponse.data).slice(0, 200)}
          </Text>
        </View>
      )}
    </Card>
  );
};
SendGiftSection.propTypes = { gameId: PropTypes.string.isRequired };

// ─── Main GameScreen ──────────────────────────────────────────
const GameScreen = ({ gameId: gameIdProp }) => {
  const { t } = useTranslation('game');
  const dispatch = useDispatch();
  const walletBalance = useSelector((state) => state.wallet.walletBalance || 0);
  const isModerator = true;

  const [resolvedGameId, setResolvedGameId] = useState(gameIdProp || '');
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [activeTab, setActiveTab] = useState('question');

  const score = useSelector(
    (state) => state.wallet.scoresByGame?.[resolvedGameId] || 0
  );

  const fetchOpenQuestion = async (gId) => {
    if (!gId) return;
    try {
      const data = await apiFetch(`${BASE_URL}/questions/game/${gId}`);
      const questions = Array.isArray(data) ? data : data.questions || [];
      const open = questions.find((q) => !q.isResolved);
      if (open) {
        setActiveQuestion(open);
      }
    } catch (e) {
      console.error('Fetch question error:', e);
    }
  };

  useEffect(() => {
    if (resolvedGameId) fetchOpenQuestion(resolvedGameId);
  }, [resolvedGameId]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await userService.getMe();
        dispatch(
          updateBalances({
            walletCoins: data.walletCoins || data.walletBalance,
            scoresByGame: data.scoresByGame || {},
          })
        );
      } catch (e) {
        console.error('Fetch stats error:', e);
      }
    };
    fetchStats();
    const onUpdate = (data) => {
      dispatch(updateBalances(data));
    };
    const s = getAppSocket();
    if (s) s.on(SOCKET_EVENTS.WALLET.BALANCE_UPDATE, onUpdate);
    return () => {
      const s2 = getAppSocket();
      if (s2) s2.off(SOCKET_EVENTS.WALLET.BALANCE_UPDATE, onUpdate);
    };
  }, [resolvedGameId, dispatch]);

  const tabs = [
    { id: 'question', label: t('main_tab_question') },
    { id: 'bet', label: t('main_tab_bet') },
    ...(isModerator ? [{ id: 'resolve', label: t('main_tab_resolve') }] : []),
    { id: 'gift', label: t('main_tab_gift') },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('header_control_panel')}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statChipLabel}>{t('stat_wallet')}</Text>
            <Text style={[styles.statChipVal, { color: '#ffa502' }]}>
              {Number(walletBalance).toFixed(0)}
            </Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statChipLabel}>{t('stat_score')}</Text>
            <Text style={[styles.statChipVal, { color: '#34d399' }]}>
              {Number(score).toFixed(0)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.gameIdRow}>
        <Text style={styles.gameIdLabel}>{t('label_game_id')}</Text>
        <TextInput
          style={styles.gameIdInput}
          value={resolvedGameId}
          onChangeText={setResolvedGameId}
          placeholder={t('placeholder_enter_game_id')}
          placeholderTextColor="#4b5563"
          autoCapitalize="none"
          onEndEditing={() => fetchOpenQuestion(resolvedGameId)}
        />
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tItem) => (
          <TouchableOpacity
            key={tItem.id}
            style={[styles.tab, activeTab === tItem.id && styles.tabActive]}
            onPress={() => setActiveTab(tItem.id)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tItem.id && styles.tabTextActive,
              ]}
            >
              {tItem.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {activeTab === 'question' && (
          <CreateQuestionSection
            gameId={resolvedGameId}
            onCreated={(q) => {
              setActiveQuestion(q);
              if (isModerator) setActiveTab('resolve');
            }}
          />
        )}
        {activeTab === 'bet' &&
          (activeQuestion ? (
            <BettingSection question={activeQuestion} />
          ) : (
            <NoQuestion />
          ))}
        {activeTab === 'resolve' &&
          isModerator &&
          (activeQuestion ? (
            <ResolveQuestionSection question={activeQuestion} />
          ) : (
            <NoQuestion />
          ))}
        {activeTab === 'gift' && <SendGiftSection gameId={resolvedGameId} />}
      </ScrollView>
    </View>
  );
};

GameScreen.propTypes = { gameId: PropTypes.string };
GameScreen.defaultProps = { gameId: null };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030712' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: '#030712',
    borderBottomWidth: 1,
    borderColor: '#111827',
  },
  headerTitle: { color: '#f9fafb', fontSize: 20, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  statChipLabel: { color: '#6b7280', fontSize: 10, marginBottom: 2 },
  statChipVal: { fontWeight: '800', fontSize: 16 },
  gameIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0a0f1a',
    borderBottomWidth: 1,
    borderColor: '#111827',
  },
  gameIdLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 58,
  },
  gameIdInput: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffa502',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#374151',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0a0f1a',
    borderBottomWidth: 1,
    borderColor: '#111827',
  },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: '#ffa502' },
  tabText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#ffa502' },
  scroll: { flex: 1 },
});

export default GameScreen;
