// Fails fast at startup rather than booting "successfully" while every
// internal-moderation request silently 401s because the shared secret was
// never configured for this environment.
const REQUIRED_VARS = ['INTERNAL_SERVICE_SECRET'];

export function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables!');
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }
}
