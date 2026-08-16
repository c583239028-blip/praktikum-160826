/**
 * verify-sync-user-balances.js
 *
 * סקריפט בדיקה ידנית חד-פעמי לאימות SCRUM-213 refactor.
 * בודק ישירות (ללא UI, ללא REST, ללא socket אמיתי) ששלושת ה-flows
 * שהועברו מ-balanceSync.js ל-socketHelpers.js עדיין עובדים כראוי:
 *   1. Gift flow      (economy.service.js -> sendGift)
 *   2. Question-closure flow (userAnswer.service.js -> submitAnswer)
 *   3. Place-bet flow (game.handler.js PLACE_BET logic, משוחזר ידנית)
 *
 * הרצה (מתיקיית packages/server):
 *   infisical run -- node scripts/verify-sync-user-balances.js
 *
 * הסקריפט יוצר נתוני בדיקה, מריץ את שלושת ה-flows, מדפיס תוצאות,
 * ומנקה את כל הנתונים שיצר בסוף (גם אם קרתה שגיאה).
 */

import { SOCKET_EVENTS } from '@worldplay/shared';
import prisma from '../src/lib/prisma.js';
import { syncUserBalances } from '../src/utils/socketHelpers.js';
import economyService from '../src/services/economy.service.js';
import userAnswerService from '../src/services/userAnswer.service.js';

// ---------- Mock IO — במקום socket.io אמיתי, רק מדפיס מה היה משודר ----------
function createMockIo(label) {
  return {
    to(room) {
      return {
        emit(event, payload) {
          const isCorrectEvent = event === SOCKET_EVENTS.WALLET.BALANCE_UPDATE;
          console.log(
            `   📡 [${label}] emit -> room="${room}" | event="${event}" ${
              isCorrectEvent
                ? '✅ (SOCKET_EVENTS constant)'
                : '❌ (raw string?!)'
            }`
          );
          console.log(`      payload:`, payload);
        },
      };
    },
  };
}

const createdIds = {
  userIds: [],
  streamId: null,
  gameId: null,
  questionIds: [],
  optionIds: [],
};

async function seed() {
  console.log('\n=== 🌱 יוצר נתוני בדיקה ===\n');

  const suffix = Date.now();

  const sender = await prisma.user.create({
    data: {
      username: `test-sender-${suffix}`,
      email: `sender-${suffix}@test.local`,
    },
  });
  const receiver = await prisma.user.create({
    data: {
      username: `test-receiver-${suffix}`,
      email: `receiver-${suffix}@test.local`,
    },
  });
  const moderator = await prisma.user.create({
    data: {
      username: `test-moderator-${suffix}`,
      email: `moderator-${suffix}@test.local`,
    },
  });
  createdIds.userIds.push(sender.id, receiver.id, moderator.id);
  console.log(
    `👤 users created: sender=${sender.id}, receiver=${receiver.id}, moderator=${moderator.id}`
  );
  console.log(
    `   walletBalance התחלתי לכולם: ${sender.walletBalance} (ברירת מחדל)`
  );

  const stream = await prisma.stream.create({
    data: { title: `test-stream-${suffix}`, hostId: sender.id },
  });
  createdIds.streamId = stream.id;
  console.log(`🎥 stream created: ${stream.id}`);

  const game = await prisma.game.create({
    data: {
      title: `test-game-${suffix}`,
      hostId: sender.id,
      moderatorId: moderator.id,
      streamId: stream.id,
      status: 'ACTIVE', // חובה, כי userAnswer.service.js דורש game.status === 'ACTIVE'
    },
  });
  createdIds.gameId = game.id;
  console.log(`🎮 game created: ${game.id} (status=ACTIVE)`);

  // שאלה 1 — לצורך בדיקת question-closure flow (submitAnswer)
  const question1 = await prisma.question.create({
    data: { gameId: game.id, questionText: 'test question #1 (answer flow)' },
  });
  const option1 = await prisma.questionOption.create({
    data: { questionId: question1.id, text: 'test option #1' },
  });
  createdIds.questionIds.push(question1.id);
  createdIds.optionIds.push(option1.id);
  console.log(
    `❓ question #1 created: ${question1.id} (option: ${option1.id})`
  );

  // שאלה 2 — לצורך בדיקת place-bet flow (נפרדת כדי לא להתנגש ב-unique constraint)
  const question2 = await prisma.question.create({
    data: { gameId: game.id, questionText: 'test question #2 (bet flow)' },
  });
  const option2 = await prisma.questionOption.create({
    data: { questionId: question2.id, text: 'test option #2' },
  });
  createdIds.questionIds.push(question2.id);
  createdIds.optionIds.push(option2.id);
  console.log(
    `❓ question #2 created: ${question2.id} (option: ${option2.id})`
  );

  return {
    sender,
    receiver,
    moderator,
    game,
    question1,
    option1,
    question2,
    option2,
  };
}

async function testGiftFlow({ sender, receiver, moderator, game }) {
  console.log(
    '\n=== 1️⃣ בודק Gift Flow (economy.controller.js -> economyService.sendGift + syncUserBalances) ===\n'
  );

  const giftValue = 100;
  const io = createMockIo('GIFT');

  const result = await economyService.sendGift(
    sender.id,
    receiver.id,
    moderator.id,
    giftValue,
    game.id
  );
  console.log(`   💰 sendGift הצליח:`, result);

  // בדיוק מה ש-economy.controller.js עושה אחרי sendGift
  await syncUserBalances(io, sender.id, game.id);
  await syncUserBalances(io, receiver.id, game.id);
  await syncUserBalances(io, moderator.id, game.id);

  console.log('   ✅ Gift flow הושלם ללא שגיאות');
}

async function testQuestionClosureFlow({ receiver, question1 }) {
  console.log(
    '\n=== 2️⃣ בודק Question-Closure Flow (userAnswer.service.js -> submitAnswer) ===\n'
  );

  const io = createMockIo('QUESTION-CLOSURE');
  const option = await prisma.questionOption.findFirst({
    where: { questionId: question1.id },
  });

  const answer = await userAnswerService.submitAnswer(io, receiver.id, {
    questionId: question1.id,
    selectedOptionId: option.id,
    wager: 50,
  });
  console.log(`   📝 submitAnswer הצליח:`, answer);

  // syncUserBalances נקרא בתוך setImmediate — מחכים רגע כדי לתת לו לרוץ
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 50));

  console.log(
    '   ✅ Question-closure flow הושלם ללא שגיאות (בדקי למעלה שה-emit הודפס)'
  );
}

async function testPlaceBetFlow({ sender, game, question2 }) {
  console.log(
    '\n=== 3️⃣ בודק Place-Bet Flow (game.handler.js PLACE_BET, משוחזר ידנית) ===\n'
  );

  const io = createMockIo('PLACE-BET');
  const option = await prisma.questionOption.findFirst({
    where: { questionId: question2.id },
  });
  const amount = 30;

  // זהו בדיוק הקוד מתוך game.handler.js, socket.on(SOCKET_EVENTS.GAME.PLACE_BET, ...)
  await prisma.$transaction([
    prisma.userAnswer.create({
      data: {
        userId: sender.id,
        questionId: question2.id,
        selectedOptionId: option.id,
        wager: amount,
      },
    }),
    prisma.user.update({
      where: { id: sender.id },
      data: { walletBalance: { decrement: amount } },
    }),
  ]);

  await syncUserBalances(io, sender.id, game.id);

  console.log('   ✅ Place-bet flow הושלם ללא שגיאות');
}

async function cleanup() {
  console.log('\n=== 🧹 מנקה נתוני בדיקה ===\n');
  try {
    await prisma.transaction.deleteMany({
      where: { gameId: createdIds.gameId },
    });
    await prisma.userAnswer.deleteMany({
      where: { questionId: { in: createdIds.questionIds } },
    });
    await prisma.questionOption.deleteMany({
      where: { id: { in: createdIds.optionIds } },
    });
    await prisma.question.deleteMany({
      where: { id: { in: createdIds.questionIds } },
    });
    await prisma.gameParticipant.deleteMany({
      where: { gameId: createdIds.gameId },
    });
    if (createdIds.gameId)
      await prisma.game
        .delete({ where: { id: createdIds.gameId } })
        .catch(() => {});
    if (createdIds.streamId)
      await prisma.stream
        .delete({ where: { id: createdIds.streamId } })
        .catch(() => {});
    for (const userId of createdIds.userIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    console.log('   ✅ ניקוי הושלם');
  } catch (err) {
    console.error('   ⚠️ שגיאה בניקוי (ייתכן שצריך לנקות ידנית):', err.message);
    console.log('   IDs שנוצרו:', JSON.stringify(createdIds, null, 2));
  }
}

async function main() {
  try {
    const ctx = await seed();
    await testGiftFlow(ctx);
    await testQuestionClosureFlow(ctx);
    await testPlaceBetFlow(ctx);
    console.log(
      '\n🎉 כל שלושת ה-flows רצו בהצלחה מול socketHelpers.js — הבדיקה הידנית עברה.\n'
    );
  } catch (err) {
    console.error('\n❌ הבדיקה נכשלה:', err);
    process.exitCode = 1;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main();
