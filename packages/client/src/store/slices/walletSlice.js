// src/store/slices/walletSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  walletBalance: 0,
  scoresByGame: {}, // shape: { "game-id-1": 100, "game-id-2": 50 }
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    updateBalances: (state, action) => {
      const payload = action.payload || {};
      const { walletCoins, pointsInGame, gameId, scoresByGame } = payload;

      if (walletCoins !== undefined) {
        state.walletBalance = walletCoins;
      }

      // Scenario A: bulk load from getMe
      if (scoresByGame && typeof scoresByGame === 'object') {
        state.scoresByGame = scoresByGame;
      }
      // Scenario B: single live update from socket
      else if (gameId && pointsInGame !== undefined) {
        state.scoresByGame = {
          ...state.scoresByGame,
          [gameId]: pointsInGame,
        };
      }
    },
    resetWallet: () => initialState,
  },
});

export const { updateBalances, resetWallet } = walletSlice.actions;
export default walletSlice.reducer;
