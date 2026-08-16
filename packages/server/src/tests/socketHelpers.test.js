import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncUserBalances,
  syncGameScores,
  broadcastEconomyEvent,
} from '../utils/socketHelpers.js';
import { SOCKET_EVENTS } from '@worldplay/shared';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';

const { mockFindUniqueUser, mockFindManyParticipants, mockDisconnect } =
  vi.hoisted(() => ({
    mockFindUniqueUser: vi.fn(),
    mockFindManyParticipants: vi.fn(),
    mockDisconnect: vi.fn(),
  }));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    user: { findUnique: mockFindUniqueUser },
    gameParticipant: {
      findMany: mockFindManyParticipants,
    },
    $disconnect: mockDisconnect,
  })),
}));

// mock ל-io של Socket.io - עוקב אחרי to().emit()
const mockIo = () => {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { to, emit };
};

describe('syncUserBalances', () => {
  let io;

  beforeEach(() => {
    io = mockIo();
    vi.clearAllMocks();
  });

  it('AC1 — מקבל userId בודד (string) ולא נכשל', async () => {
    mockFindUniqueUser.mockResolvedValueOnce({
      id: 'user-1',
      walletBalance: 500,
      participations: [{ score: 30 }],
    });

    await syncUserBalances(io, 'user-1', 'game-1');

    expect(io.to).toHaveBeenCalledWith('user-1');
    expect(io.emit).toHaveBeenCalledTimes(1);
  });

  it('AC1 — מקבל מערך userIds ומטפל בכולם', async () => {
    mockFindUniqueUser
      .mockResolvedValueOnce({
        id: 'user-1',
        walletBalance: 500,
        participations: [{ score: 10 }],
      })
      .mockResolvedValueOnce({
        id: 'user-2',
        walletBalance: 200,
        participations: [{ score: 20 }],
      });

    await syncUserBalances(io, ['user-1', 'user-2'], 'game-1');

    expect(io.to).toHaveBeenCalledWith('user-1');
    expect(io.to).toHaveBeenCalledWith('user-2');
    expect(io.emit).toHaveBeenCalledTimes(2);
  });

  it('AC1 — מערך ריק / undefined לא זורק שגיאה, פשוט יוצא', async () => {
    await syncUserBalances(io, [], 'game-1');
    expect(io.to).not.toHaveBeenCalled();

    await syncUserBalances(io, undefined, 'game-1');
    expect(io.to).not.toHaveBeenCalled();
  });

  it('AC2 — ה-payload במבנה הנכון: walletCoins, gameId, pointsInGame', async () => {
    mockFindUniqueUser.mockResolvedValueOnce({
      id: 'user-1',
      walletBalance: 750,
      participations: [{ score: 45 }],
    });

    await syncUserBalances(io, 'user-1', 'game-42');

    expect(io.emit).toHaveBeenCalledWith(SOCKET_EVENTS.WALLET.BALANCE_UPDATE, {
      walletCoins: 750,
      gameId: 'game-42',
      pointsInGame: 45,
    });
  });

  it('AC2 — כאשר אין רשומת GameParticipant, pointsInGame הוא 0', async () => {
    mockFindUniqueUser.mockResolvedValueOnce({
      id: 'user-1',
      walletBalance: 100,
      participations: [],
    });

    await syncUserBalances(io, 'user-1', 'game-1');

    expect(io.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.WALLET.BALANCE_UPDATE,
      expect.objectContaining({ pointsInGame: 0 })
    );
  });

  it('AC3 — השידור מוגבל לחדר הפרטי של המשתמש (לא לחדר המשחק)', async () => {
    mockFindUniqueUser.mockResolvedValueOnce({
      id: 'user-1',
      walletBalance: 500,
      participations: [{ score: 10 }],
    });
    await syncUserBalances(io, 'user-1', 'game-1');

    expect(io.to).toHaveBeenCalledWith('user-1');
    expect(io.to).not.toHaveBeenCalledWith('game-1');
  });

  it('משתמש שלא קיים ב-DB — לא קורס, ממשיך הלאה', async () => {
    mockFindUniqueUser.mockResolvedValueOnce(null);

    await expect(
      syncUserBalances(io, 'nonexistent-user', 'game-1')
    ).resolves.not.toThrow();
    expect(io.to).not.toHaveBeenCalled();
  });
  it('שאילתת ה-DB מאוחדת לקריאה אחת בלבד לכל משתמש', async () => {
    mockFindUniqueUser.mockResolvedValueOnce({
      id: 'user-1',
      walletBalance: 500,
      participations: [{ score: 10 }],
    });

    await syncUserBalances(io, 'user-1', 'game-1');

    expect(mockFindUniqueUser).toHaveBeenCalledTimes(1);
  });
});

describe('syncGameScores', () => {
  let io;

  beforeEach(() => {
    io = mockIo();
    vi.clearAllMocks();
  });

  it('AC4 — משדר עם השם הנכון של האירוע (game:leaderboard_updated)', async () => {
    mockFindManyParticipants.mockResolvedValueOnce([
      {
        userId: 'user-1',
        score: 50,
        role: 'PLAYER',
        user: { username: 'alice' },
      },
    ]);

    await syncGameScores(io, 'game-1');

    expect(io.to).toHaveBeenCalledWith('game-1');
    expect(io.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.GAME.LEADERBOARD_UPDATED,
      expect.objectContaining({ gameId: 'game-1' })
    );
  });

  it('אין משתתפים — לא משדר כלום', async () => {
    mockFindManyParticipants.mockResolvedValueOnce([]);

    await syncGameScores(io, 'game-empty');

    expect(io.emit).not.toHaveBeenCalled();
  });
});

describe('broadcastEconomyEvent', () => {
  let io;

  beforeEach(() => {
    io = mockIo();
    vi.clearAllMocks();
  });

  it('AC4 — משדר עם השם הנכון של האירוע (economy:event)', () => {
    broadcastEconomyEvent(io, 'game-1', 'POT_DISTRIBUTED', { amount: 100 });

    expect(io.to).toHaveBeenCalledWith('game-1');
    expect(io.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.ECONOMY.EVENT,
      expect.objectContaining({
        type: 'POT_DISTRIBUTED',
        gameId: 'game-1',
      })
    );
  });
});

describe('SCRUM-213 regression guard — no duplicate syncUserBalances', () => {
  it('balanceSync.js no longer exists', () => {
    const balanceSyncPath = path.resolve(__dirname, '../utils/balanceSync.js');
    expect(existsSync(balanceSyncPath)).toBe(false);
  });

  it('only one definition of syncUserBalances exists in the repo', () => {
    const srcDir = path.resolve(__dirname, '..');
    const pattern =
      /export\s+(async\s+)?function\s+syncUserBalances|export\s+const\s+syncUserBalances/;

    // סריקה רקורסיבית טהורה ב-Node — לא תלויה ב-grep/OS
    const findMatches = (dir) => {
      let matches = [];
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          matches = matches.concat(findMatches(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          const content = readFileSync(fullPath, 'utf-8');
          if (pattern.test(content)) {
            matches.push(fullPath);
          }
        }
      }

      return matches;
    };

    const matches = findMatches(srcDir);
    expect(matches.length).toBe(1);
  });

  it('economy.controller and userAnswer.service import from socketHelpers, not balanceSync', () => {
    const files = [
      '../controller/economy.controller.js',
      '../services/userAnswer.service.js',
    ];
    for (const file of files) {
      const content = readFileSync(path.resolve(__dirname, file), 'utf-8');
      expect(content).not.toMatch(/balanceSync/);
      expect(content).toMatch(/socketHelpers/);
    }
  });

  // game.handler no longer syncs balances itself — PLACE_BET delegates the
  // entire bet flow (including balance sync) to userAnswer.service, so it
  // has no direct socketHelpers import. It must still never reintroduce
  // the deprecated balanceSync module.
  it('game.handler does not reference the deprecated balanceSync module', () => {
    const content = readFileSync(
      path.resolve(__dirname, '../sockets/game.handler.js'),
      'utf-8'
    );
    expect(content).not.toMatch(/balanceSync/);
  });
});
