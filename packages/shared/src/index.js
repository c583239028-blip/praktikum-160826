import { z } from 'zod';
import { MIN_WAGER } from './constants/gameRules.js';

export * from './constants/socketEvents.js';
export * from './constants/errors.js';
export * from './constants/roomLimits.js';
export * from './constants/gameRules.js';
export * from './constants/internal.js';
export * from './constants/participantRoles.js';
export * from './utils/messageFormatter.js';
export * from './utils/logger.js';
// socketAuth.js is intentionally NOT re-exported here: it imports jsonwebtoken
// (Node-only, no crypto shim in metro.config.js), and this barrel is also
// consumed by the RN client bundle. server/media-server import it via the
// deep path @worldplay/shared/src/middleware/socketAuth.js instead.
// מזהה שידור תקין = UUID בלבד (Stream.id הוא @default(uuid())).
// why: streamId מגיע מהקליינט ומשמש לבניית נתיב בדיסק בשרת המדיה;
// חסימת כל מה שאינו UUID מונעת path traversal לפני שהוא נוגע ב-fs.
export const StreamIdSchema = z.string().uuid('מזהה שידור לא תקין');

export const isValidStreamId = (streamId) =>
  StreamIdSchema.safeParse(streamId).success;

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

export const ResolveQuestionSchema = z.object({
  gameId: z.string().uuid('מזהה המשחק חייב להיות UUID תקין'),
  questionId: z.string().uuid('מזהה השאלה חייב להיות UUID תקין'),
});

export const SubmitAnswerSchema = z.object({
  questionId: z.string().uuid('מזהה שאלה לא תקין'),
  selectedOptionId: z.string().uuid('מזהה אופציה לא תקין'),
  wager: z
    .number()
    .finite('סכום ההימור חייב להיות מספר סופי')
    .min(MIN_WAGER, `סכום ההימור המינימלי הוא ${MIN_WAGER}`),
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
