import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  gameId: null,
  title: null,
  hostId: null,
  hostName: null,
  moderatorId: null,
  moderatorName: null,
  status: 'WAITING',
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    // Partial update: only overwrite fields that are present in the payload.
    setGameSession: (state, action) => {
      const payload = action.payload || {};
      const {
        gameId,
        title,
        hostId,
        hostName,
        moderatorId,
        moderatorName,
        status,
      } = payload;

      if (gameId !== undefined) state.gameId = gameId;
      if (title !== undefined) state.title = title;
      if (hostId !== undefined) state.hostId = hostId;
      if (hostName !== undefined) state.hostName = hostName;
      if (moderatorId !== undefined) state.moderatorId = moderatorId;
      if (moderatorName !== undefined) state.moderatorName = moderatorName;
      if (status !== undefined) state.status = status;
    },

    setGameStatus: (state, action) => {
      state.status = action.payload;
    },
    resetGame: () => initialState,
  },
});

export const { setGameSession, setGameStatus, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
