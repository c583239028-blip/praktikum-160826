import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERROR_MESSAGES } from '@worldplay/shared';
import internalModerationController from '../controller/internalModeration.controller.js';

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/producerModeration.service.js', () => ({
  setAudioMuteForUser: vi.fn(),
}));

import { setAudioMuteForUser } from '../services/producerModeration.service.js';

function buildRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function buildReq(body) {
  const io = { to: vi.fn() };
  return { body, app: { get: () => io } };
}

describe('internalModerationController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['mute', 'unmute'])(
    '%s: 400s when streamId or targetUserId is missing',
    async (method) => {
      const res = buildRes();

      await internalModerationController[method](
        buildReq({ targetUserId: 'u1' }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS,
      });
      expect(setAudioMuteForUser).not.toHaveBeenCalled();
    }
  );

  it('mute: אכיפה מוצלחת — קורא ל-service עם muted=true ומחזיר 200', async () => {
    setAudioMuteForUser.mockResolvedValueOnce();
    const res = buildRes();
    const req = buildReq({ streamId: 'stream-1', targetUserId: 'user-1' });

    await internalModerationController.mute(req, res);

    expect(setAudioMuteForUser).toHaveBeenCalledWith(
      req.app.get('io'),
      'stream-1',
      'user-1',
      true
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('unmute: אכיפה מוצלחת — קורא ל-service עם muted=false', async () => {
    setAudioMuteForUser.mockResolvedValueOnce();
    const res = buildRes();
    const req = buildReq({ streamId: 'stream-1', targetUserId: 'user-1' });

    await internalModerationController.unmute(req, res);

    expect(setAudioMuteForUser).toHaveBeenCalledWith(
      req.app.get('io'),
      'stream-1',
      'user-1',
      false
    );
  });

  it('חדר שידור שאינו קיים — מחזיר 404 עם ההודעה הידועה', async () => {
    setAudioMuteForUser.mockRejectedValueOnce(
      new Error(ERROR_MESSAGES.STREAM_ROOM_NOT_FOUND)
    );
    const res = buildRes();

    await internalModerationController.mute(
      buildReq({ streamId: 'stream-1', targetUserId: 'user-1' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.STREAM_ROOM_NOT_FOUND,
    });
  });

  it('כשל בלתי צפוי — מחזיר 500 עם הודעה גנרית, לא חושף את error.message הגולמי', async () => {
    setAudioMuteForUser.mockRejectedValueOnce(new Error('mediasoup exploded'));
    const res = buildRes();

    await internalModerationController.mute(
      buildReq({ streamId: 'stream-1', targetUserId: 'user-1' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: ERROR_MESSAGES.FAILED_TO_ENFORCE_MEDIA_MODERATION,
    });
  });
});
