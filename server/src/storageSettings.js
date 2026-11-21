// Import is deliberately not a serving option: use the stopped-Vault CLI first.
export function storageSettings(env = process.env) {
  const storageDriver = env.MAOC_STORAGE_DRIVER || 'atomic-json';
  if (!['atomic-json', 'sqlite'].includes(storageDriver)) throw new Error('Invalid MAOC_STORAGE_DRIVER');
  const autoStart = env.MAOC_SCHEDULER_AUTOSTART || 'true';
  if (!['true', 'false'].includes(autoStart)) throw new Error('Invalid MAOC_SCHEDULER_AUTOSTART');
  const realtime = env.MAOC_COLLECTION_REALTIME ?? 'false';
  if (!['true', 'false'].includes(realtime)) throw new Error('Invalid MAOC_COLLECTION_REALTIME');
  return { storageDriver, schedulerAutoStart: autoStart === 'true', collectionRealtime: realtime === 'true' };
}