import gameStreamReducer, {
  initGameSession,
} from '../src/store/slices/gameStreamSlice';

// Fixed media base so the derived hlsUrl is deterministic regardless of env.
jest.mock('../src/services/apiConfig', () => ({
  MEDIA_BASE_URL: 'https://media.test',
  API_BASE_URL: 'https://api.test',
}));

describe('gameStreamSlice — initGameSession role derivation', () => {
  const base = { gameId: 'g1', streamId: 's1', gameType: 'TRIVIA' };

  // The VIEWER runtime path is blocked on media infra (SCRUM-291), so this
  // one-line derivation is guarded here instead. See SCRUM-309 verification.
  it('derives HLS view mode + hlsUrl for a VIEWER', () => {
    const state = gameStreamReducer(
      undefined,
      initGameSession({ ...base, role: 'VIEWER' })
    );
    expect(state.role).toBe('VIEWER');
    expect(state.viewMode).toBe('HLS');
    expect(state.hlsUrl).toBe('https://media.test/streams/s1/index.m3u8');
  });

  it('uses WebRTC (no hlsUrl) for HOST / PLAYER / MODERATOR', () => {
    for (const role of ['HOST', 'PLAYER', 'MODERATOR']) {
      const state = gameStreamReducer(
        undefined,
        initGameSession({ ...base, role })
      );
      expect(state.viewMode).toBe('WebRTC');
      expect(state.hlsUrl).toBeNull();
    }
  });
});
