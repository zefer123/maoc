import { accessFetch } from './accessClient.js';

export const PERSISTENCE_KEYS = Object.freeze({
  notes: 'maoc_obsidian_vault_v1',
  deliverables: 'maoc_dept_deliverables_v1',
  agentOverrides: 'maoc_agent_overrides_v1',
  savedCommands: 'maoc_saved_commands_v1',
  chats: 'maoc_dept_chats_v1'
});
const META_KEY = 'maoc_persistence_sync_v1';
const EMPTY = (name) => ['notes', 'savedCommands'].includes(name) ? [] : {};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function mergeValue(base, local, remote) {
  if (equal(local, base)) return remote;
  if (equal(remote, base) || equal(local, remote)) return local;
  const objects = [base, local, remote].every((value) => value && typeof value === 'object' && !Array.isArray(value));
  if (objects) {
    const result = {};
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      const value = mergeValue(base[key], local[key], remote[key]);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  const lists = [base, local, remote].every((value) => Array.isArray(value) && value.every((item) => item && typeof item.id === 'string'));
  if (lists) {
    const maps = [base, local, remote].map((list) => new Map(list.map((item) => [item.id, item])));
    const result = [];
    for (const id of new Set([...local.map((item) => item.id), ...remote.map((item) => item.id), ...base.map((item) => item.id)])) {
      const value = mergeValue(maps[0].get(id), maps[1].get(id), maps[2].get(id));
      if (value !== undefined) result.push(value);
    }
    return result;
  }
  throw new Error('SYNC_CONFLICT');
}

/**
 * @param {{
 *   storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
 *   fetcher?: (url: string, options: RequestInit) => Promise<Response>,
 *   baseUrl?: string,
 *   notify?: (detail: { status: string, collection?: string, key?: string }) => void,
 * }} [options]
 */
export function createPersistenceClient({ storage, fetcher = (...args) => fetch(...args), baseUrl = '', notify = () => {} } = {}) {
  const memory = new Map();
  let metadata = {};
  let active;
  let fullSync;
  let timer;
  let stopped = true;
  let reconcilePending = false;
  const invalidations = new Map();
  const statuses = {};
  const getRaw = (key) => {
    if (memory.has(key)) return memory.get(key);
    try { return storage?.getItem(key) ?? null; } catch { return null; }
  };
  const setRaw = (key, value) => {
    memory.set(key, value);
    try { storage?.setItem(key, value); } catch { notify({ status: 'memory-only', key }); }
  };
  try {
    metadata = JSON.parse(getRaw(META_KEY) || '{}');
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) metadata = {};
  } catch { metadata = {}; }
  const persistMeta = () => setRaw(META_KEY, JSON.stringify(metadata));
  const status = (name, value) => {
    statuses[name] = value;
    notify({ collection: name, status: value });
  };
  const read = (name, fallback) => {
    try {
      const raw = getRaw(PERSISTENCE_KEYS[name]);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  };
  const request = async (name, body) => {
    const response = await fetcher(`${baseUrl}/api/storage/${name}`, {
      method: body ? 'PUT' : 'GET', headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      /** @type {Error & {status?: number}} */
      const error = new Error(`PERSISTENCE_HTTP_${response.status}`);
      error.status = response.status;
      throw error;
    }
    const envelope = await response.json();
    if (!Number.isInteger(envelope.revision) || !('data' in envelope)) throw new Error('INVALID_PERSISTENCE_RESPONSE');
    return envelope;
  };

  async function syncCollection(name, cleanOnly = false) {
    const remote = await request(name);
    let meta = metadata[name];
    if (cleanOnly && (stopped || !meta || meta.dirty || remote.revision <= meta.revision)) return;
    const local = read(name, EMPTY(name));
    if (!meta) {
      if (remote.revision > 0 && getRaw(PERSISTENCE_KEYS[name]) !== null && !equal(local, remote.data)) {
        status(name, 'conflict');
        return;
      }
      // Import pre-v4 browser data only when the backend collection has never been written.
      meta = { revision: remote.revision, base: remote.data, dirty: remote.revision === 0 && getRaw(PERSISTENCE_KEYS[name]) !== null };
      metadata[name] = meta;
    }
    const merged = meta.dirty ? mergeValue(meta.base, local, remote.data) : remote.data;
    if (equal(merged, remote.data)) {
      const changed = !equal(local, remote.data);
      setRaw(PERSISTENCE_KEYS[name], JSON.stringify(remote.data));
      metadata[name] = { revision: remote.revision, base: remote.data, dirty: false };
      persistMeta();
      status(name, changed ? 'hydrated' : 'ready');
      return;
    }
    const localVersion = JSON.stringify(local);
    const saved = await request(name, { revision: remote.revision, data: merged });
    const current = read(name, EMPTY(name));
    const unchanged = JSON.stringify(current) === localVersion;
    if (unchanged) {
      metadata[name] = { revision: saved.revision, base: saved.data, dirty: false };
      setRaw(PERSISTENCE_KEYS[name], JSON.stringify(saved.data));
    } else {
      // Rebase edits made during the request onto the acknowledged server merge.
      metadata[name] = { revision: saved.revision, base: local, dirty: true };
      try {
        const rebased = mergeValue(local, current, saved.data);
        setRaw(PERSISTENCE_KEYS[name], JSON.stringify(rebased));
        metadata[name].base = saved.data;
      } catch {
        persistMeta();
        status(name, 'conflict');
        return;
      }
    }
    persistMeta();
    status(name, saved.projectionStatus === 'degraded' ? 'projection-degraded' : 'synced');
  }

  async function syncSafely(name, cleanOnly = false) {
    try { await syncCollection(name, cleanOnly); }
    catch (error) {
      if (cleanOnly && (stopped || metadata[name]?.dirty)) return;
      status(name, error.message === 'SYNC_CONFLICT' || error.status === 409 ? 'conflict' : error.status === 400 ? 'invalid' : 'offline');
    }
  }

  function runSync(work) {
    active = (async () => {
      await work();
    })().finally(() => {
      active = null;
      drainInvalidations();
    });
    return active;
  }

  function drainInvalidations() {
    if (active || fullSync || stopped || (!reconcilePending && !invalidations.size)) return;
    const all = reconcilePending;
    reconcilePending = false;
    const batch = [...invalidations];
    invalidations.clear();
    runSync(async () => {
      if (all) {
        for (const name of Object.keys(PERSISTENCE_KEYS)) {
          if (stopped) break;
          await syncSafely(name, true);
        }
        return;
      }
      for (const [name, revision] of batch) {
        const meta = metadata[name];
        if (!stopped && meta && !meta.dirty && revision > meta.revision) await syncSafely(name, true);
      }
    });
  }

  function invalidate(notice) {
    const { collection, revision } = notice || {};
    if (stopped || !Object.hasOwn(PERSISTENCE_KEYS, collection) || !Number.isSafeInteger(revision) || revision <= 0) return;
    invalidations.set(collection, Math.max(revision, invalidations.get(collection) || 0));
    drainInvalidations();
  }

  function reconcile() {
    if (stopped) return;
    reconcilePending = true;
    drainInvalidations();
  }

  function sync() {
    if (fullSync) return fullSync;
    fullSync = Promise.resolve(active).then(() => runSync(async () => {
      for (const name of Object.keys(PERSISTENCE_KEYS)) await syncSafely(name);
    })).finally(() => {
      fullSync = null;
      drainInvalidations();
    });
    return fullSync;
  }

  function schedule(ms = 300) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(async () => { await sync(); schedule(15000); }, ms);
  }

  function write(name, value) {
    if (!(name in PERSISTENCE_KEYS)) throw new Error('Unknown persistence collection');
    if (!metadata[name]) metadata[name] = { revision: 0, base: EMPTY(name), dirty: true };
    metadata[name].dirty = true;
    setRaw(PERSISTENCE_KEYS[name], JSON.stringify(value));
    persistMeta();
    schedule();
    return value;
  }

  const inspect = () => Object.fromEntries(Object.keys(PERSISTENCE_KEYS).map((name) => [name, {
    dirty: Boolean(metadata[name]?.dirty), revision: metadata[name]?.revision ?? null, status: statuses[name] || 'pending'
  }]));
  return {
    read, write, sync, invalidate, reconcile,
    inspect,
    start() { stopped = false; schedule(0); },
    stop() { stopped = true; clearTimeout(timer); invalidations.clear(); reconcilePending = false; },
    async flush() {
      if (active) await active;
      await sync();
      return inspect();
    },
    async resolveConflict(name, choice) {
      if (!(name in PERSISTENCE_KEYS) || !['local', 'remote'].includes(choice)) throw new Error('Invalid conflict resolution');
      const remote = await request(name);
      metadata[name] = { revision: remote.revision, base: remote.data, dirty: choice === 'local' };
      if (choice === 'remote') setRaw(PERSISTENCE_KEYS[name], JSON.stringify(remote.data));
      persistMeta();
      await sync();
      if (!metadata[name]?.dirty) status(name, 'hydrated');
    }
  };
}

let browserStorage;
try { browserStorage = typeof window === 'undefined' ? null : window.localStorage; } catch { browserStorage = null; }
export const persistence = createPersistenceClient({
  storage: browserStorage,
  fetcher: accessFetch,
  baseUrl: import.meta.env?.VITE_API_BASE_URL || '',
  notify(detail) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('maoc-persistence-status', { detail }));
    if (['hydrated', 'synced'].includes(detail.status)) {
      window.dispatchEvent(new CustomEvent('maoc-vault-updated'));
    }
    if (detail.status === 'conflict') console.warn(`[MAOC] Persistence conflict in ${detail.collection}; local changes retained. Use persistence.resolveConflict(collection, choice) to resolve.`);
  }
});