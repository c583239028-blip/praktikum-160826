import { configureStore } from '@reduxjs/toolkit';
import walletReducer from './slices/walletSlice';
import inboxReducer from './slices/inboxSlice';
import historyReducer from './slices/historySlice';
import questionsReducer from './slices/questionsSlice';
import gameStreamReducer from './slices/gameStreamSlice';
import gameReducer from './slices/gameSlice';
import participantsReducer from './slices/participantsSlice';
import { socketMiddleware } from './middleware/socketMiddleware';

export const store = configureStore({
  reducer: {
    wallet: walletReducer,
    inbox: inboxReducer,
    history: historyReducer,
    questions: questionsReducer,
    gameStream: gameStreamReducer,
    game: gameReducer,
    participants: participantsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(socketMiddleware()),
});
