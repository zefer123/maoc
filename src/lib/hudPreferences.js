import { accessFetch } from './accessClient.js';
import { validHudData, validHudEnvelope } from './hudPreferenceSchema.js';

const endpoint = `${(import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/hud-preferences`;
const cacheKey = 'i47_hud_preferences_v1';
const nameKey = 'i47_operator_name_v1';

export function readHudCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (validHudData(cached)) return cached;
  } catch { /* Storage may be disabled. */ }
  return null;
}

export function cacheHud(data) {
  try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* Optional cache. */ }
}

export function readOperatorName() {
  try { return (localStorage.getItem(nameKey) || '').trim().slice(0, 48); } catch { return ''; }
}

export function cacheOperatorName(name) {
  try { localStorage.setItem(nameKey, name); } catch { /* Device-only setting. */ }
}

export async function requestHud(input, signal) {
  const timeout = AbortSignal.timeout(5000);
  const response = await accessFetch(endpoint, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout, cache: 'no-store', redirect: 'error',
    ...(input ? { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : {})
  });
  if (response.status === 409) return { conflict: true };
  if (!response.ok) throw new Error('HUD preferences unavailable');
  const value = await response.json();
  if (!validHudEnvelope(value)) throw new Error('Invalid HUD response');
  return value;
}