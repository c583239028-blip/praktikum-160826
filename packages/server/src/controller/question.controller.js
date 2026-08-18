// ניהול שאלות במשחק — יצירה, סגירה עם חלוקת תגמולים וסנכרון ארנקים בזמן אמת
import { ERROR_MESSAGES, SOCKET_EVENTS } from '@worldplay/shared';
import questionService from '../services/question.service.js';
import {
  syncUserBalances,
  syncGameScores,
  broadcastEconomyEvent,
} from '../utils/socketHelpers.js';

const questionController = {
  async addQuestion(req, res) {
    try {
      const userId = req.user.id;
      const { gameId, questionText, rewardType, options, timeLimit, isDraft } =
        req.body;

      if (!gameId || !questionText) {
        return res.status(400).json({
          error: ERROR_MESSAGES.MISSING_REQUIRED_QUESTION_FIELDS,
        });
      }

      if (!options || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          error: ERROR_MESSAGES.MINIMUM_TWO_ANSWER_OPTIONS_REQUIRED,
        });
      }

      const newQuestion = await questionService.createQuestion(gameId, userId, {
        questionText,
        rewardType,
        options,
        timeLimit,
        isDraft,
      });

      const io = req.app.get('io');
      if (io && !newQuestion.isDraft) {
        io.to(gameId).emit(SOCKET_EVENTS.GAME.NEW_QUESTION, {
          questionId: newQuestion.id,
          questionText: newQuestion.questionText,
          rewardType: newQuestion.rewardType,
          timeLimit: newQuestion.timeLimit,
          options: newQuestion.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      res.status(201).json({
        message: 'Question added successfully',
        question: newQuestion,
      });
    } catch (error) {
      console.error('Add Question Error:', error);

      if (error.message === ERROR_MESSAGES.GAME_NOT_FOUND) {
        return res.status(404).json({ error: ERROR_MESSAGES.GAME_NOT_FOUND });
      }

      if (error.message === ERROR_MESSAGES.UNAUTHORIZED) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({ error: ERROR_MESSAGES.ERROR_CREATING_QUESTION });
    }
  },

  async resolveQuestion(req, res) {
    try {
      const { id: questionId } = req.params;
      const { optionId } = req.body;
      const userId = req.user.id;

      if (!optionId) {
        return res
          .status(400)
          .json({ error: ERROR_MESSAGES.OPTION_ID_REQUIRED });
      }

      const result = await questionService.resolveQuestion(
        questionId,
        userId,
        optionId
      );

      const io = req.app.get('io');
      const gameId = result.question.gameId;

      if (io) {
        // סנכרון מנצח שאלת "מי ינצח" (85%)
        if (result.distribution?.winnerId) {
          await syncUserBalances(io, result.distribution.winnerId, gameId);
        }

        // עדכון יתרות לכל המשתתפים שהושפעו (בונוס 125%, חלוקת קופה רגילה)
        const affectedUsers = [];

        if (result.distribution?.distributions) {
          affectedUsers.push(
            ...result.distribution.distributions.map((d) => d.userId)
          );
        }

        if (result.correctAnswerRewards) {
          affectedUsers.push(
            ...result.correctAnswerRewards.map((r) => r.userId)
          );
        }

        const uniqueUsers = [...new Set(affectedUsers)];
        for (const uId of uniqueUsers) {
          // מעדכן גם ארנק וגם ניקוד בזירה
          await syncUserBalances(io, uId, gameId);
        }

        // עדכון המנחה (עמלת 15% או עמלת קופה רגילה)
        await syncUserBalances(io, userId, gameId);

        await syncGameScores(io, gameId);

        io.to(gameId).emit(SOCKET_EVENTS.GAME.QUESTION_RESOLVED, {
          questionId,
          correctOptionId: optionId,
          distribution: {
            totalPot: result.distribution?.totalPot || 0,
            type: result.summary.rewardType,
            participantsRewarded: result.summary.participantsRewarded,
          },
          timestamp: new Date().toISOString(),
        });

        broadcastEconomyEvent(io, gameId, 'POT_DISTRIBUTED', {
          questionId,
          totalAmount: result.distribution?.totalPot || 0,
        });
      }

      res.status(200).json({
        message: 'Question resolved and funds distributed successfully',
        question: result.question,
        distribution: result.distribution,
        rewards: result.correctAnswerRewards,
        summary: result.summary,
      });
    } catch (error) {
      console.error('Resolve Question Error:', error);

      if (error.message === ERROR_MESSAGES.QUESTION_NOT_FOUND) {
        return res
          .status(404)
          .json({ error: ERROR_MESSAGES.QUESTION_NOT_FOUND });
      }

      if (error.message.includes('already resolved')) {
        return res
          .status(400)
          .json({ error: ERROR_MESSAGES.QUESTION_ALREADY_RESOLVED });
      }

      if (error.message === ERROR_MESSAGES.UNAUTHORIZED) {
        return res
          .status(403)
          .json({ error: ERROR_MESSAGES.NOT_AUTHORIZED_TO_RESOLVE_QUESTION });
      }

      res.status(500).json({
        error: ERROR_MESSAGES.ERROR_RESOLVING_QUESTION,
        details: error.message,
      });
    }
  },

  async getQuestion(req, res) {
    try {
      const { id } = req.params;
      const question = await questionService.getQuestionById(id);
      res.status(200).json({ question });
    } catch (error) {
      console.error('Get Question Error:', error);
      if (error.message === ERROR_MESSAGES.QUESTION_NOT_FOUND) {
        return res
          .status(404)
          .json({ error: ERROR_MESSAGES.QUESTION_NOT_FOUND });
      }
      res.status(500).json({ error: ERROR_MESSAGES.ERROR_FETCHING_QUESTION });
    }
  },

  async getGameQuestions(req, res) {
    try {
      const { gameId } = req.params;
      const questions = await questionService.getGameQuestions(gameId);
      res.status(200).json({
        gameId,
        count: questions.length,
        questions,
      });
    } catch (error) {
      console.error('Get Game Questions Error:', error);
      if (error.message === ERROR_MESSAGES.GAME_NOT_FOUND) {
        return res.status(404).json({ error: ERROR_MESSAGES.GAME_NOT_FOUND });
      }
      res
        .status(500)
        .json({ error: ERROR_MESSAGES.ERROR_FETCHING_GAME_QUESTIONS });
    }
  },
};

export default questionController;
