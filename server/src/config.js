import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { storageSettings } from './storageSettings.js';
import { accessSettings } from './accessKeys.js';

export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

try {
  loadEnvFile(resolve(PROJECT_ROOT, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

function integer(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid environment variable: ${name}`);
  }
  return value;
}

function httpUrl(name, fallback = '') {
  const value = process.env[name]?.trim() || fallback;
  if (!value) return '';
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`Invalid environment variable: ${name}`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`Invalid environment variable: ${name}`);
  }
  return value;
}

export const config = Object.freeze({
  ...storageSettings(),
  ...accessSettings(),
  port: integer('PORT', 8787, 1, 65535),
  host: process.env.HOST || '127.0.0.1',
  vaultDir: resolve(PROJECT_ROOT, process.env.VAULT_DIR || 'vault'),
  shutdownTimeoutMs: integer('SHUTDOWN_TIMEOUT_MS', 10000, 100, 60000),
  restRequestsPerMinute: integer('MAOC_REST_REQUESTS_PER_MINUTE', 600, 1, 60000),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173').split(',').map((s) => s.trim()).filter(Boolean),
  providers: Object.freeze({
    gemini: process.env.GEMINI_API_KEY?.trim() || '',
    openrouter: process.env.OPENROUTER_API_KEY?.trim() || '',
    openai: process.env.OPENAI_API_KEY?.trim() || '',
    ollamaUrl: httpUrl('OLLAMA_URL', 'http://localhost:11434')
  }),
  webhookUrl: httpUrl('WEBHOOK_URL')
});