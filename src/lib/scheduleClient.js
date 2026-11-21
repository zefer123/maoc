import { accessFetch } from './accessClient.js';

const BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function scheduleRequest(path = '', body) {
  const response = await accessFetch(`${BASE}/api/schedules${path}`, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Schedule request failed (${response.status})`);
  return result;
}