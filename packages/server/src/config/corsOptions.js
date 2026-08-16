const allowedOrigins = {
  development: [
    'http://localhost:8081',
    'http://localhost:19006',
    'exp://localhost:8081',
  ],
  staging: ['https://staging-api.hypulse.app'],
  production: ['https://api.hypulse.app'],
};

const env = process.env.NODE_ENV || 'development';
const origins = allowedOrigins[env] || allowedOrigins.development;

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
};

export default corsOptions;
