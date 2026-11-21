import { accessFetch } from './accessClient.js';

const BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function templateRequest(path = '', body) {
  const response = await accessFetch(`${BASE}/api/templates${path}`, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Template request failed (${response.status})`);
  return data;
}