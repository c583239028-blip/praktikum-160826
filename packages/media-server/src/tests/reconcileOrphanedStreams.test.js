import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileOrphanedStreams } from '../startup/reconcileOrphanedStreams.js';

function createMockPrisma(updateManyImpl) {
  return {
    stream: {
      updateMany: vi.fn(updateManyImpl),
    },
  };
}

function createMockLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

describe('reconcileOrphanedStreams (SCRUM-229)', () => {
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it('1. קורא ל-updateMany עם where/data המדויקים (LIVE+PAUSE → FINISHED, viewerCount:0)', async () => {
    const prisma = createMockPrisma(() => Promise.resolve({ count: 3 }));

    await reconcileOrphanedStreams(prisma, logger);

    expect(prisma.stream.updateMany).toHaveBeenCalledTimes(1);
    const [arg] = prisma.stream.updateMany.mock.calls[0];
    expect(arg.where).toEqual({ status: { in: ['LIVE', 'PAUSE'] } });
    expect(arg.data.status).toBe('FINISHED');
    expect(arg.data.viewerCount).toBe(0);
    expect(arg.data.endTime).toBeInstanceOf(Date);
  });

  it('2. WAITING לא נכלל בתנאי — רק LIVE ו-PAUSE', async () => {
    const prisma = createMockPrisma(() => Promise.resolve({ count: 0 }));

    await reconcileOrphanedStreams(prisma, logger);

    const [arg] = prisma.stream.updateMany.mock.calls[0];
    expect(arg.where.status.in).not.toContain('WAITING');
    expect(arg.where.status.in).not.toContain('FINISHED');
  });

  it('3. כשנוקו שידורים (count>0), מלוגג מספר מדויק', async () => {
    const prisma = createMockPrisma(() => Promise.resolve({ count: 2 }));

    await reconcileOrphanedStreams(prisma, logger);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('2'));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('4. כשאין שידורים יתומים (count=0), לא מלוגג info מיותר', async () => {
    const prisma = createMockPrisma(() => Promise.resolve({ count: 0 }));

    await reconcileOrphanedStreams(prisma, logger);

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('5. כשל DB לא זורק שגיאה — נתפס, מלוגג error, startServer יכול להמשיך', async () => {
    const prisma = createMockPrisma(() =>
      Promise.reject(new Error('DB connection lost'))
    );

    await expect(
      reconcileOrphanedStreams(prisma, logger)
    ).resolves.not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to reconcile orphaned streams on startup',
      expect.any(Error)
    );
  });

  it('6. מחזירה את תוצאת ה-updateMany בהצלחה, ו-null בכשל', async () => {
    const prismaSuccess = createMockPrisma(() => Promise.resolve({ count: 5 }));
    const resultSuccess = await reconcileOrphanedStreams(prismaSuccess, logger);
    expect(resultSuccess).toEqual({ count: 5 });

    const prismaFail = createMockPrisma(() =>
      Promise.reject(new Error('timeout'))
    );
    const resultFail = await reconcileOrphanedStreams(prismaFail, logger);
    expect(resultFail).toBeNull();
  });
});
