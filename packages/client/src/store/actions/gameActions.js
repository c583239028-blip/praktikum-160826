// src/store/actions/gameActions.js
import { logger } from '@worldplay/shared';
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
    const { id, streamId, gameType } = response.game;

    // 2. Update store with session details. Status is WAITING here — it only
    // becomes ACTIVE once the broadcast actually starts (see
    // useHostBroadcast.startBroadcast), which also fires the server transition.
    dispatch(
      initGameSession({
        gameId: id,
        streamId: streamId,
        role: 'HOST',
        gameType: gameType,
        status: 'WAITING',
      })
    );

    return { gameId: id, streamId };
  } catch (error) {
    logger.error('Failed to create game:', error);
    throw error;
  }
};

// Joins an existing game. Ordinary CTA entry keeps the server's PLAYER default.
// A known host may explicitly request HOST so the server can validate ownership
// and idempotently return the existing host participant when resuming a session.
export const joinGame = (gameId, requestedRole) => async (dispatch) => {
  if (!gameId) {
    throw new Error('joinGame: gameId is required');
  }

  try {
    // 1. Join the game on the server
    const response = await apiFetch(
      `${API_BASE_URL}/api/games/${gameId}/join`,
      {
        method: 'POST',
        body: JSON.stringify(requestedRole ? { role: requestedRole } : {}),
      }
    );
    const { role, streamId } = response.participant;

    if (!streamId) {
      throw new Error('joinGame: server response missing streamId');
    }

    // 2. Update store with session details (viewMode/hlsUrl resolved inside
    // the slice). status is always ACTIVE here: joinGame only ever targets a
    // game the LIVE feed already filtered to an ACTIVE game (see
    // getJoinableGameId in live.js) — there is no "join a WAITING game" path.
    dispatch(
      initGameSession({
        gameId,
        streamId,
        role,
        status: 'ACTIVE',
      })
    );

    return { gameId, streamId, role };
  } catch (error) {
    logger.error('Failed to join game:', error);
    throw error;
  }
};
