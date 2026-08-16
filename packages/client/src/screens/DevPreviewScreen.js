import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import participantsReducer from '../store/slices/participantsSlice'; // TODO: לוודא נתיב אצלך
import gameStreamReducer from '../store/slices/gameStreamSlice'; // TODO: לוודא נתיב אצלך
import questionsReducer from '../store/slices/questionsSlice'; // TODO: לוודא נתיב אצלך
import streamStatsReducer from '../store/slices/streamStatsSlice'; // TODO: לוודא נתיב אצלך

import ModeratorScreen from './ModeratorScreen';

const mockStore = configureStore({
  reducer: {
    participants: participantsReducer,
    gameStream: gameStreamReducer,
    questions: questionsReducer,
    streamStats: streamStatsReducer,
  },
  preloadedState: {
    participants: {
      list: [
        { userId: '1', username: 'דני', role: 'player' },
        { userId: '2', username: 'מאיה', role: 'player' },
      ],
    },
    gameStream: {
      gameId: null, streamId: null, role: null, status: 'ACTIVE',
      viewMode: 'HLS', hlsUrl: null, isPaused: false, isFrozen: false,
      activeProducers: [],
    },
    questions: {
      activeQuestion: null, isResolved: false, loading: false, error: null,
      questions: [
        { id: 'q1', questionText: 'מי ינצח?', rewardType: 'coins',
          options: [{ id: 'a', text: 'אופציה 1' }, { id: 'b', text: 'אופציה 2' }],
          timeLimit: 30, isDraft: false, isResolved: false },
                  { id: 'q11', questionText: 'מי ינצח?', rewardType: 'coins',
          options: [{ id: 'a', text: 'אופציה 1' }, { id: 'b', text: 'אופציה 2' }],
          timeLimit: 30, isDraft: false, isResolved: false },
        { id: 'q2', questionText: 'טיוטה לדוגמה', rewardType: 'coins',
          options: [{ id: 'a', text: 'כן' }, { id: 'b', text: 'לא' }],
          timeLimit: 30, isDraft: true, isResolved: false },
      ],
    },
    streamStats: { streamTitle: 'Chess with Yuri', viewerCount: 10, giftCount: 1520 },
  },
});

export default function DevPreviewScreen() {
  return (
    <Provider store={mockStore}>
      <ModeratorScreen />
    </Provider>
  );
}
