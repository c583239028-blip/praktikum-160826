import { createSlice } from '@reduxjs/toolkit';
import { logger } from '@worldplay/shared';
import * as questionsApi from '../../services/questionsApi';

// Shape of activeQuestion:
// { id, questionText, rewardType, options, timeLimit }
// Note: `timeLimit` will be populated once SCRUM-186 (server schema) is complete.
//
// Shape of an entry inside `questions`:
// { id, questionText, rewardType, options, timeLimit, isDraft, isResolved }
const initialState = {
  activeQuestion: null,
  isResolved: false,
  loading: false,
  error: null,
  questions: [],
};

const questionsSlice = createSlice({
  name: 'questions',
  initialState,
  reducers: {
    // Triggered on socket event: game:new_question
    setActiveQuestion: (state, action) => {
      const payload = action.payload;

      // NOTE (bug fix): the server emits `questionId` on game:new_question
      // (see question_controller.js), not `id`. The previous version of this
      // reducer only checked/destructured `id`, so it silently no-op'd on
      // every real socket event. We now accept either key, preferring
      // `questionId` if present (socket path); falls back to `id` (REST path).
      const questionId = payload?.questionId ?? payload?.id;
      if (!questionId) return;

      const { questionText, rewardType, options, timeLimit } = payload;

      state.activeQuestion = {
        id: questionId,
        questionText,
        rewardType,
        options,
        timeLimit: timeLimit ?? null,
      };
      state.isResolved = false;
      state.error = null;

      // Add to the full list if not already present (by id).
      // The server only emits game:new_question for non-draft questions
      // (see question_controller.js: `if (io && !newQuestion.isDraft)`),
      // so it's safe to assume isDraft: false here.
      const alreadyInList = state.questions.some((q) => q.id === questionId);
      if (!alreadyInList) {
        state.questions.push({
          id: questionId,
          questionText,
          rewardType,
          options,
          timeLimit: timeLimit ?? null,
          isDraft: false,
          isResolved: false,
        });
      }
    },

    // Triggered manually when a question closes or the user leaves the game
    clearActiveQuestion: (state) => {
      state.activeQuestion = null;
      state.isResolved = false;
      state.loading = false;
      state.error = null;
    },

    // Triggered on socket event: game:question_resolved
    // NOTE: socketMiddleware.js dispatches this with no payload, so we read
    // the id off the currently active question before clearing it.
    markResolved: (state) => {
      const resolvedId = state.activeQuestion?.id;
      if (resolvedId) {
        const question = state.questions.find((q) => q.id === resolvedId);
        if (question) {
          question.isResolved = true;
        }
      }

      state.isResolved = true;
      state.activeQuestion = null;
    },

    // Replaces the full questions list (used after fetching from the server)
    setQuestionsList: (state, action) => {
      state.questions = action.payload ?? [];
    },

    resetQuestions: () => initialState,
  },
});

export const {
  setActiveQuestion,
  clearActiveQuestion,
  markResolved,
  setQuestionsList,
  resetQuestions,
} = questionsSlice.actions;

// --- Selectors ---
// NOTE: assumes this slice is mounted under `state.questions`.
// Adjust the path below if your root reducer key differs.
export const selectDraftQuestions = (state) =>
  state.questions.questions.filter((q) => q.isDraft && !q.isResolved);

export const selectOpenQuestions = (state) =>
  state.questions.questions.filter((q) => !q.isDraft && !q.isResolved);

export const selectResolvedQuestions = (state) =>
  state.questions.questions.filter((q) => q.isResolved);

// --- Thunk ---
// Plain thunk (not createAsyncThunk) per SCRUM-256 spec.
export const fetchGameQuestions = (gameId) => async (dispatch) => {
  try {
    const questions = await questionsApi.getGameQuestions(gameId);
    dispatch(setQuestionsList(questions));
  } catch (error) {
    logger.error('fetchGameQuestions error:', error);
  }
};

export default questionsSlice.reducer;
