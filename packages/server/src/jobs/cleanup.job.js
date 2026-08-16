// Daily cron job (midnight) — soft delete after 30 days, hard delete after 31 days for unpinned games
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function startCleanupJob() {
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Starting daily cleanup...');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

    // Step 1: Soft delete — mark isDeleted = true after 30 days
    const logicalDelete = await prisma.userGameActivity.updateMany({
      where: {
        isPinned: false,
        isDeleted: false,
        game: { finishedAt: { lt: thirtyDaysAgo } },
      },
      data: { isDeleted: true },
    });
    console.log(`[Cron] Soft deleted: ${logicalDelete.count} records`);

    // Step 2: Hard delete — games older than 31 days with no pinned activity
    const gamesToDelete = await prisma.game.findMany({
      where: {
        finishedAt: { lt: thirtyOneDaysAgo },
        gameActivities: { none: { isPinned: true } },
      },
      select: { id: true },
    });

    const gameIds = gamesToDelete.map((g) => g.id);

    if (gameIds.length > 0) {
      await prisma.userAnswer.deleteMany({
        where: { question: { gameId: { in: gameIds } } },
      });
      await prisma.questionOption.deleteMany({
        where: { question: { gameId: { in: gameIds } } },
      });
      await prisma.question.deleteMany({ where: { gameId: { in: gameIds } } });
      await prisma.userPoint.deleteMany({ where: { gameId: { in: gameIds } } });
      await prisma.viewLog.deleteMany({ where: { gameId: { in: gameIds } } });
      await prisma.gameParticipant.deleteMany({
        where: { gameId: { in: gameIds } },
      });
      await prisma.userGameActivity.deleteMany({
        where: { gameId: { in: gameIds } },
      });
      await prisma.game.deleteMany({ where: { id: { in: gameIds } } });

      console.log(`[Cron] Hard deleted: ${gameIds.length} games`);
    }
  });
}
