// src/config.js
import os from 'os';

// WHY env-driven: `app-server` only resolves inside the shared docker-compose
// network. Once media runs on its own droplet (SCRUM-291) that hostname is
// dead, so the target must come from the environment. The fallback keeps the
// single-host compose deploy working with no config. Trailing slashes are
// stripped so `http://host:8080/` does not produce a double-slash path
// (`//api/streams`) at the call site.
export const APP_SERVER_URL = (
  process.env.APP_SERVER_URL || 'http://app-server:8080'
).replace(/\/+$/, '');

export const config = {
  mediasoup: {
    // מספר ה-Workers כמספר הליבות
    numWorkers: Object.keys(os.cpus()).length,

    worker: {
      rtcMinPort: process.env.RTC_MIN_PORT
        ? parseInt(process.env.RTC_MIN_PORT)
        : 10000,
      rtcMaxPort: process.env.RTC_MAX_PORT
        ? parseInt(process.env.RTC_MAX_PORT)
        : 10079,
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    },

    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
        // הוסיפי את החלק הזה עבור FFmpeg
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f', // פרופיל שמתאים לרוב הדפדפנים ו-FFmpeg
            'level-asymmetry-allowed': 1,
          },
        },
      ],
    },

    webRtcTransport: {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1', // שימי לב: בפרודקשן זה ה-IP הציבורי
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
    },
  },
};
