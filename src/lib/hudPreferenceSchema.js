export const HUD_DEFAULTS = Object.freeze({ theme: 'kali-cyber', accent: 'theme', tacticalGrid: false });
export const HUD_THEMES = Object.freeze({ 'kali-cyber': 'Kali Cyber', 'realm-cyber': 'Realm Cyber', 'realm-guild': 'Realm Guild' });
export const HUD_ACCENTS = Object.freeze({ theme: 'Theme default', '#65e8ef': 'Kali Cyan', '#66e6ab': 'Matrix Emerald', '#ecd08a': 'Stark Gold', '#c5a3ff': 'Synthwave Violet' });

export function hasExactFields(value, fields) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === fields.length && fields.every((key) => Object.hasOwn(value, key));
}

export function validHudData(value) {
  return hasExactFields(value, ['theme', 'accent', 'tacticalGrid']) &&
    typeof value.theme === 'string' && Object.hasOwn(HUD_THEMES, value.theme) && typeof value.accent === 'string' &&
    (value.accent === 'theme' || /^#[0-9a-f]{6}$/i.test(value.accent)) && typeof value.tacticalGrid === 'boolean';
}

export const validHudRevision = (revision) => Number.isSafeInteger(revision) && revision >= 0;

export function validHudEnvelope(value) {
  return hasExactFields(value, ['schemaVersion', 'revision', 'updatedAt', 'data']) && value.schemaVersion === 1 &&
    validHudRevision(value.revision) && (value.revision === 0 ? value.updatedAt === null :
      typeof value.updatedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.updatedAt) &&
      Number.isFinite(Date.parse(value.updatedAt)) && new Date(value.updatedAt).toISOString() === value.updatedAt) && validHudData(value.data);
}