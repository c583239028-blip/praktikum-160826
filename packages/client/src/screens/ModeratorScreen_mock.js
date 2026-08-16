import { SOCKET_EVENTS } from '@worldplay/shared';
import React, { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { getAppSocket } from '../services/socket.service';
import { InvitationDialog } from '../components/game/JoinLifecycle/InvitationDialog';
import { EnteringScreen } from '../components/game/JoinLifecycle/EnteringScreen';
import { RejectedInvitation } from '../components/game/JoinLifecycle/RejectedInvitation';
import WatchersList from '../components/game/watchers/WatchersList';
import { WATCHER_TABS } from '../components/game/watchers/WatchersTab';
import { AddQuestionForm } from '../components/game/questionModerator/AddQuestionForm';
import { ViewerQuestionsList } from '../components/game/questionModerator/ViewerQuestionsList';
import { DraftQuestionsList } from '../components/game/questionModerator/DraftQuestionsList';
import { OpenQuestionsList } from '../components/game/questionModerator/OpenQuestionsList';
import { JoinLifecycle } from '../components/game/JoinLifecycle/index';
// import WatchersList, { WATCHER_TABS } from '../components/game/JoinLifecycle/WatchersList';
export default function ModeratorScreen({
  gameId = 'd0907a52-8804-4abd-8794-f4848aee53c4',
  onClose,
  onAccepted,
}) {
  const [invitation, setInvitation] = useState(null);
  const [invitationResult, setInvitationResult] = useState(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false); // ← ADD
  const [showListQuestion, setShowListQuestion] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [showWatcherQuestion, setShowWatcherQuestion] = useState(false);
  const [showDraftQuestions, setShowDraftQuestions] = useState(false);
  const [showOpenQuestions, setShowOpenQuestions] = useState(false);
  const [draftQuestions, setDraftQuestions] = useState([]);
  const [openQuestions, setOpenQuestions] = useState([]);

  useEffect(() => {
    setDraftQuestions([
      {
        id: 'd1',
        authorName: 'Danny Senior',
        text: "How lucky do you think the black player was to have that 'double' at exactly the right moment?",
        answers: [
          { id: 'a1', text: 'First answer' },
          { id: 'a2', text: 'Second answer' },
          { id: 'a3', text: 'Third answer' },
          { id: 'a4', text: 'Fourth answer' },
        ],
      },
      {
        id: 'd2',
        authorName: 'Yossi Cohen',
        text: 'What is the biggest mistake so far in this game?',
        answers: [
          { id: 'a1', text: 'First answer' },
          { id: 'a2', text: 'Second answer' },
        ],
      },
    ]);

    setOpenQuestions([
      {
        id: 'o1',
        text: 'What has been the biggest mistake so far?',
        participantsCount: 250,
        time: '14:19',
        answers: [
          { id: 'a1', text: 'First answer' },
          { id: 'a2', text: 'Second answer' },
          { id: 'a3', text: 'Third answer' },
          { id: 'a4', text: 'Fourth answer' },
        ],
      },
      {
        id: 'o2',
        text: 'What has been the biggest mistake so far?',
        participantsCount: 250,
        time: '14:19',
        answers: [
          { id: 'a1', text: 'First answer' },
          { id: 'a2', text: 'Second answer' },
          { id: 'a3', text: 'Third answer' },
        ],
      },
      {
        id: 'o3',
        text: 'What has been the biggest mistake so far?',
        participantsCount: 250,
        time: '14:19',
        answers: [
          { id: 'a1', text: 'First answer' },
          { id: 'a2', text: 'Second answer' },
        ],
      },
    ]);
  }, []);
  useEffect(() => {
    setActiveQuestions([
      {
        id: '1',
        authorName: 'יוסי כהן',
        text: 'מה ההבדל בין React Native ל-Flutter?',
      },
      {
        id: '2',
        authorName: 'שרה לוי',
        text: 'האם אפשר להשתמש ב-hooks בתוך class components?',
      },
      {
        id: '3',
        authorName: 'דוד מזרחי',
        text: 'מה עדיף: Redux או Context API לניהול state גלובלי?',
      },
    ]);
  }, []);
  useEffect(() => {
    const socket = getAppSocket();
    if (!socket) return;
    const handleInvitation = (payload) => setInvitation(payload);
    socket.on(SOCKET_EVENTS.GAME.MODERATOR_INVITATION, handleInvitation);
    return () =>
      socket.off(SOCKET_EVENTS.GAME.MODERATOR_INVITATION, handleInvitation);
  }, []);

  const handleAcceptInvitation = useCallback(() => {
    const socket = getAppSocket();
    if (socket && invitation) {
      socket.emit(
        SOCKET_EVENTS.GAME.ACCEPT_MODERATOR,
        { gameId: invitation.gameId },
        (response) => {
          if (response?.error)
            console.error('[ModeratorScreen] accept error:', response.error);
        }
      );
    }
    setInvitation(null);
    setInvitationResult('accepted');
    onAccepted?.();
  }, [invitation, onAccepted]);

  const handleRejectInvitation = useCallback(() => {
    const socket = getAppSocket();
    if (socket && invitation) {
      socket.emit(
        SOCKET_EVENTS.GAME.REJECT_MODERATOR,
        { gameId: invitation.gameId },
        (response) => {
          if (response?.error)
            console.error('[ModeratorScreen] reject error:', response.error);
        }
      );
    }
    setInvitation(null);
    setInvitationResult('rejected');
  }, [invitation]);

  if (invitationResult === 'accepted') return <EnteringScreen />;
  if (invitationResult === 'rejected')
    return (
      <RejectedInvitation role="moderator" onClose={setInvitation(null)} />
    );

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {__DEV__ && !invitation && (
        <TouchableOpacity
          style={{ padding: 16, backgroundColor: '#eee', borderRadius: 8 }}
          onPress={() =>
            setInvitation({
              gameId: 'test-game-id',
              invitationId: 'inv_test',
              hostName: 'יוסי המארח',
              gameTitle: 'משחק טסט',
            })
          }
        >
          <Text>DEV: הדמה הזמנה</Text>
        </TouchableOpacity>
      )}

      {invitation && (
        <InvitationDialog
          hostName={invitation.hostName}
          hostImageUri={invitation.hostImageUri}
          role="moderator"
          onAccept={handleAcceptInvitation}
          onReject={handleRejectInvitation}
        />
      )}

      {/* ── Add Question Button ── */}
      <TouchableOpacity
        style={{
          marginTop: 24,
          paddingVertical: 12,
          paddingHorizontal: 32,
          backgroundColor: '#00CFFF',
          borderRadius: 9999,
        }}
        onPress={() => setShowAddQuestion(true)}
      >
        <Text
          style={{
            fontFamily: 'Rubik',
            fontWeight: '700',
            fontSize: 14,
            color: '#000',
          }}
        >
          + Add Question
        </Text>
      </TouchableOpacity>

      {/* ── Add Question Modal ── */}
      {showAddQuestion && (
        <AddQuestionForm
          gameId={gameId}
          onClose={() => setShowAddQuestion(false)}
          onQuestionAdded={() => setShowAddQuestion(false)}
          onNavigateToDrafts={() => {
            setShowAddQuestion(false);
            setShowDraftQuestions(true);
          }}
          onNavigateToViewerQuestions={() => {
            setShowAddQuestion(false);
            setShowListQuestion(true);
          }}
        />
      )}
      {/* ──  Question List ── */}
      <TouchableOpacity
        style={{
          marginTop: 24,
          paddingVertical: 12,
          paddingHorizontal: 32,
          backgroundColor: '#00CFFF',
          borderRadius: 9999,
        }}
        onPress={() => setShowListQuestion(true)}
      >
        <Text
          style={{
            fontFamily: 'Rubik',
            fontWeight: '700',
            fontSize: 14,
            color: '#000',
          }}
        >
          List Question
        </Text>
      </TouchableOpacity>
      {/* ── List Question Modal ── */}
      {showListQuestion && (
        <ViewerQuestionsList
          gameId={gameId}
          questions={activeQuestions}
          onClose={() => setShowListQuestion(false)}
          onQuestionAdded={() => setShowListQuestion(false)}
        />
      )}

      {/* ──  Watcher List ── */}
      <TouchableOpacity
        style={{
          marginTop: 24,
          paddingVertical: 12,
          paddingHorizontal: 32,
          backgroundColor: '#00CFFF',
          borderRadius: 9999,
        }}
        onPress={() => setShowWatcherQuestion(true)}
      >
        <Text
          style={{
            fontFamily: 'Rubik',
            fontWeight: '700',
            fontSize: 14,
            color: '#000',
          }}
        >
          List Watcher
        </Text>
      </TouchableOpacity>
      {/* ── List Watcher Modal ── */}
      {showWatcherQuestion && (
        <WatchersList
          gameId={gameId}
          onBack={() => setShowWatcherQuestion(false)}
          initialTab={WATCHER_TABS.IN_PROGRESS}
        />
      )}
      {/* ── Draft Questions Button ── */}
      <TouchableOpacity
        style={{
          marginTop: 24,
          paddingVertical: 12,
          paddingHorizontal: 32,
          backgroundColor: '#00CFFF',
          borderRadius: 9999,
        }}
        onPress={() => setShowDraftQuestions(true)}
      >
        <Text
          style={{
            fontFamily: 'Rubik',
            fontWeight: '700',
            fontSize: 14,
            color: '#000',
          }}
        >
          Draft Questions
        </Text>
      </TouchableOpacity>

      {/* ── Draft Questions Modal ── */}
      {showDraftQuestions && (
        <DraftQuestionsList
          questions={draftQuestions}
          onClose={() => setShowDraftQuestions(false)}
        />
      )}
      {/* ── Open Questions Button ── */}
      <TouchableOpacity
        style={{
          marginTop: 24,
          paddingVertical: 12,
          paddingHorizontal: 32,
          backgroundColor: '#00CFFF',
          borderRadius: 9999,
        }}
        onPress={() => setShowOpenQuestions(true)}
      >
        <Text
          style={{
            fontFamily: 'Rubik',
            fontWeight: '700',
            fontSize: 14,
            color: '#000',
          }}
        >
          Open Questions
        </Text>
      </TouchableOpacity>

      {/* ── Open Questions Modal ── */}
      {showOpenQuestions && (
        <OpenQuestionsList
          questions={openQuestions}
          onClose={() => setShowOpenQuestions(false)}
          onPublish={(questionId, selectedAnswerId) =>
            console.log('published:', questionId, selectedAnswerId)
          }
        />
      )}
    </View>
  );
}
