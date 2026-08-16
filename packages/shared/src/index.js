import { z } from 'zod';

export * from './constants/socketEvents.js';
export * from './constants/errors.js';
// סכמה ליצירת משחק
export const CreateGameSchema = z.object({
  roomName: z.string().min(3, 'שם החדר חייב להכיל לפחות 3 תווים'),
  maxPlayers: z.number().min(2).max(8),
  isPrivate: z.boolean().optional(),
});

// סכמה להצטרפות למשחק
export const JoinGameSchema = z.object({
  gameId: z.string().uuid('מזהה משחק לא תקין'),
  role: z.enum(['HOST', 'PLAYER', 'VIEWER']).optional().default('VIEWER'),
});

export const SubmitAnswerSchema = z.object({
  questionId: z.string().uuid('מזהה שאלה לא תקין'),
  selectedOptionId: z.string().uuid('מזהה אופציה לא תקין'),
  wager: z.number().nonnegative('סכום ההימור חייב להיות חיובי או אפס'),
});

// סכמת תאריך לידה
export const BirthdaySchema = z.object({
  dateOfBirth: z
    .string({ error: 'dateOfBirth is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'פורמט תאריך לא תקין. נדרש YYYY-MM-DD')
    .refine(
      (d) => {
        const [year, month, day] = d.split('-').map(Number);
        const date = new Date(d);
        return (
          date.getUTCFullYear() === year &&
          date.getUTCMonth() + 1 === month &&
          date.getUTCDate() === day
        );
      },
      { message: 'תאריך לא תקין', fatal: true }
    )
    .refine((d) => new Date(d) < new Date(), 'תאריך לידה חייב להיות בעבר'),
});
