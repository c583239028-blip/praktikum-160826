import { logger } from '@worldplay/shared';

const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PORT',
  'MEDIA_SERVER_INTERNAL_URL',
  'INTERNAL_SERVICE_SECRET',
];

export function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables!');
    missing.forEach((key) => logger.error(`   - ${key}`));
    process.exit(1);
  }
  logger.success('✅ All environment variables are set successfully.');
}
