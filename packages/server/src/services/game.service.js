/**
 * game.service.js
 *
 * שכבת השירות המרכזית לניהול משחקים — יצירה, הצטרפות, סטטוס והיסטוריה.
 * כל שינוי משמעותי (יצירת משחק, עדכון סטטוס) מאומת מול permissions ו-validation לפני הביצוע.
 *
 * פונקציות:
 *   createGame(userId, data)                  — יצירת stream + game + HOST participant בטרנזקציה
 *   joinGame(gameId, userId, role)            — הצטרפות למשחק עם בדיקת כשירות
 *   updateGameStatus(gameId, userId, status)  — עדכון סטטוס עם בדיקת הרשאות ומעברים חוקיים
 *   getFollowedFeed(userId)                   — משחקים פעילים של מארחים שעוקבים אחריהם
 *   getGameHistory(userId)                    — היסטוריית משחקים עם pinned-first ו-breakdown נקודות
 *   togglePin(userId, gameId)                 — הצמדת/ביטול הצמדת משחק בהיסטוריה
 *   getGameViewers(gameId, currentUserId)     — סטטיסטיקת צופים (סה"כ / עוקבים / מזדמנים)
 *
 * מתקשר עם: Prisma → Game, Stream, GameParticipant, UserGameActivity, Follow, ViewLog
 * תלוי ב:   validation.service.js, permissions.service.js
 * משמש את:  game.controller.js, Socket.IO event handlers
 */
import prisma from '../lib/prisma.js';
import permissionsService from './permissions.service.js';
import * as gameRules from '../services/validation.service.js';
import { ERROR_MESSAGES, JOIN_ELIGIBILITY_STATUS } from '@worldplay/shared';
import { GameStatus, StreamStatus, UserRole } from '@prisma/client';
import streamService from './stream.service.js';

async function _cancelFreezeAndFinishStreams(streamIds) {
  for (const streamId of streamIds) {
    await streamService.cancelFreeze(streamId);
  }
  await prisma.stream.updateMany({
    where: { id: { in: streamIds } },
    data: { status: StreamStatus.FINISHED, endTime: new Date() },
  });
}

async function cancelOldGames(userId) {
  const oldGames = await prisma.game.findMany({
    where: {
      hostId: userId,
      status: { in: [GameStatus.WAITING, GameStatus.ACTIVE] },
    },
    select: { id: true, streamId: true },
  });

  if (oldGames.length === 0) return;

  const gameIds = oldGames.map((g) => g.id);
  const streamIds = oldGames.map((g) => g.streamId).filter(Boolean);

  await prisma.game.updateMany({
    where: { id: { in: gameIds } },
    data: { status: GameStatus.FINISHED },
  });

  if (streamIds.length > 0) await _cancelFreezeAndFinishStreams(streamIds);
}

const gameService = {
  async createGame(userId, { title, description, moderatorId, gameType }) {
    await cancelOldGames(userId);
    await gameRules.validateHostIsAvailable(userId);

    return await prisma.$transaction(async (tx) => {
      const newStream = await tx.stream.create({
        data: {
          title: `Stream for: ${title}`,
          hostId: userId,
          status: StreamStatus.WAITING,
        },
      });

      const newGame = await tx.game.create({
        data: {
          title,
          description,
          streamId: newStream.id,
          moderatorId: moderatorId || null,
          hostId: userId,
          status: GameStatus.WAITING,
          gameType,
        },
      });

      await tx.gameParticipant.create({
        data: {
          gameId: newGame.id,
          userId: userId,
          role: UserRole.HOST,
        },
      });

      await tx.userGameActivity.create({
        data: {
          userId: userId,
          gameId: newGame.id,
          relationType: UserRole.HOST,
        },
      });

      return { ...newGame, streamId: newStream.id };
    });
  },

  async joinGame(gameId, userId, role = UserRole.PLAYER) {
    const eligibility = await gameRules.validateJoinEligibility(
      gameId,
      userId,
      role
    );

    // streamId lives on Game, not on GameParticipant — attach it so the caller can route the joiner into the live stream
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { streamId: true },
    });
    const streamId = game?.streamId ?? null;

    if (eligibility.status === JOIN_ELIGIBILITY_STATUS.ALREADY_JOINED) {
      return {
        participant: { ...eligibility.participant, streamId },
        alreadyJoined: true,
      };
    }

    const newParticipant = await prisma.gameParticipant.create({
      data: { gameId, userId, role, score: 0 },
    });

    await prisma.userGameActivity.upsert({
      where: {
        userId_gameId: { userId, gameId },
      },
      update: {},
      create: {
        userId,
        gameId,
        relationType: role,
      },
    });

    return {
      alreadyJoined: false,
      participant: { ...newParticipant, streamId },
    };
  },

  async updateGameStatus(gameId, userId, newStatus) {
    const game = await gameRules.ensureGameExists(gameId);
    await permissionsService.ensureHost(gameId, userId);
    gameRules.validateStatusTransition(game.status, newStatus);

    const dataToUpdate = { status: newStatus };
    const now = new Date();

    if (newStatus === GameStatus.ACTIVE && !game.startedAt) {
      dataToUpdate.startedAt = now;
    } else if (newStatus === GameStatus.FINISHED) {
      dataToUpdate.finishedAt = now;
    }

    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: dataToUpdate,
    });

    if (newStatus === GameStatus.FINISHED && game.streamId)
      await _cancelFreezeAndFinishStreams([game.streamId]);

    return updatedGame;
  },

  async getFollowedFeed(userId) {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);

    return await prisma.game.findMany({
      where: {
        hostId: { in: followingIds },
        status: { in: [GameStatus.WAITING, GameStatus.ACTIVE] },
      },
      include: {
        host: { select: { username: true, followersCount: true } },
        stream: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getGameHistory(userId) {
    const activities = await prisma.userGameActivity.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      include: {
        game: {
          include: {
            host: { select: { id: true, username: true } },
            userPoints: {
              where: { userId },
              select: { pointType: true, amount: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pinned = activities.filter((a) => a.isPinned);
    const notPinned = activities.filter((a) => !a.isPinned);
    const combined = [...pinned, ...notPinned].slice(0, 10);

    const withBreakdown = combined.map((a) => {
      const breakdown = { TRIVIA: 0, DONATION: 0, BONUS: 0, GAME: 0 };
      for (const point of a.game.userPoints) {
        if (breakdown[point.pointType] !== undefined) {
          breakdown[point.pointType] += Number(point.amount);
        }
      }
      const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
      return { ...a, breakdown, total };
    });

    return {
      all: withBreakdown,
      asHost: withBreakdown.filter((a) => a.relationType === UserRole.HOST),
      asPlayer: withBreakdown.filter((a) =>
        [UserRole.PLAYER, UserRole.VIEWER, UserRole.MODERATOR].includes(
          a.relationType
        )
      ),
    };
  },

  async togglePin(userId, gameId) {
    const activity = await prisma.userGameActivity.findUnique({
      where: { userId_gameId: { userId, gameId } },
    });

    if (!activity) throw new Error(ERROR_MESSAGES.ACTIVITY_NOT_FOUND);

    return await prisma.userGameActivity.update({
      where: { userId_gameId: { userId, gameId } },
      data: { isPinned: !activity.isPinned },
    });
  },

  async getGameViewers(gameId, currentUserId) {
    const viewLogs = await prisma.viewLog.findMany({
      where: { gameId },
      select: { userId: true },
    });

    const viewerIds = [...new Set(viewLogs.map((v) => v.userId))];

    const follows = await prisma.follow.findMany({
      where: {
        followerId: currentUserId,
        followingId: { in: viewerIds },
      },
      select: { followingId: true },
    });

    const followerIds = new Set(follows.map((f) => f.followingId));

    return {
      total: viewerIds.length,
      followers: viewerIds.filter((id) => followerIds.has(id)).length,
      casual: viewerIds.filter((id) => !followerIds.has(id)).length,
    };
  },
  async getGameParticipants(gameId, requestingUserId) {
    await gameRules.ensureGameExists(gameId);
    await permissionsService.ensureHost(gameId, requestingUserId);
    const participants = await prisma.gameParticipant.findMany({
      where: { gameId },
      select: {
        id: true,
        role: true,
        score: true,
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });
    return participants.map((p) => ({
      ...p,
      score: Number(p.score),
    }));
  },

  async resolveQuestion(gameId, questionId, moderatorId) {
    const game = await gameRules.ensureGameExists(gameId);

    if (!game.moderatorId || game.moderatorId !== moderatorId) {
      throw new Error(ERROR_MESSAGES.NOT_AUTHORIZED_TO_RESOLVE_QUESTION);
    }

    // Atomic guard (isResolved: false in the WHERE) prevents a race condition
    // when the same moderator double-submits (e.g. network lag + retry tap).
    // count === 0 can mean either "not found" or "already resolved" — we
    // can't distinguish without a separate read, which would reopen the
    // race window. QUESTION_ALREADY_RESOLVED is used for both, since a
    // double-submit is the far more likely real-world cause.
    const { count } = await prisma.question.updateMany({
      where: { id: questionId, gameId, isResolved: false },
      data: { isResolved: true },
    });

    if (count === 0) {
      throw new Error(ERROR_MESSAGES.QUESTION_ALREADY_RESOLVED);
    }

    const answers = await prisma.userAnswer.findMany({
      where: { questionId },
      include: { option: true },
    });

    return answers.map((answer) => ({
      userId: answer.userId,
      type: answer.option.isCorrect ? 'win' : 'lose',
    }));
  },
};

export default gameService;
