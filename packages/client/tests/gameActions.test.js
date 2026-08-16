import { createAndStartGame, joinGame } from '../src/store/actions/gameActions';
import { apiFetch } from '../src/services/apiHelpers';
import { initGameSession } from '../src/store/slices/gameStreamSlice';

// 1. הגדרת Mocks לתקשורת ולפעולות הרדאקס
jest.mock('../src/services/apiHelpers', () => ({
  apiFetch: jest.fn(),
}));

jest.mock('../src/store/slices/gameStreamSlice', () => ({
  initGameSession: jest.fn((payload) => ({
    type: 'gameStream/initGameSession',
    payload,
  })),
}));

describe('gameActions - createAndStartGame', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch from API and dispatch initGameSession with gameType', async () => {
    // שלב א': הגדרת התשובה המדומה מהשרת
    const mockResponse = {
      game: {
        id: 'game-123',
        streamId: 'stream-456',
        gameType: 'CLOSE_UP',
      },
    };
    apiFetch.mockResolvedValueOnce(mockResponse);

    // שלב ב': הכנות להרצת ה-Thunk
    const dispatchMock = jest.fn();
    const gameData = { title: 'Test Game', gameType: 'CLOSE_UP' };

    // שלב ג': הרצת הפונקציה
    const thunk = createAndStartGame(gameData);
    const result = await thunk(dispatchMock);

    // שלב ד': בדיקות
    expect(apiFetch).toHaveBeenCalledTimes(1);

    expect(dispatchMock).toHaveBeenCalledWith(
      initGameSession({
        gameId: 'game-123',
        streamId: 'stream-456',
        role: 'HOST',
        gameType: 'CLOSE_UP',
        status: 'WAITING',
      })
    );

    expect(result).toEqual({ gameId: 'game-123', streamId: 'stream-456' });
  });
});

describe('gameActions - joinGame', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends HOST when resuming the host session and stores the returned role', async () => {
    apiFetch.mockResolvedValueOnce({
      participant: {
        role: 'HOST',
        streamId: 'stream-456',
      },
    });
    const dispatchMock = jest.fn();

    const result = await joinGame('game-123', 'HOST')(dispatchMock);

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/games/game-123/join'),
      {
        method: 'POST',
        body: JSON.stringify({ role: 'HOST' }),
      }
    );
    expect(dispatchMock).toHaveBeenCalledWith(
      initGameSession({
        gameId: 'game-123',
        streamId: 'stream-456',
        role: 'HOST',
        status: 'ACTIVE',
      })
    );
    expect(result).toEqual({
      gameId: 'game-123',
      streamId: 'stream-456',
      role: 'HOST',
    });
  });
});
