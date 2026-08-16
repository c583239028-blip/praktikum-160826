/**
 * question.service.resolveQuestion.test.js
 *
 * SCRUM-142 — סגירת שאלה חייבת להיות אטומית ומוגנת מפני double-resolve.
 * מכסה את דרישות שרה:
 *   (א) כשל בתשלום → isResolved חוזר ל-false, retry מצליח (A1 — rollback מלא).
 *   (ב) שני resolve מקבילים → הקופה מחולקת פעם אחת, השני מקבל ALREADY_RESOLVED (B1).
 *   (ג) 50 עונים → timeout מדורג ולא ברירת-המחדל 5s (A4).
 *
 * ה-$transaction הממוקה מדמה את סמנטיקת ה-rollback: snapshot בכניסה, שחזור בזריקה.
 * שער ה-isResolved (updateMany עם isResolved:false ב-WHERE) רץ מול state משותף,
 * כך שרק resolve אחד מקבל count===1 גם תחת הרצה מקבילית.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERROR_MESSAGES } from '@worldplay/shared';

const {
  mockQuestionFindUnique,
  mockUserAnswerCount,
  mockTransaction,
  mockEnsureModerator,
  mockProcessWinnerPayout,
  mockDistributeStandardPot,
  mockRewardCorrectAnswers,
} = vi.hoisted(() => ({
  mockQuestionFindUnique: vi.fn(),
  mockUserAnswerCount: vi.fn(),
  mockTransaction: vi.fn(),
  mockEnsureModerator: vi.fn(),
  mockProcessWinnerPayout: vi.fn(),
  mockDistributeStandardPot: vi.fn(),
  mockRewardCorrectAnswers: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    question: { findUnique: mockQuestionFindUnique },
    userAnswer: { count: mockUserAnswerCount },
    $transaction: mockTransaction,
  },
}));

vi.mock('../services/permissions.service.js', () => ({
  default: { ensureModerator: mockEnsureModerator },
}));

vi.mock('../services/economy.service.js', () => ({
  default: {
    processWinnerPayout: mockProcessWinnerPayout,
    distributeStandardPot: mockDistributeStandardPot,
    rewardCorrectAnswers: mockRewardCorrectAnswers,
  },
}));

import questionService from '../services/question.service.js';

const questionId = 'q-1';
const gameId = 'game-1';
const moderatorId = 'mod-1';
const correctOptionId = 'opt-1';

/**
 * בונה DB בזיכרון עם state משותף. tx.question.updateMany מממש compare-and-swap
 * על isResolved; $transaction עוטף עם snapshot/rollback כמו טרנזקציה אמיתית.
 */
function installDb({
  rewardType = 'WINNER_TAKES_ALL',
  isResolved = false,
} = {}) {
  const state = { isResolved };

  const tx = {
    question: {
      updateMany: vi.fn(async ({ where, data }) => {
        // השער: מתעדכן רק אם עדיין לא נסגר (isResolved:false ב-WHERE).
        if (where.isResolved === false && state.isResolved) return { count: 0 };
        Object.assign(state, data);
        return { count: 1 };
      }),
    },
    questionOption: {
      updateMany: vi.fn(async () => ({ count: 0 })),
      update: vi.fn(async () => ({})),
    },
  };

  // findUnique: השליפה הראשונה (include.game) מחזירה תמונת-מצב "טרייה" עם
  // isResolved:false — מדמה את חלון המרוץ שבו שני קוראים קוראים לפני השער.
  // השליפה השנייה (include.options) מחזירה את השאלה הסגורה.
  mockQuestionFindUnique.mockImplementation(async (args) => {
    if (args?.include?.game) {
      return {
        id: questionId,
        gameId,
        rewardType,
        isResolved: false,
        game: { streamId: 'stream-1' },
      };
    }
    return { id: questionId, options: [], answers: [] };
  });

  mockTransaction.mockImplementation(async (fn) => {
    const snapshot = { ...state };
    try {
      return await fn(tx);
    } catch (err) {
      Object.assign(state, snapshot); // rollback — כולל isResolved
      throw err;
    }
  });

  return { state, tx };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEnsureModerator.mockResolvedValue(undefined);
  mockUserAnswerCount.mockResolvedValue(1);
  mockDistributeStandardPot.mockResolvedValue({
    totalPot: 0,
    distributions: [],
  });
  mockRewardCorrectAnswers.mockResolvedValue([]);
});

describe('resolveQuestion — אטומיות (A1)', () => {
  it('כשל בחלוקה מגלגל את isResolved לאחור, ו-retry מצליח', async () => {
    const { state } = installDb({ rewardType: 'WINNER_TAKES_ALL' });

    // ניסיון ראשון — התשלום נכשל (מדמה את שגיאת ה-DB המקורית).
    mockProcessWinnerPayout.mockRejectedValueOnce(new Error('payment failed'));

    await expect(
      questionService.resolveQuestion(questionId, moderatorId, correctOptionId)
    ).rejects.toThrow('payment failed');

    // הליבה של הבאג: אחרי כשל, השאלה לא נשארת נעולה.
    expect(state.isResolved).toBe(false);

    // ניסיון שני — הפעם התשלום מצליח, והשאלה נסגרת.
    mockProcessWinnerPayout.mockResolvedValueOnce({
      totalPot: 20,
      winnerId: 'w-1',
      winnerShare: 17,
      hostShare: 3,
    });

    const result = await questionService.resolveQuestion(
      questionId,
      moderatorId,
      correctOptionId
    );

    expect(state.isResolved).toBe(true);
    expect(result.distribution.winnerShare).toBe(17);
    expect(result.distribution.hostShare).toBe(3);
  });
});

describe('resolveQuestion — שער נגד double-resolve (B1)', () => {
  it('שני resolve מקבילים: הקופה מחולקת פעם אחת, השני מקבל ALREADY_RESOLVED', async () => {
    const { state } = installDb({ rewardType: 'WINNER_TAKES_ALL' });
    mockProcessWinnerPayout.mockResolvedValue({
      totalPot: 20,
      winnerShare: 17,
      hostShare: 3,
    });

    const [a, b] = await Promise.allSettled([
      questionService.resolveQuestion(questionId, moderatorId, correctOptionId),
      questionService.resolveQuestion(questionId, moderatorId, correctOptionId),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(['fulfilled', 'rejected']);

    const rejected = a.status === 'rejected' ? a : b;
    expect(rejected.reason.message).toBe(
      ERROR_MESSAGES.QUESTION_ALREADY_RESOLVED
    );

    // חלוקת הקופה קרתה בדיוק פעם אחת — אין יצירת מטבעות כפולה.
    expect(mockProcessWinnerPayout).toHaveBeenCalledTimes(1);
    expect(state.isResolved).toBe(true);
  });

  it('שאלה שכבר סגורה נדחית מוקדם עם ALREADY_RESOLVED', async () => {
    // fast-path: השליפה הראשונה מחזירה isResolved:true.
    mockQuestionFindUnique.mockResolvedValueOnce({
      id: questionId,
      gameId,
      rewardType: 'STANDARD',
      isResolved: true,
      game: { streamId: 'stream-1' },
    });

    await expect(
      questionService.resolveQuestion(questionId, moderatorId, correctOptionId)
    ).rejects.toThrow(ERROR_MESSAGES.QUESTION_ALREADY_RESOLVED);

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe('resolveQuestion — timeout מדורג (A4)', () => {
  it('50 עונים → timeout=22500 (לא ברירת-המחדל 5s)', async () => {
    installDb({ rewardType: 'STANDARD' });
    mockUserAnswerCount.mockResolvedValue(50);

    await questionService.resolveQuestion(
      questionId,
      moderatorId,
      correctOptionId
    );

    const expected = Math.min(60000, 10000 + 50 * 250); // 22500
    expect(mockUserAnswerCount).toHaveBeenCalledWith({ where: { questionId } });
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: expected,
      maxWait: expected,
    });
    expect(expected).toBeGreaterThan(5000);
  });

  it('timeout מוגבל בתקרה של 60s גם עם מספר עצום של עונים', async () => {
    installDb({ rewardType: 'STANDARD' });
    mockUserAnswerCount.mockResolvedValue(100000);

    await questionService.resolveQuestion(
      questionId,
      moderatorId,
      correctOptionId
    );

    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 60000,
      maxWait: 60000,
    });
  });
});

describe('resolveQuestion — הכל בטרנזקציה אחת (A2)', () => {
  it('החלוקה והתגמול מקבלים את אותו tx של הטרנזקציה העוטפת', async () => {
    installDb({ rewardType: 'WINNER_TAKES_ALL' });
    mockProcessWinnerPayout.mockResolvedValue({ totalPot: 20 });

    await questionService.resolveQuestion(
      questionId,
      moderatorId,
      correctOptionId
    );

    const txArg = mockProcessWinnerPayout.mock.calls[0].at(-1);
    const rewardTxArg = mockRewardCorrectAnswers.mock.calls[0].at(-1);
    // אותו אובייקט tx מועבר לשתי הפונקציות — הוכחה לטרנזקציה יחידה.
    expect(txArg).toBe(rewardTxArg);
    expect(txArg).toBeDefined();
  });
});
