const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PORT',
  'MEDIA_SERVER_INTERNAL_URL',
];

export function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables!');
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }
  console.log('✅ All environment variables are set successfully.');
}
