import { apiFetch } from './apiHelpers';
import { API_BASE_URL } from './apiConfig';

// GET /api/questions/game/:gameId
// Server response shape (question.controller.js -> getGameQuestions):
// { gameId, count, questions: [...] }
export async function getGameQuestions(gameId) {
  const res = await apiFetch(`${API_BASE_URL}/api/questions/game/${gameId}`);
  return res.questions;
}

// POST /api/questions — create a question, or a draft when isDraft is true.
// Server (question.controller.js -> addQuestion) requires questionText and at
// least 2 options; a non-draft also broadcasts NEW_QUESTION and freezes the stream.
// payload: { gameId, questionText, options: [{ text }], timeLimit, isDraft }
export async function createQuestion(payload) {
  return apiFetch(`${API_BASE_URL}/api/questions`, {
    method: 'POST',
    body: JSON.stringify({ rewardType: 'STANDARD', ...payload }),
  });
  // PATCH /api/questions/:id/resolve — סוגר שאלה פתוחה בשרת עם התשובה שנבחרה.
// Server (question.controller.js -> resolveQuestion, game.service.js:resolveQuestion)
// payload: { selectedAnswerId }
export async function resolveQuestion(questionId, selectedAnswerId) {
  return apiFetch(`${API_BASE_URL}/api/questions/${questionId}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ selectedAnswerId }),
  });
}
}
