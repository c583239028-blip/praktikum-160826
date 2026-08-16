/**
 * index.js (server)
 *
 * נקודת הכניסה לשרת הראשי — מפעיל את ה-Express app (מוגדר ב-app.js),
 * Socket.IO, ומחכה לזמינות שרת המדיה לפני שמסמן שהשרת מוכן.
 */
import 'dotenv/config';
import http from 'http';
import axios from 'axios';
import { validateEnv } from './config/validateEnv.js';
import app from './app.js';
import { initializeSocketIO } from './services/socket.service.js';
import { logger } from '@worldplay/shared';

validateEnv();

const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// --- Functions ---
async function checkMediaServer() {
  let connected = false;
  const mediaUrl = process.env.MEDIA_SERVER_INTERNAL_URL;

  while (!connected) {
    try {
      const response = await axios.get(mediaUrl); // פנייה לכתובת הדינמית
      logger.success(
        `[BACKEND-TO-MEDIA] Connection successful: ${response.data.status}`
      );
      connected = true;
    } catch (error) {
      logger.info(
        `[BACKEND-TO-MEDIA] Waiting for media server at ${mediaUrl}... ${error.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

// --- Startup ---
const io = initializeSocketIO(server);
app.set('io', io);

server.listen(PORT, '0.0.0.0', async () => {
  logger.success(`✅ Main Server running on port ${PORT}`);
  await checkMediaServer();
});
