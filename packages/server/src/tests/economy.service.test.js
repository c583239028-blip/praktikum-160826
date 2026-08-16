// M8-12: giftValue must be rejected before $transaction opens — otherwise a negative value flips the decrement into a credit for the sender.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERROR_MESSAGES, formatMessage } from '@worldplay/shared';
import { GAME_SETTINGS } from '../constants/gameRules.js';

const {
  mockTransaction,
  mockGameFindUnique,
  mockUserFindUnique,
  mockUserUpdate,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockGameFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: { $transaction: mockTransaction },
}));

import economyService from '../services/economy.service.js';

const senderId = 'sender-1';
const receiverPlayerId = 'player-1';
const moderatorId = 'mod-1';
const gameId = 'game-1';

describe('economyService.sendGift', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation((callback) =>
      callback({
        game: { findUnique: mockGameFindUnique },
        user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
        gameParticipant: { upsert: vi.fn() },
        transaction: { createMany: vi.fn() },
      })
    );
  });

  describe('ולידציית giftValue', () => {
    it.each([
      ['שלילי', -100],
      ['אפס', 0],
      ['מחרוזת', '100'],
      ['NaN', NaN],
      ['Infinity', Infinity],
    ])('דוחה giftValue לא תקין: %s', async (_label, giftValue) => {
      await expect(
        economyService.sendGift(
          senderId,
          receiverPlayerId,
          moderatorId,
          giftValue,
          gameId
        )
      ).rejects.toThrow(ERROR_MESSAGES.INVALID_GIFT_VALUE);

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('דוחה giftValue שחורג מהתקרה (MAX_GIFT_AMOUNT + 0.01)', async () => {
      const overMax = GAME_SETTINGS.MAX_GIFT_AMOUNT + 0.01;

      await expect(
        economyService.sendGift(
          senderId,
          receiverPlayerId,
          moderatorId,
          overMax,
          gameId
        )
      ).rejects.toThrow(
        formatMessage(ERROR_MESSAGES.GIFT_EXCEEDS_MAX, {
          max: GAME_SETTINGS.MAX_GIFT_AMOUNT,
        })
      );

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('מקבלת giftValue בדיוק בגובה התקרה (MAX_GIFT_AMOUNT)', async () => {
      mockGameFindUnique.mockResolvedValueOnce({ id: gameId });
      mockUserFindUnique.mockResolvedValueOnce({
        walletBalance: GAME_SETTINGS.MAX_GIFT_AMOUNT,
      });

      const result = await economyService.sendGift(
        senderId,
        receiverPlayerId,
        moderatorId,
        GAME_SETTINGS.MAX_GIFT_AMOUNT,
        gameId
      );

      expect(mockTransaction).toHaveBeenCalled();
      expect(result.giftValue).toBe(GAME_SETTINGS.MAX_GIFT_AMOUNT);
    });
  });

  it('דוחה כשהיתרה אינה מספיקה', async () => {
    mockGameFindUnique.mockResolvedValueOnce({ id: gameId });
    mockUserFindUnique.mockResolvedValueOnce({ walletBalance: 10 });

    await expect(
      economyService.sendGift(
        senderId,
        receiverPlayerId,
        moderatorId,
        100,
        gameId
      )
    ).rejects.toThrow(ERROR_MESSAGES.INSUFFICIENT_COINS);

    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it('מצליחה: מנכה מהשולח ומחלקת 35%/65% בין המקבל למנחה', async () => {
    mockGameFindUnique.mockResolvedValueOnce({ id: gameId });
    mockUserFindUnique.mockResolvedValueOnce({ walletBalance: 1000 });

    const result = await economyService.sendGift(
      senderId,
      receiverPlayerId,
      moderatorId,
      100,
      gameId
    );

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: senderId },
      data: { walletBalance: { decrement: 100 } },
    });
    expect(result).toEqual({ giftValue: 100, playerShare: 35, hostShare: 65 });
  });
});
