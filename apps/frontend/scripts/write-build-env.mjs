import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, '..');
const envPath = join(appDir, '.env');
const outputPath = join(appDir, 'src', 'app', 'core', 'build-env.ts');

function parseEnvFile(path) {
  if (!existsSync(path)) return {};

  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .reduce((env, rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return env;

      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) return env;

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value;
      return env;
    }, {});
}

const fileEnv = parseEnvFile(envPath);

function envValue(key, fallback = '') {
  const value = fileEnv[key] ?? process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

const buildEnv = {
  apiUrl: envValue('NG_APP_API_URL', 'http://localhost:3000/api'),
  realtimeUrl: envValue('NG_APP_REALTIME_URL', 'http://localhost:3001'),
  maptilerKey: envValue('NG_APP_MAPTILER_KEY'),
};

const content = `export const buildEnv = ${JSON.stringify(buildEnv, null, 2)} as const;\n`;

writeFileSync(outputPath, content);
console.log(`Wrote ${outputPath} from ${existsSync(envPath) ? envPath : 'process environment'}.`);
