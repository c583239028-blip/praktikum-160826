// src/store/actions/gameActions.js
import { apiFetch } from '../../services/apiHelpers';
import { API_BASE_URL } from '../../services/apiConfig';
import { initGameSession } from '../slices/gameStreamSlice';

export const createAndStartGame = (gameData) => async (dispatch) => {
  try {
    // 1. Create game on server (also creates a stream in the same transaction)
    const response = await apiFetch(`${API_BASE_URL}/api/games`, {
      method: 'POST',
      body: JSON.stringify(gameData),
    });
    const { id, streamId } = response.game;

    // 2. Update store with session details
    dispatch(
      initGameSession({
        gameId: id,
        streamId: streamId,
        role: 'HOST',
      })
    );

    // Note: stream status is set to ACTIVE only once the broadcast actually
    // starts (see HostScreen.startBroadcast), not here — the game is still
    // WAITING on the server until then.
    return { gameId: id, streamId };
  } catch (error) {
    console.error('Failed to create game:', error);
    throw error;
  }
};
