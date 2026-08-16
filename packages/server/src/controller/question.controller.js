// ניהול שאלות במשחק — יצירה, סגירה עם חלוקת תגמולים וסנכרון ארנקים בזמן אמת
import { ERROR_MESSAGES, SOCKET_EVENTS } from '@worldplay/shared';
import { QuestionApprovalStatus } from '@prisma/client';
import questionService from '../services/question.service.js';
import streamService from '../services/stream.service.js';
import {
  syncUserBalances,
  syncGameScores,
  broadcastEconomyEvent,
} from '../utils/socketHelpers.js';
import { logger } from '@worldplay/shared';

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

      const { question: newQuestion, streamId } =
        await questionService.createQuestion(gameId, userId, {
          questionText,
          rewardType,
          options,
          timeLimit,
          isDraft,
        });

      // מחבר השאלה נחשף ללקוח (Q1a). שאלות ישנות ללא מחבר → author = null.
      const author = newQuestion.author
        ? {
            id: newQuestion.author.id,
            username: newQuestion.author.username,
            avatarUrl: newQuestion.author.avatarUrl ?? null,
          }
        : null;

      const io = req.app.get('io');
      // שאלה ממתינת-אישור (שאלת צופה) לעולם אינה משודרת — רק APPROVED יוצא החוצה. Q1b.
      const isApproved =
        newQuestion.approvalStatus === QuestionApprovalStatus.APPROVED;
      if (io && !newQuestion.isDraft && isApproved) {
        io.to(gameId).emit(SOCKET_EVENTS.GAME.NEW_QUESTION, {
          questionId: newQuestion.id,
          questionText: newQuestion.questionText,
          rewardType: newQuestion.rewardType,
          timeLimit: newQuestion.timeLimit,
          author,
          options: newQuestion.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
          })),
          timestamp: new Date().toISOString(),
        });

        // fan-out לחדר הסטרים כדי שהצופה (שאינו ב-game room) יראה את השאלה.
        // ה-payload כולל gameId כדי שהצופה יוכל להמר (place_bet). ראה 230.
        if (streamId) {
          io.to(streamId).emit(SOCKET_EVENTS.GAME.NEW_QUESTION, {
            gameId,
            questionId: newQuestion.id,
            questionText: newQuestion.questionText,
            rewardType: newQuestion.rewardType,
            timeLimit: newQuestion.timeLimit,
            author,
            options: newQuestion.options.map((opt) => ({
              id: opt.id,
              text: opt.text,
            })),
            timestamp: new Date().toISOString(),
          });
        }

        // main (SCRUM-172): הקפאת הווידאו לצופה לחלון המענה (DVR).
        streamService
          .freezeStreamForQuestion(gameId, newQuestion.timeLimit)
          .catch((err) =>
            logger.error(
              `Freeze trigger failed for game ${gameId}:`,
              err.message
            )
          );
      }

      res.status(201).json({
        message: 'Question added successfully',
        question: newQuestion,
      });
    } catch (error) {
      logger.error('Add Question Error:', error.message);

      if (error.message === ERROR_MESSAGES.GAME_NOT_FOUND) {
        return res.status(404).json({ error: ERROR_MESSAGES.GAME_NOT_FOUND });
      }

      if (error.message === ERROR_MESSAGES.UNAUTHORIZED) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({ error: ERROR_MESSAGES.ERROR_CREATING_QUESTION });
    }
  },

  // Q1b — צופה שולח שאלה (טקסט בלבד). לא משדר game:new_question; ממתין לאישור מנחה.
  async submitViewerQuestion(req, res) {
    try {
      const userId = req.user.id;
      const { gameId, questionText } = req.body;

      if (!gameId || !questionText) {
        return res.status(400).json({
          error: ERROR_MESSAGES.MISSING_REQUIRED_QUESTION_FIELDS,
        });
      }

      const { question } = await questionService.submitViewerQuestion(
        gameId,
        userId,
        { questionText }
      );

      res.status(201).json({
        message: 'Viewer question submitted and awaiting approval',
        question,
      });
    } catch (error) {
      logger.error('Submit Viewer Question Error:', error.message);

      if (error.message === ERROR_MESSAGES.GAME_NOT_FOUND) {
        return res.status(404).json({ error: ERROR_MESSAGES.GAME_NOT_FOUND });
      }
      if (error.message === ERROR_MESSAGES.NOT_GAME_PARTICIPANT) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === ERROR_MESSAGES.QUESTION_TEXT_REQUIRED) {
        return res.status(400).json({ error: error.message });
      }

      res
        .status(500)
        .json({ error: ERROR_MESSAGES.ERROR_SUBMITTING_VIEWER_QUESTION });
    }
  },

  // Q1b — מנחה מאשרת שאלת צופה ומוסיפה תשובות (מינימום שתיים נאכף כאן, במעבר לפרסום).
  async approveQuestion(req, res) {
    try {
      const { id: questionId } = req.params;
      const userId = req.user.id;
      const { options, rewardType, timeLimit } = req.body;

      const question = await questionService.approveQuestion(
        questionId,
        userId,
        { options, rewardType, timeLimit }
      );

      res.status(200).json({
        message: 'Viewer question approved',
        question,
      });
    } catch (error) {
      logger.error('Approve Question Error:', error.message);

      if (error.message === ERROR_MESSAGES.QUESTION_NOT_FOUND) {
        return res
          .status(404)
          .json({ error: ERROR_MESSAGES.QUESTION_NOT_FOUND });
      }
      if (error.message === ERROR_MESSAGES.UNAUTHORIZED) {
        return res.status(403).json({ error: error.message });
      }
      if (
        error.message === ERROR_MESSAGES.QUESTION_OPTIONS_REQUIRED ||
        error.message === ERROR_MESSAGES.QUESTION_NOT_PENDING_APPROVAL
      ) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: ERROR_MESSAGES.ERROR_APPROVING_QUESTION });
    }
  },

  // Q1b — מנחה דוחה שאלת צופה. השאלה נשארת REJECTED ולעולם אינה משודרת.
  async rejectQuestion(req, res) {
    try {
      const { id: questionId } = req.params;
      const userId = req.user.id;

      const question = await questionService.rejectQuestion(questionId, userId);

      res.status(200).json({
        message: 'Viewer question rejected',
        question,
      });
    } catch (error) {
      logger.error('Reject Question Error:', error.message);

      if (error.message === ERROR_MESSAGES.QUESTION_NOT_FOUND) {
        return res
          .status(404)
          .json({ error: ERROR_MESSAGES.QUESTION_NOT_FOUND });
      }
      if (error.message === ERROR_MESSAGES.UNAUTHORIZED) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === ERROR_MESSAGES.QUESTION_NOT_PENDING_APPROVAL) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: ERROR_MESSAGES.ERROR_REJECTING_QUESTION });
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

        // fan-out לחדר הסטרים לצופה (שאינו ב-game room). כולל gameId. ראה 230.
        if (result.streamId) {
          io.to(result.streamId).emit(SOCKET_EVENTS.GAME.QUESTION_RESOLVED, {
            gameId,
            questionId,
            correctOptionId: optionId,
            distribution: {
              totalPot: result.distribution?.totalPot || 0,
              type: result.summary.rewardType,
              participantsRewarded: result.summary.participantsRewarded,
            },
            timestamp: new Date().toISOString(),
          });
        }

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
      logger.error('Resolve Question Error:', error.message);

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
      logger.error('Get Question Error:', error.message);
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
      logger.error('Get Game Questions Error:', error.message);
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
