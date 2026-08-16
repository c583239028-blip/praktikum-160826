import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, Modal} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import {videoTile} from '../components/game/VideoTile'
import ModeratoreNav from '../components/game/ModeratoreNav'
// --- K3 ---
import  JoinLifecycle  from '../components/game/JoinLifecycle/index';

// --- K1 ---
import { Avatar } from '../components/game/Avatar';
import { AvatarsRow } from '../components/game/AvatarsRow'; 
import  Badge  from '../components/game/ui/Badge'; 
import  Card  from '../components/game/ui/Card';
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
  emitPromise,
} from '../services/socket.service'; 
import { resolveQuestion } from '../services/questionsApi';
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
import { Colors, Spacing, BorderRadius, TextStyles ,FontSize } from '../../constants/design';

import { SpeakerIconWrapper } from '../components/game/ui/SpeakerIconWrapper';
import { PlayersDetailModal } from '../components/game/PlayersDetailModal';
// פאנל פרופיל שחקן (bottom sheet) - נפתח בלחיצה על אווטאר ב-AvatarsRow
import { PlayerProfilePanel } from '../components/game/profile/PlayerProfilePanel'; 
// דף הפרופיל המלא - נפתח מתוך "Go to profile" בפאנל, באותו pattern
// של החלפת "מסך" פנימי כמו AddQuestionForm/DraftQuestionsList/וכו' (לא ניווט אמיתי)
import ProfileView from '../components/game/profile/ProfileView'; 
import { OpenQuestionModal } from '../components/game/questionModerator/OpenQuestionModal';
import { NoPermissionToWriteModal } from '../components/game/questionModerator/NoPermissionToWriteModal'; 
// יבוא נוסף
import { StreamLayout } from '../components/game/StreamLayout'; 
import { OpenQuestionsPillsRow } from '../components/game/questionModerator/OpenQuestionsPillsRow';

// --- טוסט "שאלה חדשה מצופה" ---
import { NewQuestionToast } from '../components/game/questionModerator/NewQuestionToast';
import {PublishResultToast} from "../components/game/questionModerator/PublishResultToast"
 import ConnectionsList from '../components/game/connections/ConnectionsList';
// TODO: participantsSlice לא מכיל avatarUrl (רק userId/username/role).
// Avatar.source ו-AvatarsRow.players[].avatarUrl הם חובה (isRequired).
// עד שיחווט מקור avatar אמיתי - placeholder קבוע. לסמן ל-Sara.
const DEFAULT_AVATAR_SOURCE = require('../../assets/images/react-logo.png'); 
const DEFAULT_AVATAR_URL = 'https://placehold.co/64x64/png?text=%20';
const INVITE_STATE = {
  DIALOG: 'dialog',
  ENTERING: 'entering',   // spinner מעברי בתוך JoinLifecycle בלבד
  ENTERED: 'entered',     // המנחה בפועל בפנים - זה מה שפותח את הלוח הראשי
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
 
  // ---------------------------------------------------------------------
  // 1. זרימת הזמנה (JoinLifecycle) - local state (הוחלט: לא Redux slice)
  // ---------------------------------------------------------------------
  const [inviteState, setInviteState] = useState(null); // null = טרם התקבלה הזמנה מהשרת
const [inviteData, setInviteData] = useState({
  gameId: null,
  streamId: null,
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
 
  // סוגר את טוסט "שאלה חדשה" אוטומטית - TODO: לאשר משך זמן מדויק (לפי showPublishToast - 3 שניות)
  useEffect(() => {
    if (!newQuestionToast.visible) return;
    const timer = setTimeout(
      () => setNewQuestionToast((prev) => ({ ...prev, visible: false })),
      3000
    );
    return () => clearTimeout(timer);
  }, [newQuestionToast.visible]);
 
const handleAccept = useCallback(async () => {
  setInviteState(INVITE_STATE.ENTERING); // מציג spinner בזמן ההמתנה לתשובת שרת
  try {
    await emitPromise(SOCKET_EVENTS.GAME.ACCEPT_MODERATOR, {
      gameId: inviteData.gameId,
    });
    setInviteState(INVITE_STATE.ENTERED); // רק עכשיו נכנסים בפועל ללוח הראשי

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
// ה-onModeratorInvitation שמקבל מהשרת - נשאר אותו דבר אבל עכשיו fires מ-null, לא מ-'entering'
setInviteState(INVITE_STATE.DIALOG);
  const handleReject = useCallback(async () => {
    try {
      await emitPromise(SOCKET_EVENTS.GAME.REJECT_MODERATOR, {
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
  const participants = useSelector((s) => s.participants.list);
  // TODO: gameStream.activeProducers ישמש לסינון מי משדר וידאו בפועל -
  // רלוונטי אחרי SCRUM-185, לא בשימוש כרגע.
  // const activeProducers = useSelector((s) => s.gameStream.activeProducers);
 
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
 
  // TODO: קריטריון אמיתי לצבע כפתור ה-+ טרם אושר - כרגע placeholder לוקלי
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
 const [isConnectionsListVisible, setIsConnectionsListVisible] = useState(false);

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
  const [isNoPermissionModalVisible, setIsNoPermissionModalVisible] = useState(false);
  // TODO: לאשר אם ה-badge סופר "פרסומים" או "שאלות פתוחות ממתינות" בפועל
  const draftQuestions = useSelector(selectDraftQuestions);
  const openQuestions = useSelector(selectOpenQuestions);
  // activeQuestion זמין דרך useSelector((s) => s.questions.activeQuestion)
  // אם יידרש בעתיד להצגה נפרדת - כרגע מוצג כחלק מ-openQuestions (AC4).
 
  // Pull חד-פעמי בכניסה למסך (לפי החלטת ראש הצוות: "dispatch אחד בטעינה").
  // עדכונים בזמן אמת (NEW_QUESTION/QUESTION_RESOLVED) כבר מטופלים בתוך
  // ה-slice עצמו דרך socketMiddleware הקיים - אין כאן listener נוסף.
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
 
  const activeOpenQuestion = mappedOpenQuestions.find((q) => q.id === activeOpenQuestionId) ?? null;
  // TODO: מקור נפרד לשאלות מהצופים (ViewerQuestionsList) - אין selector כזה
  // ב-questionsSlice החדש (selectDraftQuestions/selectOpenQuestions/
  // selectResolvedQuestions בלבד). לא ברור אם זה אותו slice עם שדה מבדיל
  // נוסף, או ערוץ/endpoint נפרד לגמרי. לא לבנות בלי אישור - כרגע מערך ריק.
  const viewerQuestions = [];
// לפני ה-return, בניית ה-streams מתוך participants
const mappedParticipantStreams = participants.map((p) => ({
  stream: null, // TODO: SCRUM-174 - עדיין חסום? זה בדיוק מה שנפתח עכשיו או לא?
  label: p.username,
  isMicOn: true, // TODO: אין מקור אמיתי ל-mic state per-participant (isMuted הקיים הוא רק של המנחה)
  isCameraOff: true, // TODO: אין מקור אמיתי - stub זמני עד שיהיה video track אמיתי
  profileUrl: DEFAULT_AVATAR_URL, // TODO: כבר מסומן למעלה בקובץ - אין avatarUrl אמיתי ב-participantsSlice
  isSelected: false, // TODO: אין מושג "משתתף נבחר/מודגש" ב-state הנוכחי
  giftCount: 0, // TODO: streamStats.giftCount הוא כללי לשידור, לא per-participant
}));
 const canPublish = useCallback(() => {
  if ((streamStats.viewerCount ?? 0) < MIN_VIEWERS_TO_PUBLISH) {
    setIsNoPermissionModalVisible(true);
    return false;
  }
  return true;
}, [streamStats.viewerCount]);

// נקרא מ-AddQuestionForm כששאלה חדשה נוצרה - אין כאן resolve, רק רענון+טוסט
const handleQuestionAdded = useCallback(() => {
  if (!canPublish()) return;
  if (gameId) dispatch(fetchGameQuestions(gameId));
  setActiveOpenQuestionId(null);
  setShowPublishToast(true);
  setPublishedQuestionsCount((prev) => prev + 1);
}, [canPublish, gameId, dispatch]);

// נקרא מ-OpenQuestionsList/OpenQuestionModal בפרסום תוצאה בפועל -
// מבצע PATCH לשרת (היה חסר לגמרי - סעיף 1.2 באודיט)
const handlePublish = useCallback(async (questionId, selectedAnswerId) => {
  if (!canPublish()) return;

  try {
    await resolveQuestion(questionId, selectedAnswerId);
  } catch (err) {
    // TODO: הצגת שגיאה למשתמש - טרם הוגדר UI לשגיאת resolve
    console.log('resolveQuestion failed', err);
    return;
  }

  if (gameId) dispatch(fetchGameQuestions(gameId));
  setActiveOpenQuestionId(null);
  setShowPublishToast(true);
  setPublishedQuestionsCount((prev) => prev + 1);
}, [canPublish, gameId, dispatch]);

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
  return <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface.white }} />;
}

if (inviteState !== INVITE_STATE.ENTERED) {
  return (
    <JoinLifecycle
      state={inviteState}      // עכשיו יכול להיות בפועל 'dialog'/'entering'/'rejected'
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
  // Render: הלוח הראשי (state === 'entering')
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
        {/* שכבה 1 - וידאו המשתתפים (היה placeholder טקסט בלבד) */}
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
      <Text style={[TextStyles.bodyMRegular, { color: Colors.surface.white }]}>
        {t('videoPending')}
      </Text>
    </View>
  )}
</View>
      {/* </View> */}
 
      {/* שכבה 2 - כל ה-UI כ-overlay מעל הוידאו */}
      <View style={{ flex: 1, zIndex: 1 }}>
        {/* טוסט "שאלה חדשה מצופה" - position: absolute בתוך הקומפוננטה עצמה */}
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
              avatarUrl: DEFAULT_AVATAR_URL,
            }))}
            onPlayerPress={handleAvatarPress}
          />
          <TouchableOpacity
            onPress={() => setIsPlayersModalVisible(true)}
            style={{ marginStart: Spacing.sm }}
          >
            <Text style={[TextStyles.captionMedium, { color: Colors.surface.white }]}>
              {t('moderator.showDetails')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
 
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* שורת שאלות פתוחות (pills) - צמוד לתחתית, מעל ה-Nav, לפי 022 */}
          {!activeOpenQuestion && (
            <OpenQuestionsPillsRow
              questions={mappedOpenQuestions}
              onSelectQuestion={setActiveOpenQuestionId}
            />
          )}
 
          {/* טוסט הצלחה אחרי פרסום - לפי 704 */}
          {showPublishToast && (
            <PublishResultToast visible={showPublishToast} message={t('moderator.publishSuccessToast')} />
          )}
 
          {!activeOpenQuestion && (
<ModeratoreNav
      onSettingsPress={() => console.log('settings - TODO: מסך הגדרות טרם נכתב')}
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
          avatarUrl: DEFAULT_AVATAR_URL,
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