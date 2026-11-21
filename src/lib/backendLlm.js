import { accessFetch, accessRole } from './accessClient.js';

const BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
const FIELDS = ['provider', 'modelName', 'ollamaUrl', 'autoFailover', 'fallbackProviders', 'rpm', 'maxHandoffs', 'maxToolRounds', 'maxToolCalls', 'maxTaskTokens', 'maxOutputTokens', 'taskTimeoutMs', 'providerModels'];

async function request(path, options = {}) {
  const response = await accessFetch(`${BASE}${path}`, { ...options, signal: AbortSignal.timeout(95000), headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend LLM error (${response.status})`);
  return data;
}

export async function syncBackendEngine(config) {
  if (accessRole() === 'user') return request('/api/llm/config');
  const payload = Object.fromEntries(FIELDS.filter((key) => config[key] !== undefined).map((key) => [key, config[key]]));
  // Empty UI keys preserve server .env credentials; explicit providerKeys can clear a key.
  if (config.apiKey?.trim()) payload.apiKey = config.apiKey.trim();
  if (config.providerKeys) payload.providerKeys = config.providerKeys;
  return request('/api/llm/config', { method: 'PUT', body: JSON.stringify(payload) });
}

export async function backendChat({ config, systemPrompt, userPrompt }) {
  await syncBackendEngine(config);
  return request('/api/llm/chat', { method: 'POST', body: JSON.stringify({ systemPrompt, userPrompt }) });
}