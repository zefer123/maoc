const BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
let session = { role: null, key: '', controller: new AbortController() };

export function setAccessIdentity(role, key = '') {
  session.controller.abort();
  session = { role, key, controller: new AbortController() };
}

export const accessRole = () => session.role;

export function invalidateAccess(reason, key = session.key) {
  if (!key || key !== session.key) return;
  setAccessIdentity(null);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('maoc-access-lost', { detail: reason }));
}

function localUrl(input) {
  if (typeof location === 'undefined') return;
  const url = new URL(input, location.href);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('MAOC activation keys can only be sent to a loopback endpoint');
  }
}

// Only explicitly wired MAOC requests use this helper; external connectors never receive the key.
export async function accessFetch(url, options = {}) {
  const { key, controller } = session;
  if (!key) return fetch(url, options);
  localUrl(url);
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${key}`);
  const response = await fetch(url, { ...options, headers, cache: 'no-store', redirect: 'error',
    signal: options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal });
  if (response.status === 401) invalidateAccess('INVALID_KEY', key);
  return response;
}

export async function checkAccess(key = '') {
  const url = `${BASE}/api/access`;
  if (key) localUrl(url);
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
    headers: key ? { Authorization: `Bearer ${key}` } : undefined });
  if (!response.ok) throw new Error(response.status === 401 ? 'คีย์ไม่ถูกต้อง ถูกแทนที่ ถูกระงับ หรือหมดอายุ' : response.status === 429 ? 'ลองหลายครั้งเกินไป กรุณารอสักครู่' : 'ตรวจสิทธิ์ Backend ไม่สำเร็จ');
  const data = await response.json();
  if (typeof data.gateEnabled !== 'boolean' || ![null, 'admin', 'user', 'local'].includes(data.role) || (data.gateEnabled && data.role === 'local')) throw new Error('Backend ไม่ได้ส่งสถานะสิทธิ์ที่ใช้ได้');
  return data;
}

export async function adminKeyRequest(path = '', body) {
  const response = await accessFetch(`${BASE}/api/admin/keys${path}`, { signal: AbortSignal.timeout(10000),
    ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Admin request failed');
  return data;
}

export function websocketCredential(url) {
  const { key } = session;
  if (key) localUrl(url);
  return key;
}