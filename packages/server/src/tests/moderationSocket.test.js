/**
 * moderationSocket.test.js
 *
 * בדיקות יחידה ל-enforceMuteOnMediaServer — הערוץ שקורא בפועל ל-media
 * server. הפונקציות האחרות בקובץ (emitModerationEvent, enforceKickSocket)
 * כבר מכוסות עקיפין דרך moderation.controller.test.js.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { enforceMuteOnMediaServer } from '../utils/moderationSocket.js';

vi.mock('axios', () => ({
  default: { post: vi.fn() },
}));

describe('enforceMuteOnMediaServer', () => {
  const ORIGINAL_URL = process.env.MEDIA_SERVER_INTERNAL_URL;
  const ORIGINAL_SECRET = process.env.INTERNAL_SERVICE_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MEDIA_SERVER_INTERNAL_URL = 'http://media-server:8000';
    process.env.INTERNAL_SERVICE_SECRET = 'shared-secret';
  });

  afterEach(() => {
    // Plain assignment would coerce `undefined` to the string "undefined"
    // instead of actually clearing it, leaking a truthy value into
    // whatever runs next in this worker.
    if (ORIGINAL_URL === undefined) {
      delete process.env.MEDIA_SERVER_INTERNAL_URL;
    } else {
      process.env.MEDIA_SERVER_INTERNAL_URL = ORIGINAL_URL;
    }
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.INTERNAL_SERVICE_SECRET;
    } else {
      process.env.INTERNAL_SERVICE_SECRET = ORIGINAL_SECRET;
    }
  });

  it('posts to the mute endpoint with the secret header and a timeout', async () => {
    axios.post.mockResolvedValueOnce({ status: 200 });

    await enforceMuteOnMediaServer('stream-1', 'target-1', true);

    expect(axios.post).toHaveBeenCalledWith(
      'http://media-server:8000/internal/moderation/mute',
      { streamId: 'stream-1', targetUserId: 'target-1' },
      expect.objectContaining({
        headers: { 'x-internal-secret': 'shared-secret' },
        timeout: expect.any(Number),
      })
    );
  });

  it('posts to the unmute endpoint when muted=false', async () => {
    axios.post.mockResolvedValueOnce({ status: 200 });

    await enforceMuteOnMediaServer('stream-1', 'target-1', false);

    expect(axios.post).toHaveBeenCalledWith(
      'http://media-server:8000/internal/moderation/unmute',
      { streamId: 'stream-1', targetUserId: 'target-1' },
      expect.anything()
    );
  });

  it('propagates a rejection instead of swallowing it — no silent success', async () => {
    axios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(
      enforceMuteOnMediaServer('stream-1', 'target-1', true)
    ).rejects.toThrow('ECONNREFUSED');
  });
});
