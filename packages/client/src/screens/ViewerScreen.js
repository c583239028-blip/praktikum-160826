import { useLocalSearchParams } from 'expo-router';
import { SOCKET_EVENTS, logger } from '@worldplay/shared';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import {
  View,
  Text,
  StyleSheet,
  Button,
  TextInput,
  Alert,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  connectAppSocket,
  connectMediaSocket,
  emitMediaPromise,
  watchStreamRoom,
  leaveStreamRoom,
} from '../services/socket.service';
import { useDispatch, useSelector } from 'react-redux';
import { useVideoPlayer, VideoView } from 'expo-video';
import { initGameSession, resetSession } from '../store/slices/gameStreamSlice';
import i18n from '../i18n';
import LazyAuthModal from '../components/LazyAuthModal';
import ErrorState from '../components/ErrorState';
import LoadingSkeletonCard from '../components/LoadingSkeletonCard';
import BirthdayModal from '../components/BirthdayModal';
import { Colors } from '../../constants/design';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useAuth } from '../context/AuthContext';
import { birthdayService } from '../services/birthday.service';
import { WinLossAnimation } from '../components/game/WinLossAnimation';
import QuestionCard from '../components/game/QuestionCard';
import { clearActiveQuestion } from '../store/slices/questionsSlice';

export default function ViewerScreen() {
  const [viewState, setViewState] = useState('loading');
  const [hasInteracted, setHasInteracted] = useState(false);
  const dispatch = useDispatch();
  const {
    gameId: sessionGameId,
    streamId: sessionStreamId,
    hlsUrl,
  } = useSelector((state) => state.gameStream);
  // AC1: השאלה הפעילה מגיעה מהסוקט (game:new_question → fan-out לחדר הסטרים)
  // דרך socketMiddleware → questionsSlice. אין fetch כאן — הנתונים מגיעים
  // מה-store בלבד. [SCRUM-187 AC4]
  const activeQuestion = useSelector((state) => state.questions.activeQuestion);

  const player = useVideoPlayer(viewState === 'live' ? hlsUrl : null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    if (viewState === 'live' && hlsUrl) {
      player.play();
    }
  }, [viewState, hlsUrl, player]);
  const [status, setStatus] = useState(() =>
    i18n.t('viewer:status_waiting_for_id')
  );
  const { streamId: routeStreamId, title } = useLocalSearchParams();
  const resolvedStreamId = sessionStreamId ?? routeStreamId;
  const [streamIdInput, setStreamIdInput] = useState(resolvedStreamId ?? '');
  const autoJoinedStreamIdRef = useRef(null);
  // The stream room this screen subscribed to, so it can be untracked on
  // unmount and not replayed on a later reconnect after the user has left it.
  // [INFRA/fix/socket-room-rejoin-on-reconnect]
  const joinedStreamIdRef = useRef(null);
  const { guardedAction, isModalVisible, closeAuthModal } = useAuthGuard();
  const { user, updateUser } = useAuth();
  const [showBirthday, setShowBirthday] = useState(false);
  const [questionResult, setQuestionResult] = useState(null); // 'win' | 'lose' | null

  useEffect(() => {
    if (user && birthdayService.shouldShowPopup(user)) {
      setShowBirthday(true);
    }
  }, [user]);

  const joinAsViewer = useCallback(
    async (targetStreamId) => {
      try {
        setStatus(i18n.t('viewer:joining_stream'));
        setViewState('loading');

        // Subscribe the viewer to the stream room on the app socket, so the
        // question/status events fanned out to io.to(streamId) — game:new_question,
        // question_resolved, stream_paused/resumed — actually reach them. [SCRUM-230]
        // watchStreamRoom records the room and emits STREAM.WATCH; the emit is
        // replayed on every (re)connect, so a viewer who drops and reconnects is
        // put back in the room automatically — otherwise those events die silently
        // after the first disconnect. [INFRA/fix/socket-room-rejoin-on-reconnect]
        // connectAppSocket first so the socket exists (and the handshake starts);
        // if it is still mid-handshake the replay-on-connect covers the join.
        // Non-fatal: a subscribe failure must not block the video JOIN below.
        try {
          await connectAppSocket();
          watchStreamRoom(targetStreamId);
          joinedStreamIdRef.current = targetStreamId;
        } catch (subscribeErr) {
          logger.warn(
            `Viewer stream subscribe failed: ${subscribeErr.message}`
          );
        }

        // JOIN goes to the media socket. emitMediaPromise runs connectMediaSocket
        // and waits for a real connection (with a built-in ack timeout), so the
        // video path no longer depends on the app socket being connected.
        const data = await emitMediaPromise(SOCKET_EVENTS.STREAM.JOIN, {
          streamId: targetStreamId,
        });

        // game_screen arrives with a complete Redux session from joinGame.
        // The legacy /viewer route only supplies a streamId, so initialize a
        // viewer session for it without pretending the streamId is a gameId.
        if (sessionStreamId !== targetStreamId) {
          dispatch(
            initGameSession({
              gameId: sessionGameId,
              streamId: targetStreamId,
              role: 'VIEWER',
            })
          );
        }

        if (data.currentProducerId) {
          setStatus(i18n.t('viewer:status_live'));
          setViewState('live');
        } else {
          setStatus(i18n.t('viewer:waiting_for_host'));
          setViewState('empty');
        }
      } catch (err) {
        logger.error('Viewer join error:', err);
        setStatus(i18n.t('viewer:status_error', { message: err.message }));
        setViewState('error');
      }
    },
    [dispatch, sessionGameId, sessionStreamId]
  );

  useEffect(() => {
    if (
      resolvedStreamId &&
      autoJoinedStreamIdRef.current !== resolvedStreamId
    ) {
      autoJoinedStreamIdRef.current = resolvedStreamId;
      setHasInteracted(true);
      setStreamIdInput(resolvedStreamId);
      joinAsViewer(resolvedStreamId);
    }
  }, [resolvedStreamId, joinAsViewer]);

  useEffect(() => {
    let mediaSocket;
    let appSocket;

    // STREAM.ENDED is emitted by the media server (stream.handler.js), so the
    // viewer must listen for it on the media socket — the same socket JOIN uses.
    // The media socket is a shared singleton, so keep a reference to this exact
    // handler and remove only it on cleanup (not every ENDED listener).
    const handleStreamEnded = () => {
      setStatus(i18n.t('viewer:status_stream_ended'));
      setViewState('ended');
    };
    connectMediaSocket()
      .then((s) => {
        if (!s) return;
        mediaSocket = s;
        mediaSocket.on(SOCKET_EVENTS.STREAM.ENDED, handleStreamEnded);
      })
      .catch((err) => logger.error('Viewer media socket error:', err));

    // STREAM_PAUSED / STREAM_RESUMED stay on the app socket for now — no server
    // emits them yet (handled separately), so migrating them here is a no-op.
    connectAppSocket()
      .then((s) => {
        if (!s) return;
        appSocket = s;
        appSocket.on(SOCKET_EVENTS.STREAM.STREAM_PAUSED, () => {
          playerRef.current?.pause();
        });
        appSocket.on(SOCKET_EVENTS.STREAM.STREAM_RESUMED, () => {
          playerRef.current?.play();
        });
        appSocket.on(SOCKET_EVENTS.GAME.QUESTION_RESULT, ({ type }) => {
          setQuestionResult(type);
        });
      })
      // connectAppSocket can now reject on 'connect_error' (SCRUM-264). These
      // status listeners are non-fatal, so swallow and warn rather than leaving
      // an unhandled rejection on the viewer entry path.
      .catch((err) =>
        logger.warn(`Viewer app socket error: ${err?.message ?? err}`)
      );

    return () => {
      if (mediaSocket) {
        mediaSocket.off(SOCKET_EVENTS.STREAM.ENDED, handleStreamEnded);
      }
      if (appSocket) {
        appSocket.off(SOCKET_EVENTS.STREAM.STREAM_PAUSED);
        appSocket.off(SOCKET_EVENTS.STREAM.STREAM_RESUMED);
        appSocket.off(SOCKET_EVENTS.GAME.QUESTION_RESULT);
      }
      // Untrack the stream room so a reconnect after leaving this screen does
      // not silently re-subscribe. [INFRA/fix/socket-room-rejoin-on-reconnect]
      if (joinedStreamIdRef.current) {
        leaveStreamRoom(joinedStreamIdRef.current);
        joinedStreamIdRef.current = null;
      }
      dispatch(resetSession());
      // AC2: לנקות את השאלה הפעילה ביציאה מהמסך. בלי זה שאלה שננטשה באמצע
      // דולפת למסך הבא — markResolved מנקה רק את מסלול ה-QUESTION_RESOLVED,
      // וכרגע זה ה-dispatcher היחיד ל-clearActiveQuestion באפליקציה. [SCRUM-187 AC4]
      dispatch(clearActiveQuestion());
    };
  }, [dispatch]);
  const handleJoinPress = async () => {
    if (!streamIdInput) {
      Alert.alert(i18n.t('viewer:alert_enter_stream_id'));
      return;
    }
    setHasInteracted(true);
    await joinAsViewer(streamIdInput);
  };
  // Placeholder הימור זמני עד S4/SCRUM-282 (מנגנון ה-drag + emit של place_bet
  // בצד הלקוח). גם handleSubmitBet (הכפתור התחתון) וגם handleWager (בחירת אופציה
  // בכרטיס) הם placeholders עד לטיקט הזה — הודעה אחת משותפת כדי לא לשכפל מחרוזת.
  const showBetPlaceholder = () => {
    Alert.alert(
      i18n.t('viewer:bet_submitted_title'),
      i18n.t('viewer:bet_submitted_message')
    );
  };

  const handleSubmitBet = () => {
    showBetPlaceholder();
  };

  // הצופה מהמר (בניגוד לשחקן שהיה קריאה-בלבד), ולכן QuestionCard חייב onWager.
  // מגודר ב-guardedAction כי המהמר חייב להיות מחובר. ה-optionId יחווט ל-place_bet
  // ב-S4/SCRUM-282; כרגע לא בשימוש בכוונה. [SCRUM-187 AC4]
  const handleWager = (_optionId) => {
    guardedAction(showBetPlaceholder);
  };

  const handleBirthdayConfirm = async (date) => {
    try {
      const iso = date.toISOString().split('T')[0];
      await birthdayService.saveBirthday(iso);
      updateUser({ dateOfBirth: iso });
      setShowBirthday(false);
    } catch (err) {
      logger.error('Birthday save failed:', err.message);
      Alert.alert(
        i18n.t('birthday:save_error_title'),
        i18n.t('birthday:save_error_message')
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>
        {title ?? i18n.t('viewer:default_title')}
      </Text>
      {!hasInteracted ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={i18n.t('viewer:stream_id_placeholder')}
            placeholderTextColor={Colors.neutral[500]}
            value={streamIdInput}
            onChangeText={setStreamIdInput}
          />
          <Button
            title={i18n.t('viewer:join_button')}
            onPress={() => guardedAction(handleJoinPress)}
            color={Colors.live}
          />
        </View>
      ) : (
        <View style={styles.videoBox}>
          {viewState === 'loading' && <LoadingSkeletonCard />}
          {viewState === 'error' && <ErrorState onRetry={handleJoinPress} />}
          {viewState === 'empty' && (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.statusText}>{status}</Text>
              <Button
                title={i18n.t('viewer:retry_button')}
                onPress={() => joinAsViewer(streamIdInput || resolvedStreamId)}
                color={Colors.live}
              />
            </View>
          )}
          {viewState === 'ended' && (
            <Text style={styles.statusText}>{status}</Text>
          )}
          {viewState === 'live' && hlsUrl && (
            <VideoView
              player={player}
              style={styles.video}
              nativeControls={false}
              contentFit="contain"
              allowsFullscreen={false}
              allowsPictureInPicture={false}
            />
          )}
        </View>
      )}
      <Text style={styles.statusBadge}>{status}</Text>
      <View style={styles.betButtonContainer}>
        <Button
          title={i18n.t('viewer:submit_bet_button')}
          onPress={() => guardedAction(handleSubmitBet)}
          color={Colors.success.main}
        />
      </View>
      {/* AC1: אוברליי השאלה צף מעל הווידאו. pointerEvents="box-none" מבטיח
          שהמכל עצמו לא חוסם מגע — רק ילדיו (הכרטיס) מקבלים אירועים, כך שהווידאו
          והכפתורים שמתחת נשארים לחיצים (AC3). QuestionCard מגן על עצמו עם null,
          אבל גידור ב-activeQuestion מונע מכל absolute ריק. גידור נוסף ב-live מונע
          מהכרטיס לצוף מעל מסך הזנת ה-streamId / loading / empty / ended — כאן
          viewState==='live' נגזר נכון (setViewState('live') ב-JOIN). [SCRUM-187 AC4] */}
      {viewState === 'live' && activeQuestion && (
        <View style={styles.questionOverlay} pointerEvents="box-none">
          <QuestionCard question={activeQuestion} onWager={handleWager} />
        </View>
      )}
      <LazyAuthModal visible={isModalVisible} onClose={closeAuthModal} />
      <BirthdayModal visible={showBirthday} onConfirm={handleBirthdayConfirm} />
      {questionResult && (
        <WinLossAnimation
          type={questionResult}
          onFinish={() => setQuestionResult(null)}
        />
      )}
      {__DEV__ && (
        <View style={styles.devTestContainer}>
          <Text style={styles.devTestLabel}>🐛 DEV — K4 manual test</Text>
          <View style={styles.devTestRow}>
            <Button
              title="Test Win"
              onPress={() => setQuestionResult('win')}
              color={Colors.success.main}
            />
            <Button
              title="Test Lose"
              onPress={() => setQuestionResult('lose')}
              color={Colors.warning.dark}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[900],
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: Colors.surface.white,
    fontSize: 22,
    marginBottom: 30,
    fontWeight: 'bold',
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  inputContainer: { width: '100%', alignItems: 'center' },
  input: {
    backgroundColor: Colors.surface.white,
    width: '90%',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    textAlign: 'center',
  },
  videoBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.neutral[900],
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: { width: '100%', height: '100%' },
  statusText: {
    color: Colors.text.tertiary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  emptyStateContainer: {
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    color: Colors.warning.dark,
    marginTop: 20,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  betButtonContainer: { width: '100%', alignItems: 'center', marginTop: 20 },
  questionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  devTestContainer: {
    position: 'absolute',
    top: 12,
    end: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    padding: 8,
    zIndex: 100,
  },
  devTestLabel: {
    color: Colors.surface.white,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  devTestRow: { flexDirection: 'row', gap: 8 },
});
