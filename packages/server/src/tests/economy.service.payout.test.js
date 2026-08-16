/**
 * economy.service.payout.test.js
 *
 * SCRUM-142 — כיסוי לפונקציות ה-payout אחרי הרפקטור:
 *   - processWinnerPayout רושם Transaction עם type='WINNER_PAYOUT' (לעולם לא 'DIRECT_WIN').
 *   - שלוש הפונקציות מקבלות tx אופציונלי ורצות בתוכו בלי לפתוח $transaction מקונן (A2).
 *   - rewardCorrectAnswers batched: findMany אחד + createMany אחד, בלי findFirst (A3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransaction } = vi.hoisted(() => ({ mockTransaction: vi.fn() }));

vi.mock('../lib/prisma.js', () => ({
  default: { $transaction: mockTransaction },
}));

import economyService from '../services/economy.service.js';

const gameId = 'game-1';
const moderatorId = 'mod-1';
const questionId = 'q-1';
const correctOptionId = 'opt-1';

/** tx מזויף עם כל המתודות שהפונקציות משתמשות בהן. */
function makeTx() {
  return {
    questionOption: { findUnique: vi.fn() },
    userAnswer: { aggregate: vi.fn(), findMany: vi.fn() },
    user: { update: vi.fn().mockResolvedValue({}) },
    gameParticipant: { upsert: vi.fn().mockResolvedValue({}) },
    transaction: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processWinnerPayout', () => {
  it("רושם Transaction עם type='WINNER_PAYOUT' בלבד — regression guard נגד 'DIRECT_WIN'", async () => {
    const tx = makeTx();
    tx.questionOption.findUnique.mockResolvedValue({
      linkedPlayerId: 'winner-1',
    });
    tx.userAnswer.aggregate.mockResolvedValue({ _sum: { wager: 20 } });

    const result = await economyService.processWinnerPayout(
      questionId,
      correctOptionId,
      moderatorId,
      gameId,
      tx
    );

    // חלוקת 85/15 על 20 → 17/3.
    expect(result.winnerShare).toBe(17);
    expect(result.hostShare).toBe(3);

    const records = tx.transaction.createMany.mock.calls[0][0].data;
    expect(records).toHaveLength(2);
    for (const record of records) {
      expect(record.type).toBe('WINNER_PAYOUT');
      expect(record.type).not.toBe('DIRECT_WIN');
    }
  });

  it('כשמעבירים tx — לא נפתחת $transaction מקוננת (A2)', async () => {
    const tx = makeTx();
    tx.questionOption.findUnique.mockResolvedValue({
      linkedPlayerId: 'winner-1',
    });
    tx.userAnswer.aggregate.mockResolvedValue({ _sum: { wager: 20 } });

    await economyService.processWinnerPayout(
      questionId,
      correctOptionId,
      moderatorId,
      gameId,
      tx
    );

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalled();
  });

  it('ללא tx — פותחת $transaction משלה (תאימות לאחור)', async () => {
    const tx = makeTx();
    tx.questionOption.findUnique.mockResolvedValue({
      linkedPlayerId: 'winner-1',
    });
    tx.userAnswer.aggregate.mockResolvedValue({ _sum: { wager: 20 } });
    mockTransaction.mockImplementation((fn) => fn(tx));

    await economyService.processWinnerPayout(
      questionId,
      correctOptionId,
      moderatorId,
      gameId
    );

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('rewardCorrectAnswers — batched (A3)', () => {
  it('שולף את כל העונים-נכון ב-findMany אחד ורושם createMany אחד', async () => {
    const tx = makeTx();
    tx.userAnswer.findMany.mockResolvedValue([
      { userId: 'u1', wager: 8 },
      { userId: 'u2', wager: 20 },
    ]);

    const results = await economyService.rewardCorrectAnswers(
      questionId,
      gameId,
      correctOptionId,
      tx
    );

    // findMany מסונן לפי התשובה הנכונה — מחליף את לולאת ה-findFirst.
    expect(tx.userAnswer.findMany).toHaveBeenCalledWith({
      where: { questionId, selectedOptionId: correctOptionId },
      select: { userId: true, wager: true },
    });
    // createMany בודד עם כל הרשומות.
    expect(tx.transaction.createMany).toHaveBeenCalledTimes(1);
    const records = tx.transaction.createMany.mock.calls[0][0].data;
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.type === 'CORRECT_ANSWER')).toBe(true);

    // 125%: floor(8*1.25)=10, floor(20*1.25)=25.
    expect(results).toEqual([
      { userId: 'u1', rewarded: true, reward: 10, originalWager: 8 },
      { userId: 'u2', rewarded: true, reward: 25, originalWager: 20 },
    ]);
  });

  it('אין עונים נכון → מחזיר [] ולא רושם createMany', async () => {
    const tx = makeTx();
    tx.userAnswer.findMany.mockResolvedValue([]);

    const results = await economyService.rewardCorrectAnswers(
      questionId,
      gameId,
      correctOptionId,
      tx
    );

    expect(results).toEqual([]);
    expect(tx.transaction.createMany).not.toHaveBeenCalled();
  });
});
