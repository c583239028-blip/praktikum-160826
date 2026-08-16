// moderatorInvitations is a single module-scope Map shared across all
// sockets (see game.handler.js history / SCRUM-234 fix). Cross-socket
// tests below explicitly use two separate mock sockets to prove the
// invitation is visible across connections, not just within one.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const {
  mockGameFindUnique,
  mockUserFindUnique,
  mockParticipantFindUnique,
  mockParticipantCreate,
} = vi.hoisted(() => ({
  mockGameFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockParticipantFindUnique: vi.fn(),
  mockParticipantCreate: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    game: { findUnique: mockGameFindUnique },
    user: { findUnique: mockUserFindUnique },
    gameParticipant: {
      findUnique: mockParticipantFindUnique,
      create: mockParticipantCreate,
    },
  },
}));

vi.mock('@worldplay/shared', async (importOriginal) => ({
  ...(await importOriginal()),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    socketJoin: vi.fn(),
  },
}));

const { mockGetViewerCount } = vi.hoisted(() => ({
  mockGetViewerCount: vi.fn(),
}));

vi.mock('../services/stream.service.js', () => ({
  default: { getViewerCount: mockGetViewerCount },
}));

import { registerModeratorInvitationHandlers } from '../sockets/moderatorInvitation.handler.js';
import {
  ERROR_MESSAGES,
  MIN_VIEWERS_FOR_MODERATOR,
  INSUFFICIENT_VIEWERS_CODE,
  MODERATOR_RESPONSE_STATUS,
  MODERATOR_RESPONSE_REASON,
  SOCKET_EVENTS,
} from '@worldplay/shared';
import { UserRole } from '@prisma/client';

// ─────────────────────────────────────────────
// עזרי בדיקה
// ─────────────────────────────────────────────

function createMockSocket(id, userId) {
  const handlers = {};
  return {
    id,
    user: { id: userId, username: `user-${userId}` },
    handlers,
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
    join: vi.fn(),
    emit: vi.fn(),
  };
}

// מקבל מערך sockets כדי לתמוך בתרחישי cross-socket (host + מנחה
// בו-זמנית באותו io instance, בדיוק כמו ב-server אמיתי).
function createMockIo(sockets) {
  const socketsMap = new Map(sockets.map((s) => [s.id, s]));
  return {
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    sockets: { sockets: socketsMap },
  };
}

// ─────────────────────────────────────────────
// טסטים
// ─────────────────────────────────────────────

describe('moderatorInvitation.handler', () => {
  const gameId = 'game-1';
  const streamId = 'stream-1';

  beforeEach(() => {
    vi.useFakeTimers();
    mockGameFindUnique.mockReset();
    mockUserFindUnique.mockReset();
    mockParticipantFindUnique.mockReset();
    mockParticipantCreate.mockReset();
    mockGetViewerCount.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // INVITE_MODERATOR
  // ═══════════════════════════════════════════
  describe('INVITE_MODERATOR', () => {
    let io, hostSocket, modSocket;

    beforeEach(() => {
      hostSocket = createMockSocket('host-socket', 'host-1');
      modSocket = createMockSocket('mod-socket', 'mod-1');
      io = createMockIo([hostSocket, modSocket]);
      registerModeratorInvitationHandlers(io, hostSocket);
      registerModeratorInvitationHandlers(io, modSocket);
    });

    it('מחזירה GAME_NOT_FOUND אם המשחק לא קיים', async () => {
      mockGameFindUnique.mockResolvedValueOnce(null);
      const cb = vi.fn();

      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: 'mod-1' },
        cb
      );

      expect(cb).toHaveBeenCalledWith({ error: ERROR_MESSAGES.GAME_NOT_FOUND });
    });

    it('דוחה הזמנה ממי שאינו ה-host', async () => {
      mockGameFindUnique.mockResolvedValueOnce({
        hostId: 'someone-else',
        status: 'WAITING',
      });
      const cb = vi.fn();

      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: 'mod-1' },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.HOST_ONLY_CAN_INVITE_MODERATOR,
      });
    });

    it('דוחה הזמנה כשהמשחק אינו במצב WAITING', async () => {
      mockGameFindUnique.mockResolvedValueOnce({
        hostId: 'host-1',
        status: 'ACTIVE',
      });
      const cb = vi.fn();

      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: 'mod-1' },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.CAN_ONLY_INVITE_MODERATOR_WHEN_WAITING,
      });
    });

    it('מחזירה MODERATOR_NOT_FOUND אם משתמש היעד לא קיים', async () => {
      mockGameFindUnique.mockResolvedValueOnce({
        hostId: 'host-1',
        status: 'WAITING',
      });
      mockUserFindUnique.mockResolvedValueOnce(null);
      const cb = vi.fn();

      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: 'mod-1' },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.MODERATOR_NOT_FOUND,
      });
    });

    it('מחזירה MODERATOR_ALREADY_IN_GAME אם המנחה כבר participant', async () => {
      mockGameFindUnique.mockResolvedValueOnce({
        hostId: 'host-1',
        status: 'WAITING',
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'mod-1',
        username: 'mod-1',
      });
      mockParticipantFindUnique.mockResolvedValueOnce({ id: 'existing' });
      const cb = vi.fn();

      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: 'mod-1' },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.MODERATOR_ALREADY_IN_GAME,
      });
    });

    it('מחזירה MODERATOR_NOT_CONNECTED אם אין socket פעיל למנחה, ולא משאירה הזמנה תלויה', async () => {
      // io בלי modSocket — מדמה מנחה שאינו מחובר כרגע
      const ioNoMod = createMockIo([hostSocket]);
      registerModeratorInvitationHandlers(ioNoMod, hostSocket);

      mockGameFindUnique.mockResolvedValueOnce({
        hostId: 'host-1',
        status: 'WAITING',
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'mod-1',
        username: 'mod-1',
      });
      mockParticipantFindUnique.mockResolvedValueOnce(null);
      const cb = vi.fn();

      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: 'mod-1' },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.MODERATOR_NOT_CONNECTED,
      });

      // מוודאים שההזמנה לא נשארה תלויה במפה המשותפת: ACCEPT על אותה
      // gameId אמור להיכשל עם "לא נמצאה", לא להצליח בטעות.
      const acceptCb = vi.fn();
      await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
        { gameId },
        acceptCb
      );
      expect(acceptCb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.INVITATION_NOT_FOUND_OR_EXPIRED,
      });
    });

    it('מצליחה: יוצרת הזמנה ושולחת MODERATOR_INVITATION לסוקט של המנחה', async () => {
      mockGameFindUnique.mockResolvedValueOnce({
        hostId: 'host-1',
        status: 'WAITING',
        title: 'Trivia Night',
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'mod-1',
        username: 'mod-1',
      });
      mockParticipantFindUnique.mockResolvedValueOnce(null);
      const cb = vi.fn();

      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: 'mod-1' },
        cb
      );

      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          invitationId: expect.any(String),
        })
      );
      expect(modSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.GAME.MODERATOR_INVITATION,
        expect.objectContaining({ gameId, hostId: 'host-1' })
      );
    });

    it('הזמנה כפולה לאותו gameId מבטלת את ה-timeout הישן (race condition fix)', async () => {
      // הזמנה ראשונה ב-t=0, deadline=60000
      mockGameFindUnique.mockResolvedValueOnce({
        hostId: 'host-1',
        status: 'WAITING',
        title: 'Trivia Night',
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'mod-1',
        username: 'mod-1',
      });
      mockParticipantFindUnique.mockResolvedValueOnce(null);
      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: 'mod-1' },
        vi.fn()
      );

      // פער זמן לפני ההזמנה השנייה — הכרחי כדי שלטיימר הישן יהיה
      // deadline שונה מהחדש, אחרת אי אפשר להוכיח שהוא בוטל בפועל.
      vi.advanceTimersByTime(10000); // t=10000

      // הזמנה שנייה ב-t=10000, deadline=70000
      mockGameFindUnique.mockResolvedValueOnce({
        hostId: 'host-1',
        status: 'WAITING',
        title: 'Trivia Night',
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'mod-1',
        username: 'mod-1',
      });
      mockParticipantFindUnique.mockResolvedValueOnce(null);
      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: 'mod-1' },
        vi.fn()
      );

      // מתקדמים ל-t=65000: אחרי ה-deadline הישן (60000), אך לפני
      // ה-deadline החדש (70000). אם הטיימר הישן לא בוטל — הוא ימחק את
      // ההזמנה עכשיו, למרות שההזמנה השנייה עדיין בתוקף חוקי.
      vi.advanceTimersByTime(55000); // t=65000

      mockGameFindUnique.mockResolvedValueOnce({ streamId });
      mockGetViewerCount.mockResolvedValueOnce(50);
      mockParticipantCreate.mockResolvedValueOnce({
        id: 'p1',
        role: UserRole.MODERATOR,
      });

      const acceptCb = vi.fn();
      await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
        { gameId },
        acceptCb
      );

      expect(acceptCb).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  // ═══════════════════════════════════════════
  // ACCEPT_MODERATOR
  // ═══════════════════════════════════════════
  describe('ACCEPT_MODERATOR', () => {
    let io, hostSocket, modSocket;

    async function setupInvitation() {
      mockGameFindUnique.mockResolvedValueOnce({
        hostId: hostSocket.user.id,
        status: 'WAITING',
        title: 'Trivia Night',
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: modSocket.user.id,
        username: modSocket.user.username,
      });
      mockParticipantFindUnique.mockResolvedValueOnce(null);

      const inviteCb = vi.fn();
      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: modSocket.user.id },
        inviteCb
      );
      return inviteCb;
    }

    beforeEach(() => {
      hostSocket = createMockSocket('host-socket', 'host-1');
      modSocket = createMockSocket('mod-socket', 'mod-1');
      io = createMockIo([hostSocket, modSocket]);
      registerModeratorInvitationHandlers(io, hostSocket);
      registerModeratorInvitationHandlers(io, modSocket);
    });

    it('מחזירה INVITATION_NOT_FOUND_OR_EXPIRED כשאין הזמנה כלל', async () => {
      const cb = vi.fn();
      await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
        { gameId },
        cb
      );
      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.INVITATION_NOT_FOUND_OR_EXPIRED,
      });
    });

    it('מחזירה INVITATION_NOT_FOR_YOU כשמנחה אחר מנסה לאשר', async () => {
      await setupInvitation();
      const intruderSocket = createMockSocket('intruder-socket', 'intruder-1');
      registerModeratorInvitationHandlers(io, intruderSocket);

      const cb = vi.fn();
      await intruderSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
        { gameId },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.INVITATION_NOT_FOR_YOU,
      });
    });

    describe('שער מספר צופים מינימלי (C5a)', () => {
      it('חוסמת הצטרפות ומחזירה שגיאה מובנית כשיש פחות מהסף הנדרש, ולא יוצרת participant', async () => {
        await setupInvitation();
        mockGameFindUnique.mockResolvedValueOnce({ streamId });
        mockGetViewerCount.mockResolvedValue(30);

        const acceptCb = vi.fn();
        await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
          { gameId },
          acceptCb
        );

        expect(mockGetViewerCount).toHaveBeenCalledWith(streamId);
        expect(acceptCb).toHaveBeenCalledWith({
          error: ERROR_MESSAGES.INSUFFICIENT_VIEWERS_FOR_MODERATOR,
          code: INSUFFICIENT_VIEWERS_CODE,
          current: 30,
          required: MIN_VIEWERS_FOR_MODERATOR,
        });
        expect(mockParticipantCreate).not.toHaveBeenCalled();
      });

      it('לא מוחקת את ההזמנה כשנחסמת עקב מיעוט צופים — ניתן לנסות שוב', async () => {
        await setupInvitation();
        mockGameFindUnique.mockResolvedValueOnce({ streamId });
        mockGetViewerCount.mockResolvedValue(10);
        await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
          { gameId },
          vi.fn()
        );

        mockGameFindUnique.mockResolvedValueOnce({ streamId });
        mockGetViewerCount.mockResolvedValue(60);
        const secondCb = vi.fn();
        await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
          { gameId },
          secondCb
        );

        expect(secondCb).toHaveBeenCalledWith(
          expect.objectContaining({ success: true })
        );
      });

      it('מאשרת הצטרפות ויוצרת participant עם role MODERATOR כשיש מספיק צופים', async () => {
        await setupInvitation();
        mockGameFindUnique.mockResolvedValueOnce({ streamId });
        mockGetViewerCount.mockResolvedValue(50);
        mockParticipantCreate.mockResolvedValue({
          id: 'participant-1',
          gameId,
          userId: modSocket.user.id,
          role: UserRole.MODERATOR,
        });

        const acceptCb = vi.fn();
        await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
          { gameId },
          acceptCb
        );

        expect(mockParticipantCreate).toHaveBeenCalledWith({
          data: {
            gameId,
            userId: modSocket.user.id,
            role: UserRole.MODERATOR,
            score: 0,
          },
        });
        expect(acceptCb).toHaveBeenCalledWith(
          expect.objectContaining({ success: true })
        );
      });

      it('מחזירה GAME_NOT_FOUND אם המשחק נמחק בין ההזמנה לאישור, ולא קוראת ל-getViewerCount', async () => {
        await setupInvitation();
        mockGameFindUnique.mockResolvedValueOnce(null);

        const acceptCb = vi.fn();
        await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
          { gameId },
          acceptCb
        );

        expect(mockGetViewerCount).not.toHaveBeenCalled();
        expect(acceptCb).toHaveBeenCalledWith({
          error: ERROR_MESSAGES.GAME_NOT_FOUND,
        });
      });
    });

    it('AC2 — cross-socket: host מזמינה, מנחה על socket נפרד לגמרי מאשרת בהצלחה', async () => {
      // host ומנחה נרשמים על sockets שונים לגמרי מההתחלה — זה בדיוק
      // התרחיש שהיה שבור לפני שהמעבר ל-module scope תוקן.
      await setupInvitation();

      mockGameFindUnique.mockResolvedValueOnce({ streamId });
      mockGetViewerCount.mockResolvedValueOnce(50);
      mockParticipantCreate.mockResolvedValueOnce({
        id: 'participant-1',
        role: UserRole.MODERATOR,
      });

      const acceptCb = vi.fn();
      await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
        { gameId },
        acceptCb
      );

      expect(acceptCb).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
      // ההוסט מקבל הודעת ACCEPTED על הסוקט שלו — סוקט נפרד מזה של המנחה
      expect(hostSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.GAME.MODERATOR_RESPONSE,
        expect.objectContaining({
          status: MODERATOR_RESPONSE_STATUS.ACCEPTED,
          moderatorId: modSocket.user.id,
        })
      );
    });

    it('מחזירה FAILED_TO_PERFORM_MODERATION_ACTION כש-participant.create זורק שגיאה בלתי צפויה', async () => {
      await setupInvitation();
      mockGameFindUnique.mockResolvedValueOnce({ streamId });
      mockGetViewerCount.mockResolvedValueOnce(50);
      mockParticipantCreate.mockRejectedValueOnce(
        new Error('unique constraint violated')
      );

      const cb = vi.fn();
      await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
        { gameId },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.FAILED_TO_PERFORM_MODERATION_ACTION,
      });
    });
  });

  // ═══════════════════════════════════════════
  // REJECT_MODERATOR
  // ═══════════════════════════════════════════
  describe('REJECT_MODERATOR', () => {
    let io, hostSocket, modSocket;

    async function setupInvitation() {
      mockGameFindUnique.mockResolvedValueOnce({
        hostId: hostSocket.user.id,
        status: 'WAITING',
        title: 'Trivia Night',
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: modSocket.user.id,
        username: modSocket.user.username,
      });
      mockParticipantFindUnique.mockResolvedValueOnce(null);

      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: modSocket.user.id },
        vi.fn()
      );
    }

    beforeEach(() => {
      hostSocket = createMockSocket('host-socket', 'host-1');
      modSocket = createMockSocket('mod-socket', 'mod-1');
      io = createMockIo([hostSocket, modSocket]);
      registerModeratorInvitationHandlers(io, hostSocket);
      registerModeratorInvitationHandlers(io, modSocket);
    });

    it('מחזירה INVITATION_NOT_FOUND_OR_EXPIRED כשאין הזמנה כלל', async () => {
      const cb = vi.fn();
      await modSocket.handlers[SOCKET_EVENTS.GAME.REJECT_MODERATOR](
        { gameId },
        cb
      );
      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.INVITATION_NOT_FOUND_OR_EXPIRED,
      });
    });

    it('מחזירה INVITATION_NOT_FOR_YOU כשמנחה אחר מנסה לדחות', async () => {
      await setupInvitation();
      const intruderSocket = createMockSocket('intruder-socket', 'intruder-1');
      registerModeratorInvitationHandlers(io, intruderSocket);

      const cb = vi.fn();
      await intruderSocket.handlers[SOCKET_EVENTS.GAME.REJECT_MODERATOR](
        { gameId },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.INVITATION_NOT_FOR_YOU,
      });
    });

    it('AC3 — cross-socket: host מזמינה, מנחה על socket נפרד לגמרי דוחה בהצלחה', async () => {
      await setupInvitation();

      const rejectCb = vi.fn();
      await modSocket.handlers[SOCKET_EVENTS.GAME.REJECT_MODERATOR](
        { gameId },
        rejectCb
      );

      expect(rejectCb).toHaveBeenCalledWith({ success: true });
      expect(hostSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.GAME.MODERATOR_RESPONSE,
        expect.objectContaining({
          status: MODERATOR_RESPONSE_STATUS.REJECTED,
          reason: MODERATOR_RESPONSE_REASON.REJECTED_BY_MODERATOR,
          moderatorId: modSocket.user.id,
        })
      );

      // ההזמנה נמחקה בפועל — ניסיון חוזר אמור להיכשל
      const secondCb = vi.fn();
      await modSocket.handlers[SOCKET_EVENTS.GAME.REJECT_MODERATOR](
        { gameId },
        secondCb
      );
      expect(secondCb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.INVITATION_NOT_FOUND_OR_EXPIRED,
      });
    });

    it('מחזירה FAILED_TO_PERFORM_MODERATION_ACTION כשליחת ההודעה להוסט נכשלת באופן בלתי צפוי', async () => {
      await setupInvitation();
      // REJECT_MODERATOR אינו נוגע ב-DB בכלל — כדי לדמות כשל בלתי
      // צפוי בתוך ה-try block, מכריחים את emit להוסט לזרוק שגיאה.
      hostSocket.emit = vi.fn(() => {
        throw new Error('socket write failed');
      });

      const cb = vi.fn();
      await modSocket.handlers[SOCKET_EVENTS.GAME.REJECT_MODERATOR](
        { gameId },
        cb
      );

      expect(cb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.FAILED_TO_PERFORM_MODERATION_ACTION,
      });
    });
  });

  // ═══════════════════════════════════════════
  // AC4 — 60-second timeout auto-expiry
  // ═══════════════════════════════════════════
  describe('60-second timeout auto-expiry (AC4)', () => {
    let io, hostSocket, modSocket;

    beforeEach(() => {
      hostSocket = createMockSocket('host-socket', 'host-1');
      modSocket = createMockSocket('mod-socket', 'mod-1');
      io = createMockIo([hostSocket, modSocket]);
      registerModeratorInvitationHandlers(io, hostSocket);
      registerModeratorInvitationHandlers(io, modSocket);
    });

    it('מוחקת הזמנה שלא נענתה אחרי 60 שניות, ומודיעה לשני הצדדים', async () => {
      mockGameFindUnique.mockResolvedValueOnce({
        hostId: 'host-1',
        status: 'WAITING',
        title: 'Trivia Night',
      });
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'mod-1',
        username: 'mod-1',
      });
      mockParticipantFindUnique.mockResolvedValueOnce(null);

      await hostSocket.handlers[SOCKET_EVENTS.GAME.INVITE_MODERATOR](
        { gameId, moderatorUserId: 'mod-1' },
        vi.fn()
      );

      vi.advanceTimersByTime(60000);

      expect(modSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.GAME.MODERATOR_RESPONSE,
        expect.objectContaining({
          status: MODERATOR_RESPONSE_STATUS.REJECTED,
          reason: MODERATOR_RESPONSE_REASON.TIMEOUT,
        })
      );
      expect(hostSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.GAME.MODERATOR_RESPONSE,
        expect.objectContaining({
          status: MODERATOR_RESPONSE_STATUS.REJECTED,
          reason: MODERATOR_RESPONSE_REASON.MODERATOR_TIMEOUT,
        })
      );

      // ההזמנה נמחקה בפועל — ACCEPT מאוחר אמור להיכשל
      const acceptCb = vi.fn();
      await modSocket.handlers[SOCKET_EVENTS.GAME.ACCEPT_MODERATOR](
        { gameId },
        acceptCb
      );
      expect(acceptCb).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.INVITATION_NOT_FOUND_OR_EXPIRED,
      });
    });
  });
});
