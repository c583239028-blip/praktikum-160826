import { createSlice } from '@reduxjs/toolkit';
import { MEDIA_BASE_URL } from '../../services/apiConfig';

const initialState = {
  gameId: null,
  streamId: null,
  gameType: null,
  role: null, // 'HOST', 'PLAYER', 'VIEWER'
  status: 'WAITING', // 'WAITING', 'ACTIVE', 'PAUSE', 'FINISHED'
  viewMode: 'HLS', // 'WebRTC' (low latency) or 'HLS' (buffered)
  hlsUrl: null,
  isPaused: false,
  isFrozen: false, // true when a question is active and playback should pause
  activeProducers: [], // IDs of video streams (Host + up to 4 players)
};

const gameStreamSlice = createSlice({
  name: 'gameStream',
  initialState,
  reducers: {
    // Triggered when joining a game (from joinGame action)
    initGameSession: (state, action) => {
      const { gameId, streamId, role, gameType, status } = action.payload;
      state.gameId = gameId;
      state.streamId = streamId;
      state.role = role;
      state.gameType = gameType;
      // Caller-supplied ground truth: createAndStartGame passes WAITING (game
      // only goes ACTIVE once the broadcast starts), joinGame passes ACTIVE
      // (it only ever joins/resumes a game the feed already filtered to ACTIVE).
      state.status = status ?? initialState.status;

      // MODERATOR always on WebRTC. Players and HOST on WebRTC for broadcasting.
      // VIEWERs use HLS.
      state.viewMode = role === 'VIEWER' ? 'HLS' : 'WebRTC';

      if (state.viewMode === 'HLS') {
        state.hlsUrl = `${MEDIA_BASE_URL}/streams/${streamId}/index.m3u8`;
      }
    },

    // Updated from socket (stream_paused / status_update)
    setStreamStatus: (state, action) => {
      state.status = action.payload;
      state.isPaused = action.payload === 'PAUSE';
    },

    // Manages which participants are broadcasting video (up to 4 approved + moderator)
    updateActiveStreams: (state, action) => {
      state.activeProducers = action.payload;
    },

    resetSession: () => initialState,
  },
});

export const {
  initGameSession,
  setStreamStatus,
  updateActiveStreams,
  resetSession,
} = gameStreamSlice.actions;
export default gameStreamSlice.reducer;
