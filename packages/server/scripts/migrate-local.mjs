import { spawnSync } from 'node:child_process';

// Point migrate at localhost: the shared Infisical DATABASE_URL uses the docker-internal host, unresolvable from the host machine.
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error(
    'migrate-local: DATABASE_URL is not set — run via `infisical run`.'
  );
  process.exit(1);
}

const url = new URL(DATABASE_URL);
url.hostname = 'localhost';
url.port = '5432';

const result = spawnSync(
  'npx',
  ['prisma', 'migrate', 'dev', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: url.toString() },
  }
);

process.exit(result.status ?? 1);
