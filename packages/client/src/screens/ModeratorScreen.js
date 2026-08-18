import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import ModeratoreNav from '../components/game/ModeratoreNav';
// --- K3 ---
import JoinLifecycle from '../components/game/JoinLifecycle/index';

// --- K1 ---
import { Avatar } from '../components/game/Avatar';
import { AvatarsRow } from '../components/game/AvatarsRow';
import Badge from '../components/game/ui/Badge';
import Card from '../components/game/ui/Card';
import Btn from '../components/game/ui/Btn';
import { LiveIndicator } from '../components/game/LiveIndicator';
import PowerIcon from '@/assets/icons/power.svg';

// --- SCRUM-222 (שלך) ---
import { AddQuestionForm } from '../components/game/questionModerator/AddQuestionForm';
import { ViewerQuestionsList } from '../components/game/questionModerator/ViewerQuestionsList';
import { DraftQuestionsList } from '../components/game/questionModerator/DraftQuestionsList';
import { OpenQuestionsList } from '../components/game/questionModerator/OpenQuestionsList';

// --- Services ---
import {
  getAppSocket,
  connectAppSocket,
  emitMediaPromise,
} from '../services/socket.service';
import { resolveQuestion } from '../services/questionsApi';

// --- SCRUM-174: hook משותף לצריכת WebRTC (media-socket), במקום stream: null ---
// consume-only - המנחה לא מפרסם producer משלו, ולכן אין local stream כאן,
// רק מה שה-hook מחזיר מה-media-server.
import { useRemoteStreams, CONNECTION_STATUS } from '../hooks/useRemoteStreams';
import { SOCKET_EVENTS } from '../../../shared/src/constants/socketEvents';

// --- Redux ---
import { initGameSession } from '../store/slices/gameStreamSlice';
import {
  fetchGameQuestions,
  clearActiveQuestion,
  selectDraftQuestions,
  selectOpenQuestions,
} from '../store/slices/questionsSlice';

// import { updateStreamStats } from '../store/slices/streamStatsSlice';

// --- Design tokens ---
import {
  Colors,
  Spacing,
  BorderRadius,
  TextStyles,
  FontSize,
} from '../../constants/design';

import { SpeakerIconWrapper } from '../components/game/ui/SpeakerIconWrapper';
import { PlayersDetailModal } from '../components/game/PlayersDetailModal';
// פאנל פרופיל שחקן (bottom sheet) - נפתח בלחיצה על אווטאר ב-AvatarsRow
import { PlayerProfilePanel } from '../components/game/profile/PlayerProfilePanel';
// דף הפרופיל המלא - נפתח מתוך "Go to profile" בפאנל, באותו pattern
// של החלפת "מסך" פנימי כמו AddQuestionForm/DraftQuestionsList/וכו' (לא ניווט אמיתי)
import ProfileView from '../components/game/profile/ProfileView';
import { OpenQuestionModal } from '../components/game/questionModerator/OpenQuestionModal';
import { NoPermissionToWriteModal } from '../components/game/questionModerator/NoPermissionToWriteModal';
import { StreamLayout } from '../components/game/StreamLayout';
import { OpenQuestionsPillsRow } from '../components/game/questionModerator/OpenQuestionsPillsRow';

// --- טוסט "שאלה חדשה מצופה" ---
import { NewQuestionToast } from '../components/game/questionModerator/NewQuestionToast';
import { PublishResultToast } from '../components/game/questionModerator/PublishResultToast';
import ConnectionsList from '../components/game/connections/ConnectionsList';
// participantsSlice + socketMiddleware כבר מספקים avatarUrl אמיתי לכל
// משתתף (ראו addParticipant/socketMiddleware.js). כאן משמש רק כ-fallback
// למקרה שה-avatarUrl עדיין לא הגיע (למשל משתתף שהצטרף לפני שהנתון נשלח).
const DEFAULT_AVATAR_URL = 'https://placehold.co/64x64/png?text=%20';

// [1.1] INVITE_STATE - הופרד ENTERING (spinner מעברי בתוך JoinLifecycle,
// בזמן ההמתנה לתשובת שרת ל-ACCEPT_MODERATOR) מ-ENTERED (המנחה בפועל
// בפנים, פותח את הלוח הראשי). קודם שני התפקידים חלקו את אותו string
// ('entering'), ולכן ה-render logic (if inviteState !== ENTERING) מעולם
// לא הציג בפועל את מסך ה-spinner.
const INVITE_STATE = {
  DIALOG: 'dialog',
  ENTERING: 'entering',
  ENTERED: 'entered',
  REJECTED: 'rejected',
};

// פאנל שאלות פעיל - איזה מ-4 המודלים פתוח כרגע (או null)
const PANEL = {
  ADD: 'add',
  DRAFT: 'draft',
  OPEN: 'open',
  VIEWER: 'viewer',
};

// מספר הצופים המינימלי הנדרש בשידור כדי שהמנחה יוכל לפרסם שאלה
// (שאלה שהוא כתב בעצמו או שאלה שנשלחה ע"י צופה) - לפי הדרישה החדשה.
const MIN_VIEWERS_TO_PUBLISH = 50;

export default function ModeratorScreen({ route }) {
  const { t } = useTranslation('game');
  const dispatch = useDispatch();

  const [inviteState, setInviteState] = useState(null); // null = טרם התקבלה הזמנה
  const [inviteData, setInviteData] = useState({
    gameId: null,
    streamId: null, // TODO: לוודא שה-payload של MODERATOR_INVITATION אכן כולל streamId
    inviterName: '',
    inviterImageUri: '',
    countdown: 60,
  });

  const socketRef = useRef(null);

  // ---------------------------------------------------------------------
  // טוסט "שאלה חדשה מצופה" - מוצג כשצופה שולח הצעת שאלה (UI בלבד,
  // לא נוגע ב-state של השאלות עצמן - זה כבר מטופל ב-questionsSlice)
  // TODO: לאשר את שמות השדות בפועל שמגיעים ב-payload של NEW_QUESTION
  // ---------------------------------------------------------------------
  const [newQuestionToast, setNewQuestionToast] = useState({
    visible: false,
    authorName: '',
    gameTitle: '',
  });

  // רישום listeners - כולל טיפול במקרה שה-socket עוד לא מחובר (כמו socketMiddleware.js)
  // הערה: MODERATOR_INVITATION / MODERATOR_RESPONSE עדיין לא אושרו כמטופלים
  // ב-socketMiddleware הקיים (בניגוד ל-NEW_QUESTION/QUESTION_RESOLVED שכן
  // אושרו) - לכן עדיין מאזינים להם כאן ידנית.
  useEffect(() => {
    let cancelled = false;
    let socket = null;

    const onModeratorInvitation = (payload) => {
      // TODO: לוודא שמות שדות מדויקים מהשרת (hostName->inviterName, gameTitle, timeout->countdown)
      setInviteData({
        gameId: payload?.gameId ?? null,
        streamId: payload?.streamId ?? null,
        inviterName: payload?.hostName ?? '',
        inviterImageUri: payload?.hostImageUri ?? '',
        countdown: payload?.timeout ?? 60,
      });
      setInviteState(INVITE_STATE.DIALOG);
    };

    const onModeratorResponse = (payload) => {
      // רק לתפיסת timeout/דחייה שמקורה בשרת (לא ביוזמת המנחה עצמו)
      if (payload?.status === 'REJECTED') {
        setInviteState(INVITE_STATE.REJECTED);
      }
    };

    // NEW_QUESTION כבר מטופל בתוך questionsSlice/socketMiddleware לעדכון
    // הרשימה בפועל (draft/open) - הרישום כאן הוא נוסף ורק כדי להציג את
    // טוסט ה"שאלה חדשה מצופה" (ראו תמונת מסך) - לא נוגע ב-state של השאלות.
    const onNewQuestion = (payload) => {
      // TODO: לוודא שמות שדות מדויקים מהשרת (authorName, gameTitle)
      setNewQuestionToast({
        visible: true,
        authorName: payload?.authorName ?? '',
        gameTitle: payload?.gameTitle ?? '',
      });
    };

    const setupListeners = async () => {
      await connectAppSocket();
      if (cancelled) return;
      socket = getAppSocket();
      if (!socket) {
        // socket עדיין לא מוכן - retry, בדומה ל-socketMiddleware.js
        setTimeout(setupListeners, 1000);
        return;
      }
      socketRef.current = socket;
      socket.on(SOCKET_EVENTS.GAME.MODERATOR_INVITATION, onModeratorInvitation);
      socket.on(SOCKET_EVENTS.GAME.MODERATOR_RESPONSE, onModeratorResponse);
      socket.on(SOCKET_EVENTS.GAME.NEW_QUESTION, onNewQuestion);
    };

    setupListeners();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.off(
          SOCKET_EVENTS.GAME.MODERATOR_INVITATION,
          onModeratorInvitation
        );
        socketRef.current.off(
          SOCKET_EVENTS.GAME.MODERATOR_RESPONSE,
          onModeratorResponse
        );
        socketRef.current.off(SOCKET_EVENTS.GAME.NEW_QUESTION, onNewQuestion);
      }
    };
  }, []);

  useEffect(() => {
    if (!newQuestionToast.visible) return;
    const timer = setTimeout(
      () => setNewQuestionToast((prev) => ({ ...prev, visible: false })),
      3000
    );
    return () => clearTimeout(timer);
  }, [newQuestionToast.visible]);

  const handleAccept = useCallback(async () => {
    // [1.1] תיקון: state מעבר ל-ENTERING (spinner) *לפני* קריאת השרת,
    // ורק אחרי תשובה מוצלחת עוברים ל-ENTERED (הלוח הראשי בפועל).
    setInviteState(INVITE_STATE.ENTERING);
    try {
      await emitMediaPromise(SOCKET_EVENTS.GAME.ACCEPT_MODERATOR, {
        gameId: inviteData.gameId,
      });
      setInviteState(INVITE_STATE.ENTERED);

      // gameStream.gameId לא מתעדכן אוטומטית ב-flow הזה (initGameSession
      // נקרא היום רק ב-flow של HOST) - קוראים לו כאן ידנית כדי שרכיבים
      // אחרים שתלויים ב-Redux (עתידי, כולל שכבת הוידאו) יקבלו streamId/role.
      dispatch(
        initGameSession({
          gameId: inviteData.gameId,
          streamId: inviteData.streamId,
          role: 'MODERATOR',
        })
      );
    } catch (err) {
      // TODO: הצגת שגיאה למשתמש (טרם הוגדר UI לשגיאת accept)
      console.log('ACCEPT_MODERATOR failed', err);
    }
  }, [inviteData.gameId, inviteData.streamId, dispatch]);

  const handleReject = useCallback(async () => {
    try {
      await emitMediaPromise(SOCKET_EVENTS.GAME.REJECT_MODERATOR, {
        gameId: inviteData.gameId,
      });
    } catch (err) {
      console.log('REJECT_MODERATOR failed', err);
    } finally {
      setInviteState(INVITE_STATE.REJECTED);
    }
  }, [inviteData.gameId]);

  // ---------------------------------------------------------------------
  // 2. gameId לאורך כל חיי המסך - מקור יחיד: local state (inviteData),
  //    לא Redux (gameStream.gameId עלול להישאר null - סוכם עם Sara)
  // ---------------------------------------------------------------------
  const gameId = inviteData.gameId;

  // ---------------------------------------------------------------------
  // 3. משתתפים
  // ---------------------------------------------------------------------
  // [
  const participants = useSelector((s) => s.participants.list);
  const activeProducerIds = useSelector((s) => s.gameStream.activeProducers);

  // ---------------------------------------------------------------------
  // 3b. וידאו משתתפים (SCRUM-174) - consume-only, בלי self-preview למנחה
  // ---------------------------------------------------------------------
  const streamId = useSelector((s) => s.gameStream.streamId);
  const {
    streams: remoteStreams,
    status: remoteStreamsStatus,
    error: remoteStreamsError,
  } = useRemoteStreams({ streamId });

  useEffect(() => {
    if (remoteStreamsStatus === CONNECTION_STATUS.ERROR) {
      console.error('Moderator video connection error:', remoteStreamsError);
    }
  }, [remoteStreamsStatus, remoteStreamsError]);

  // ---------------------------------------------------------------------
  // 4. סטטיסטיקות שידור (LiveIndicator) - מוק זמני
  // ---------------------------------------------------------------------
  const streamStats = useSelector((s) => s.streamStats);
  const streamStatus = useSelector((s) => s.gameStream.status);

  // ---------------------------------------------------------------------
  // 5. שאלות - מקור: questionsSlice (thunk + selectors), לא local state
  // ---------------------------------------------------------------------
  const [activePanel, setActivePanel] = useState(null);
  // TODO: mute/unmute - עדיין אין socket/redux אמיתי, state לוקלי בלבד לפי מה שסיכמנו
  const [isMuted, setIsMuted] = useState(false);
  const handleToggleMute = useCallback(() => {
    // TODO: לחבר ללוגיקת mute אמיתית כשתהיה קיימת
    setIsMuted((prev) => !prev);
  }, []);

  // מודל "view all the players" - נפתח מ-Show details, מחליף את בלוק ה-Card הישן
  const [isPlayersModalVisible, setIsPlayersModalVisible] = useState(false);

  const [activePlayerIds, setActivePlayerIds] = useState([]);
  const handleTogglePlayer = useCallback((id) => {
    setActivePlayerIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  }, []);

  // ---------------------------------------------------------------------
  // פאנל פרופיל שחקן (PlayerProfilePanel) + דף פרופיל מלא (ProfileView)
  // ---------------------------------------------------------------------
  // TODO: כמו activePlayerIds למעלה - אין עדיין מקור אמיתי (API/Redux) לרשימת
  // "מי אני עוקב אחריו". באותו סטטוס בדיוק - state לוקלי בלבד עד שיהיה מקור אמיתי.
  const [followingPlayerIds, setFollowingPlayerIds] = useState([]);
  const handleToggleFollow = useCallback((id) => {
    setFollowingPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  }, []);

  // נתוני השחקן שנבחר (מוצג בפאנל ו/או בדף הפרופיל המלא)
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isPlayerPanelVisible, setIsPlayerPanelVisible] = useState(false);
  const [isFullProfileVisible, setIsFullProfileVisible] = useState(false);
  const [isConnectionsListVisible, setIsConnectionsListVisible] =
    useState(false);

  const handleOpenConnectionsList = useCallback(() => {
    setIsConnectionsListVisible(true);
  }, []);

  const handleCloseConnectionsList = useCallback(() => {
    setIsConnectionsListVisible(false);
  }, []);
  const handleAvatarPress = useCallback(
    (avatarPlayer) => {
      // TODO: אין עדיין מקור אמיתי ל-name/bio/inProgressCount/followersCount
      // per-participant (אותו TODO שכבר קיים למעלה בקובץ לגבי avatarUrl/giftCount) -
      // placeholder זמני עד שהשדות האלה יגיעו מהשרת/Redux.
      setSelectedPlayer({
        id: avatarPlayer.id,
        name: avatarPlayer.username,
        username: `@${avatarPlayer.username}`,
        avatarUri: avatarPlayer.avatarUrl,
        inProgressCount: 0,
        followersCount: 0,
        bio: '',
        isFollowing: followingPlayerIds.includes(avatarPlayer.id),
      });
      setIsPlayerPanelVisible(true);
    },
    [followingPlayerIds]
  );

  const handleClosePlayerPanel = useCallback(() => {
    setIsPlayerPanelVisible(false);
    setSelectedPlayer(null);
  }, []);

  // "Go to profile" - לא ניווט אמיתי, אותו pattern כמו שאר ה"מסכים" הפנימיים
  // של הקובץ הזה (AddQuestionForm/DraftQuestionsList/OpenQuestionsList/וכו') -
  // מחליפים תצוגה ע"י state לוקלי, לא react-navigation.
  const handleGoToProfile = useCallback(() => {
    setIsPlayerPanelVisible(false);
    setIsFullProfileVisible(true);
  }, []);

  const handleCloseFullProfile = useCallback(() => {
    setIsFullProfileVisible(false);
    setSelectedPlayer(null);
  }, []);

  // מודל שאלה פתוחה בודדת (OpenQuestionModal קיים) - נפתח מלחיצה על pill בתחתית
  const [activeOpenQuestionId, setActiveOpenQuestionId] = useState(null);

  // הודעת הצלחה אחרי פרסום (704)
  const [showPublishToast, setShowPublishToast] = useState(false);
  const [publishedQuestionsCount, setPublishedQuestionsCount] = useState(0);

  // מודל "אין הרשאה לפרסם" - קופץ כשמנחה מנסה לפרסם שאלה (שכתב בעצמו או
  // שאלה שצופה שלח) ועדיין אין מספיק צופים בשידור (MIN_VIEWERS_TO_PUBLISH).
  const [isNoPermissionModalVisible, setIsNoPermissionModalVisible] =
    useState(false);
  const draftQuestions = useSelector(selectDraftQuestions);
  const openQuestions = useSelector(selectOpenQuestions);
  // activeQuestion זמין דרך useSelector((s) => s.questions.activeQuestion)
  // אם יידרש בעתיד להצגה נפרדת - כרגע מוצג כחלק מ-openQuestions (AC4).

  // Pull חד-פעמי בכניסה למסך (לפי החלטת ראש הצוות: "dispatch אחד בטעינה").
  // עדכונים בזמן אמת (NEW_QUESTION/QUESTION_RESOLVED) כבר מטופלים בתוך
  // ה-slice עצמו דרך socketMiddleware הקיים - אין כאן listener נוסף.
  // [1.1] תיקון: התנאי עודכן מ-INVITE_STATE.ENTERING ל-INVITE_STATE.ENTERED,
  // כי ENTERING עכשיו הוא ה-spinner המעברי בלבד ולא "המנחה כבר בפנים".
  useEffect(() => {
    if (inviteState === INVITE_STATE.ENTERED && gameId) {
      dispatch(fetchGameQuestions(gameId));
    }
  }, [inviteState, gameId, dispatch]);

  // ניקוי activeQuestion ביציאה מהמסך (AC4)
  useEffect(() => {
    return () => {
      dispatch(clearActiveQuestion());
    };
  }, [dispatch]);

  // --- מיפוי שאלות לפורמט שכל רכיב מצפה לו ---
  const mappedDraftQuestions = draftQuestions.map((q) => ({
    id: q.id,
    authorName: q.authorName ?? '', // TODO: שדה לא קיים כרגע ב-questionsSlice - לאשר מקור
    text: q.questionText,
    answers: (q.options || []).map((opt) => ({
      id: opt.id,
      text: opt.text,
    })),
  }));

  const mappedOpenQuestions = openQuestions.map((q) => ({
    id: q.id,
    text: q.questionText,
    time: q.timeLimit != null ? String(q.timeLimit) : undefined,
    participantsCount: q.participantsCount, // TODO: שדה לא קיים כרגע ב-questionsSlice - לאשר מקור
    answers: (q.options || []).map((opt) => ({
      id: opt.id,
      text: opt.text,
    })),
  }));

  const activeOpenQuestion =
    mappedOpenQuestions.find((q) => q.id === activeOpenQuestionId) ?? null;
  // TODO: מקור נפרד לשאלות מהצופים (ViewerQuestionsList) - אין selector כזה
  // ב-questionsSlice החדש (selectDraftQuestions/selectOpenQuestions/
  // selectResolvedQuestions בלבד). לא ברור אם זה אותו slice עם שדה מבדיל
  // נוסף, או ערוץ/endpoint נפרד לגמרי. לא לבנות בלי אישור - כרגע מערך ריק.
  const viewerQuestions = [];
  // --- SCRUM-174: בניית ה-streams האמיתיים למסך המנחה (במקום stream: null) ---
  // [EVIDENCE -] consume-only: מסננים החוצה role === MODERATOR (המנחה
  // עצמו) - לפי ה-AC: "המנחה רואה producers של host+players בלבד, בלי tile
  // של עצמו". SELF_ROLE תואם את הערך שנשלח ב-dispatch(initGameSession({..,
  // role:'MODERATOR'})) למעלה בקובץ.
  const SELF_ROLE = 'MODERATOR';
  // TODO: לאשר מול Sara/דבורי את שמות ה-roles המדויקים שהשרת שולח בפועל
  // ב-STREAM.JOIN/NEW_PRODUCER (HOST/PLAYER מונחים לפי gameStreamSlice.js,
  // לא אושר positively מול payload אמיתי מה-media-server).
  const ROLE_LABELS = {
    HOST: 'Host',
    PLAYER: 'Player',
  };

  // activeProducerIds (gameStream.activeProducers) ו-remoteStreams[].producerId
  // חיים באותו מרחב מזהים (producerId, mediasoup) - סינון כאן תקין ולא ניחוש,
  // בשונה ממיזוג ישיר עם participants.list (ראו evidence ב-§3 למעלה, מרחב userId).
  const gatedRemoteStreams =
    activeProducerIds && activeProducerIds.length > 0
      ? remoteStreams.filter((s) => activeProducerIds.includes(s.producerId))
      : remoteStreams; // [EVIDENCE - מאושר] נבדק בכל הקוד: אין אף מקום שקורא dispatch(updateActiveStreams(...)) - האקשן מיוצא מה-slice אך לא בשימוש. activeProducers תמיד [] בענף הנוכחי (state מת עד ש-SCRUM-185, שכנראה אחראי על חיווט ה-dispatch, ימוזג). ה-fallback הזה הכרחי, לא ליתר ביטחון - בלעדיו הרשימה תהיה ריקה תמיד.

  const mappedParticipantStreams = gatedRemoteStreams
    .filter((s) => s.role !== SELF_ROLE)
    .map((s) => ({
      stream: s.stream, // תוקן - זרם אמיתי מ-useRemoteStreams, לא null
      // [EVIDENCE - §2.2] label לפי role, לא username: אין שדה שממפה
      // producerId->userId באף slice/hook שנבדק, אז לא ניתן להציג username
      // אמיתי מ-participants.list כרגע. ראו evidence המלא ב-§3 למעלה.
      label: ROLE_LABELS[s.role] ?? s.role,
      isMicOn: true, // TODO: אין מקור אמיתי ל-mic state per-producer -
      isCameraOff: false, // יש כעת video track אמיתי מה-hook
      profileUrl: DEFAULT_AVATAR_URL, // TODO: אין avatarUrl per-producer (יש per-userId ב-participantsSlice, אך אין קישור)
      isSelected: false, // TODO: אין מושג "משתתף נבחר/מודגש" ב-state הנוכחי
      giftCount: 0, // TODO: streamStats.giftCount הוא כללי לשידור, לא per-participant
    }));

  //  תיקון: הבדיקה המשותפת (מספיק צופים בשידור) הופרדה לפונקציה
  // עצמאית, כי handlePublish מפוצל עכשיו לשני handlers שונים - אחד
  // ליצירת שאלה חדשה (AddQuestionForm, בלי questionId/selectedAnswerId)
  // ואחד לפרסום תוצאה בפועל (OpenQuestionsList/OpenQuestionModal, עם
  // questionId+selectedAnswerId שצריך לשלוח לשרת). ראו
  const canPublish = useCallback(() => {
    if ((streamStats.viewerCount ?? 0) < MIN_VIEWERS_TO_PUBLISH) {
      setIsNoPermissionModalVisible(true);
      return false;
    }
    return true;
  }, [streamStats.viewerCount]);

  // נקרא מ-AddQuestionForm (onQuestionAdded) כששאלה חדשה נוצרה בשרת
  // (POST כבר קורה בתוך AddQuestionForm עצמה) - כאן רק מרעננים את
  // הרשימה ומציגים טוסט הצלחה, אין resolve כי אין שאלה לסגור.
  const handleQuestionAdded = useCallback(() => {
    if (!canPublish()) return;

    if (gameId) {
      dispatch(fetchGameQuestions(gameId));
    }
    setActiveOpenQuestionId(null);
    setShowPublishToast(true);
    setPublishedQuestionsCount((prev) => prev + 1);
  }, [canPublish, gameId, dispatch]);

  // נקרא מ-OpenQuestionsList/OpenQuestionModal בלחיצה על "פרסם תוצאה" -
  // מבצע בפועל PATCH /api/questions/:id/resolve בשרת עם התשובה שנבחרה.
  // קודם onPublish לא קיבל פרמטרים כלל וה-selectedAnswerId שנבחר בכרטיס
  // נזרק - הפרסום היה מרענן מקומית ומציג טוסט מזויף בלי לגעת בשרת בכלל.
  // ראו MODERATOR_AUDIT.md §1.2.
  const handlePublish = useCallback(
    async (questionId, selectedAnswerId) => {
      if (!canPublish()) return;

      try {
        await resolveQuestion(questionId, selectedAnswerId);
      } catch (err) {
        // TODO: הצגת שגיאה למשתמש - טרם הוגדר UI לשגיאת resolve
        console.log('resolveQuestion failed', err);
        return;
      }

      if (gameId) {
        dispatch(fetchGameQuestions(gameId));
      }
      setActiveOpenQuestionId(null); // סוגר את מודל השאלה הבודדת
      setShowPublishToast(true);
      setPublishedQuestionsCount((prev) => prev + 1);
    },
    [canPublish, gameId, dispatch]
  );

  // סוגר את הטוסט אוטומטית - TODO: לאשר משך זמן מדויק
  useEffect(() => {
    if (!showPublishToast) return;
    const timer = setTimeout(() => setShowPublishToast(false), 3000);
    return () => clearTimeout(timer);
  }, [showPublishToast]);

  // ---------------------------------------------------------------------
  // Render: זרימת הזמנה
  // ---------------------------------------------------------------------
  if (inviteState === null) {
    // TODO: מסך טעינה/ריק עד שמתקבל MODERATOR_INVITATION - לא הוגדר UI
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: Colors.surface.white }}
      />
    );
  }

  // [1.1] תיקון: ההשוואה עכשיו מול ENTERED (לא ENTERING) - כך שגם
  // ENTERING (spinner מעברי) וגם DIALOG וגם REJECTED מוצגים דרך
  // JoinLifecycle כראוי, ורק ENTERED פותח את הלוח הראשי.
  if (inviteState !== INVITE_STATE.ENTERED) {
    return (
      <JoinLifecycle
        state={inviteState}
        role="moderator"
        countdown={inviteData.countdown}
        inviterName={inviteData.inviterName}
        inviterImageUri={inviteData.inviterImageUri}
        onAccept={handleAccept}
        onDecline={handleReject}
      />
    );
  }

  // ---------------------------------------------------------------------
  // Render: הלוח הראשי (state === 'entered')
  // ---------------------------------------------------------------------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface.dark }}>
      {/* שכבה 1 - וידאו כרקע מלא */}
      {/* <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: Colors.surface.dark, // [[project-dark-theme-temporary]]
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 0,
        }}
      > */}
      {/* TODO: שכבת וידאו חסומה על SCRUM-174 - placeholder בלבד
        <Text style={[TextStyles.bodyMRegular, { color: Colors.surface.white }]}>
          {t('moderator.videoPending')}
        </Text> */}
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 0 }}>
        {mappedParticipantStreams.length > 0 ? (
          <StreamLayout streams={mappedParticipantStreams} />
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: Colors.surface.dark,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={[TextStyles.bodyMRegular, { color: Colors.surface.white }]}
            >
              {remoteStreamsStatus === CONNECTION_STATUS.ERROR
                ? t('moderator.videoError')
                : remoteStreamsStatus === CONNECTION_STATUS.DISCONNECTED
                  ? t('moderator.videoDisconnected')
                  : t('moderator.videoPending')}
            </Text>
          </View>
        )}
      </View>
      {/* </View> */}

      <View style={{ flex: 1, zIndex: 1 }}>
        <NewQuestionToast
          visible={newQuestionToast.visible}
          title={t('moderator.newQuestionToast.title')}
          message={t('moderator.newQuestionToast.message', {
            authorName: newQuestionToast.authorName,
            gameTitle: newQuestionToast.gameTitle,
          })}
        />

        <LiveIndicator
          isLive={streamStatus === 'ACTIVE'}
          streamTitle={streamStats.streamTitle}
          viewerCount={streamStats.viewerCount}
          giftCount={streamStats.giftCount}
          powerIcon={PowerIcon}
          // TODO: לא סגור מה הפעולה בפועל (עצירת שידור? חלק מ-A4b?) - stub זמני
          onPowerPress={() => console.log('power')}
        />

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            paddingHorizontal: Spacing.md,
            marginTop: Spacing.sm,
          }}
        >
          <SpeakerIconWrapper isMuted={isMuted} onPress={handleToggleMute} />
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              flexShrink: 1,
              marginStart: Spacing.sm,
            }}
          >
            <AvatarsRow
              players={participants.map((p) => ({
                id: p.userId,
                username: p.username,
                avatarUrl: p.avatarUrl || DEFAULT_AVATAR_URL,
              }))}
              onPlayerPress={handleAvatarPress}
            />
            <TouchableOpacity
              onPress={() => setIsPlayersModalVisible(true)}
              style={{ marginStart: Spacing.sm }}
            >
              <Text
                style={[
                  TextStyles.captionMedium,
                  { color: Colors.surface.white },
                ]}
              >
                {t('moderator.showDetails')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {!activeOpenQuestion && (
            <OpenQuestionsPillsRow
              questions={mappedOpenQuestions}
              onSelectQuestion={setActiveOpenQuestionId}
            />
          )}

          {showPublishToast && (
            <PublishResultToast
              visible={showPublishToast}
              message={t('moderator.publishSuccessToast')}
            />
          )}

          {!activeOpenQuestion && (
            <ModeratoreNav
              onSettingsPress={() =>
                console.log('settings - TODO: מסך הגדרות טרם נכתב')
              }
              onAddQuestionPress={() => setActivePanel(PANEL.ADD)}
              onOpenQuestionsPress={() => setActivePanel(PANEL.OPEN)}
              onViewerQuestionsPress={() => setActivePanel(PANEL.VIEWER)}
              openQuestionsCount={mappedOpenQuestions.length}
            />
          )}
        </View>
      </View>

      {activePanel === PANEL.ADD && (
        <AddQuestionForm
          gameId={gameId}
          onClose={() => setActivePanel(null)}
          onQuestionAdded={handleQuestionAdded}
          onNavigateToDrafts={() => setActivePanel(PANEL.DRAFT)}
          onNavigateToViewerQuestions={() => setActivePanel(PANEL.VIEWER)}
        />
      )}

      {activePanel === PANEL.DRAFT && (
        <DraftQuestionsList
          questions={mappedDraftQuestions}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === PANEL.OPEN && (
        <OpenQuestionsList
          questions={mappedOpenQuestions}
          onClose={() => setActivePanel(null)}
          onPublish={handlePublish}
        />
      )}

      {activePanel === PANEL.VIEWER && (
        <ViewerQuestionsList
          questions={viewerQuestions}
          onClose={() => setActivePanel(null)}
        />
      )}

      {isPlayerPanelVisible && selectedPlayer && (
        <PlayerProfilePanel
          player={selectedPlayer}
          onClose={handleClosePlayerPanel}
          onReport={() => console.log('report player', selectedPlayer.id)} // TODO: לחבר ל-flow דיווח אמיתי כשיהיה קיים
          onFollow={() => handleToggleFollow(selectedPlayer.id)}
          onRemoveTracking={() => handleToggleFollow(selectedPlayer.id)}
          onGoToProfile={handleGoToProfile}
        />
      )}

      {isFullProfileVisible && selectedPlayer && (
        // עטוף ב-Modal native (לא View עם absoluteFillObject) - אותו פתרון
        // בדיוק כמו PlayerProfilePanel/OpenQuestionModal/PlayersDetailModal,
        // כדי שהמסך יישב תמיד בשכבה עליונה ולחיצות יגיעו ליעד הנכון.
        <Modal
          visible
          animationType="slide"
          statusBarTranslucent
          onRequestClose={handleCloseFullProfile}
        >
          <ProfileView
            user={{
              avatarUrl: selectedPlayer.avatarUri,
              name: selectedPlayer.name,
              username: selectedPlayer.username.replace(/^@/, ''),
              bio: selectedPlayer.bio,
              inProgressCount: selectedPlayer.inProgressCount,
              followersLabel: selectedPlayer.followersCount,
              liveFeedCount: 0, // TODO: אין עדיין מקור אמיתי
            }}
            suggestedAccounts={[]} // TODO: אין עדיין מקור אמיתי לחשבונות מוצעים
            onBack={handleCloseFullProfile}
            onAddToGroup={handleOpenConnectionsList}
            onShare={() => console.log('share profile')} // TODO
            onReport={() => console.log('report profile', selectedPlayer.id)} // TODO
            onMessage={() => console.log('message')} // TODO
            onRemoveFollow={() => handleToggleFollow(selectedPlayer.id)}
            onShowAllSuggested={() => console.log('show all suggested')} // TODO
            onDismissSuggested={() => {}} // TODO
            onFollowSuggested={() => {}} // TODO
          />
        </Modal>
      )}
      {isConnectionsListVisible && selectedPlayer && (
        <ConnectionsList
          gameId={gameId}
          userId={selectedPlayer.id}
          username={selectedPlayer.username.replace(/^@/, '')}
          onBack={handleCloseConnectionsList}
        />
      )}
      <PlayersDetailModal
        visible={isPlayersModalVisible}
        players={participants.map((p) => ({
          id: p.userId,
          name: p.username,
          avatarUrl: p.avatarUrl || DEFAULT_AVATAR_URL,
          count: 0, // TODO: מקור אמיתי למונה לא ידוע
          isActive: activePlayerIds.includes(p.userId),
        }))}
        onClose={() => setIsPlayersModalVisible(false)}
        onTogglePlayer={handleTogglePlayer}
      />

      {activeOpenQuestion && (
        <OpenQuestionModal
          question={activeOpenQuestion}
          onPublish={handlePublish}
          onClose={() => setActiveOpenQuestionId(null)}
          onViewAllQuestions={() => {
            setActiveOpenQuestionId(null);
            setActivePanel(PANEL.OPEN);
          }}
        />
      )}

      {isNoPermissionModalVisible && (
        <NoPermissionToWriteModal
          onClose={() => setIsNoPermissionModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

ModeratorScreen.propTypes = {
  route: PropTypes.object, // TODO: לוודא אם gameId/streamId מגיעים גם מ-navigation params
};
