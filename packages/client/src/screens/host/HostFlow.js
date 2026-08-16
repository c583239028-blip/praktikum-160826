import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useHostBroadcast } from '../../hooks/useHostBroadcast';
import { useCreateGame } from '../../hooks/useCreateGame';
import { LiveBroadcastScreen } from './live/LiveBroadcastScreen';
import { SelectGameTypeStep } from './steps/SelectGameTypeStep';
import { GameNameStep } from './steps/GameNameStep';
import { InviteModeratorStep } from './steps/InviteModeratorStep';
import { PlayerInvitationStep } from './steps/PlayerInvitationStep';
import { ShareBroadcastStep } from './steps/ShareBroadcastStep';
import { ShareBroadcastDoneStep } from './steps/ShareBroadcastDoneStep';
import { GameSummaryStep } from './steps/GameSummaryStep';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import LazyAuthModal from '../../components/LazyAuthModal';

// ⭐ Host container — a state machine, not UI. One component stays mounted across
// every wizard step (so the broadcast refs/media survive), the draft lives here
// in local state, and it only reaches redux at go-live (via useCreateGame).
const STEPS = {
  TYPE: 'TYPE',
  NAME: 'NAME',
  MODERATOR: 'MODERATOR',
  PLAYERS: 'PLAYERS',
  SHARE1: 'SHARE1',
  SHARE2: 'SHARE2',
  SUMMARY: 'SUMMARY',
  LIVE: 'LIVE',
};
const WIZARD_ORDER = [
  STEPS.TYPE,
  STEPS.NAME,
  STEPS.MODERATOR,
  STEPS.PLAYERS,
  STEPS.SHARE1,
  STEPS.SHARE2,
  STEPS.SUMMARY,
];

export function HostFlow() {
  // Re-entering with a live session already in the store (e.g. game_screen's
  // role-based routing after joining) jumps straight to LIVE; a fresh entry
  // (/host) starts the wizard at step 0.
  const { gameId, streamId } = useSelector((s) => s.gameStream);
  const [step, setStep] = useState(
    gameId && streamId ? STEPS.LIVE : STEPS.TYPE
  );

  // Draft — local only, NOT redux (per the brief). No `description`. Moderator
  // and players are demo-only for now (self-contained in their steps), so they
  // don't feed the draft; real ids return with the users API.
  const [title, setTitle] = useState('');
  const [gameType, setGameType] = useState('CLOSE_UP');
  // Demo selections — display-only on the summary; NOT sent to the server (mock
  // ids). Lifted here so the summary screen can show host + players.
  const [moderator, setModerator] = useState(null);
  const [players, setPlayers] = useState([]);

  const { createGame, creating, createError } = useCreateGame();
  const broadcast = useHostBroadcast();
  // Auth gate: going live requires a logged-in user. If the user is a guest,
  // guardedAction opens the login modal and re-runs goLive after login (instead
  // of failing mid-flow with "Session expired").
  const { guardedAction, isModalVisible, closeAuthModal } = useAuthGuard();

  // Cleanup on unmount / navigation away — the container owns the lifecycle for
  // the whole host flow (releases camera + marks the game finished).
  useEffect(() => {
    return () => {
      broadcast.endAndCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goForward = () => {
    const i = WIZARD_ORDER.indexOf(step);
    if (i >= 0 && i < WIZARD_ORDER.length - 1) setStep(WIZARD_ORDER[i + 1]);
  };
  const goBack = () => {
    const i = WIZARD_ORDER.indexOf(step);
    if (i > 0) setStep(WIZARD_ORDER[i - 1]);
  };

  // SUMMARY → LIVE only via a successful create (which seeds gameId/streamId in
  // the store). No transition to LIVE otherwise.
  const goLive = async () => {
    const ok = await createGame({ title, gameType });
    if (ok) setStep(STEPS.LIVE);
  };

  // Progress-dot position. Dot count = the in-scope step count. The Figma frame
  // shows more dots (out-of-scope screens) — confirm with Sara if she wants to
  // mirror that exact count (one-line change).
  const total = WIZARD_ORDER.length;
  const current = WIZARD_ORDER.indexOf(step);

  if (step === STEPS.LIVE) {
    return <LiveBroadcastScreen title={title} {...broadcast} />;
  }

  if (step === STEPS.TYPE) {
    return (
      <SelectGameTypeStep
        value={gameType}
        onChange={setGameType}
        onNext={goForward}
        total={total}
        current={current}
      />
    );
  }

  if (step === STEPS.NAME) {
    return (
      <GameNameStep
        value={title}
        onChange={setTitle}
        onNext={goForward}
        onBack={goBack}
        total={total}
        current={current}
      />
    );
  }

  if (step === STEPS.MODERATOR) {
    return (
      <InviteModeratorStep
        value={moderator}
        onChange={setModerator}
        onNext={goForward}
        onBack={goBack}
        total={total}
        current={current}
      />
    );
  }

  if (step === STEPS.PLAYERS) {
    return (
      <PlayerInvitationStep
        value={players}
        onChange={setPlayers}
        onNext={goForward}
        onBack={goBack}
        total={total}
        current={current}
      />
    );
  }

  if (step === STEPS.SHARE1) {
    return (
      <ShareBroadcastStep
        onNext={goForward}
        onBack={goBack}
        total={total}
        current={current}
      />
    );
  }

  if (step === STEPS.SHARE2) {
    return (
      <ShareBroadcastDoneStep
        onNext={goForward}
        onBack={goBack}
        total={total}
        current={current}
      />
    );
  }

  if (step === STEPS.SUMMARY) {
    return (
      <>
        <GameSummaryStep
          title={title}
          gameType={gameType}
          moderator={moderator}
          players={players}
          onGoLive={() => guardedAction(goLive)}
          onBack={goBack}
          loading={creating}
          error={createError}
          total={total}
          current={current}
        />
        <LazyAuthModal visible={isModalVisible} onClose={closeAuthModal} />
      </>
    );
  }

  return null;
}
