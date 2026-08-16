// packages/media-server/src/startup/reconcileOrphanedStreams.js
//
// SCRUM-229: reconciliation ב-startup. process שרק עלה (SFU יחיד) מחזיק
// אפס חדרים בזיכרון, אז כל שורה לא-סופית (LIVE/PAUSE) ששרדה מ-process
// קודם היא יתומה — ה-media שלה מת עם ה-process הקודם, ואף אירוע עתידי
// (JOIN מחזיר STREAM_NOT_LIVE) לא יתקן אותה. מכסה LIVE *וגם* PAUSE
// (שידור קפוא לא ניתן ל-resume אחרי שה-workers מתו). ה-reset הגורף נכון
// *רק* כל עוד single-process; scale אופקי יצריך reset per-process.
// WAITING מוחרג בכוונה (שידור עדיין בהקמה, לא live אף פעם).
//
// prisma/logger מוזרקים כפרמטרים (לא מיובאים ישירות) כדי לאפשר בדיקה
// מבודדת בלי לטעון את index.js (שמפעיל שרת אמיתי מיד עם הטעינה).
export async function reconcileOrphanedStreams(prisma, logger) {
  try {
    const result = await prisma.stream.updateMany({
      where: { status: { in: ['LIVE', 'PAUSE'] } },
      data: { status: 'FINISHED', viewerCount: 0, endTime: new Date() },
    });
    if (result.count > 0) {
      logger.info(
        `Reconciled ${result.count} orphaned stream(s) from previous process (SCRUM-229)`
      );
    }
    return result;
  } catch (err) {
    logger.error('Failed to reconcile orphaned streams on startup', err);
    return null;
  }
}
