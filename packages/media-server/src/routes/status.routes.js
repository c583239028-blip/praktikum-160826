import express from 'express';
const router = express.Router();

// Middleware לתיעוד בקשות בטרמינל
router.use((req, res, next) => {
  // דילוג על ping ה-liveness ל-'/' (docker healthcheck כל 10 שניות + probe
  // בכל deploy) כדי שלא יטביע את הלוג — במיוחד כל עוד שמירת לוגים בין deploys
  // פתוחה (SCRUM-318). '/' מחזיר רק status ולכן אין ערך בתיעודו.
  if (req.method === 'GET' && req.path === '/') {
    return next();
  }
  console.log(
    `[${new Date().toISOString()}] Media Request: ${req.method} ${req.url}`
  );
  next();
});

// הודעת הברכה
router.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: '🚀 HyPulse Media Server is Live and Running!',
    timestamp: new Date().toISOString(),
  });
});

export default router;
