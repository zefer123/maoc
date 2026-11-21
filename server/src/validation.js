export const COLLECTIONS = Object.freeze(['notes', 'deliverables', 'agentOverrides', 'savedCommands', 'chats']);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function requireValid(condition, message) {
  if (!condition) throw new HttpError(400, message);
}

export function validateDescription(value) {
  requireValid(typeof value === 'string' && value.trim().length > 0 && value.length <= 12000, 'description must contain 1–12000 characters');
  return value.trim();
}

export function validateDecision(value) {
  requireValid(value === 'approve' || value === 'reject', 'decision must be approve or reject');
  return value;
}

export function validateHumanResponse(value) {
  requireValid(record(value) && Object.keys(value).every((key) => ['action', 'text'].includes(key)), 'Human response accepts only action and text');
  requireValid(value.action === 'submit' || value.action === 'cancel', 'Human action must be submit or cancel');
  if (value.action === 'submit') {
    requireValid(typeof value.text === 'string' && value.text.trim().length > 0 && value.text.length <= 12000, 'Human response must contain 1–12000 characters');
  } else requireValid(value.text === undefined, 'Cancel must not include text');
  return { action: value.action, ...(value.action === 'submit' ? { text: value.text.trim() } : {}) };
}

export function validateId(value) {
  requireValid(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value), 'invalid identifier');
  return value;
}

function safeTree(value, depth = 0) {
  requireValid(depth <= 16, 'data exceeds maximum nesting depth');
  if (Array.isArray(value)) {
    requireValid(value.length <= 5000, 'array is too large');
    value.forEach((item) => safeTree(item, depth + 1));
  } else if (record(value)) {
    requireValid(Object.keys(value).length <= 1000, 'object has too many keys');
    for (const [key, item] of Object.entries(value)) {
      requireValid(!['__proto__', 'prototype', 'constructor'].includes(key), 'unsafe object key');
      safeTree(item, depth + 1);
    }
  } else {
    requireValid(value === null || ['string', 'number', 'boolean'].includes(typeof value), 'invalid JSON value');
    if (typeof value === 'string') requireValid(value.length <= 500000, 'text field is too large');
  }
}

function entries(value, max, fields) {
  requireValid(Array.isArray(value) && value.length <= max, `expected array with at most ${max} records`);
  const ids = new Set();
  for (const item of value) {
    requireValid(record(item), 'record must be an object');
    for (const field of fields) requireValid(typeof item[field] === 'string' && item[field].length > 0, `${field} must be a non-empty string`);
    if (fields.includes('id')) {
      requireValid(item.id.length <= 256 && !ids.has(item.id), 'invalid or duplicate record id');
      ids.add(item.id);
    }
  }
}

function stringFields(item, fields) {
  for (const field of fields) {
    if (field in item) requireValid(typeof item[field] === 'string', `${field} must be a string`);
  }
}

function stringLists(item, fields) {
  for (const field of fields) {
    if (field in item) requireValid(Array.isArray(item[field]) && item[field].every((value) => typeof value === 'string'), `${field} must be a string array`);
  }
}

export function validateCollection(name, value) {
  requireValid(COLLECTIONS.includes(name), 'unknown collection');
  safeTree(value);
  requireValid(Buffer.byteLength(JSON.stringify(value)) <= 4 * 1024 * 1024, 'collection exceeds 4MB');
  if (name === 'notes') {
    entries(value, 2000, ['id', 'title']);
    for (const item of value) {
      requireValid(typeof item.content === 'string', 'content must be a string');
      stringLists(item, ['tags', 'agents', 'links']);
      stringFields(item, ['category', 'updatedAt', 'summary']);
      if ('sources' in item) {
        requireValid(Array.isArray(item.sources), 'sources must be an array');
        for (const source of item.sources) {
          requireValid(record(source), 'source must be an object');
          stringFields(source, ['title', 'url', 'snippet', 'engine', 'domain']);
        }
      }
    }
  }
  if (name === 'savedCommands') entries(value, 1000, ['id', 'agentId', 'text']);
  if (name === 'deliverables' || name === 'chats') {
    requireValid(record(value), 'department data must be an object');
    for (const [dept, items] of Object.entries(value)) {
      requireValid(['command', 'trade', 'tech', 'design', 'content', 'data', 'finance', 'legal'].includes(dept), 'unknown department');
      entries(items, 2000, name === 'deliverables' ? ['id', 'title'] : []);
      if (name === 'deliverables') {
        for (const item of items) {
          stringFields(item, ['summary', 'artifactCode', 'lead', 'time', 'status']);
          stringLists(item, ['paragraphs', 'stages', 'coWork']);
        }
      }
    }
  }
  if (name === 'agentOverrides') {
    requireValid(record(value), 'agentOverrides must be an object');
    for (const [id, override] of Object.entries(value)) {
      requireValid(/^[A-Z]{2,12}$/.test(id) && record(override), 'invalid agent override');
      requireValid(Object.keys(override).every((key) => ['model', 'systemPrompt', 'tools', 'disabledTools', 'coWorkPartner', 'autonomyLevel'].includes(key)), 'unknown override field');
      for (const field of ['model', 'systemPrompt', 'coWorkPartner']) {
        if (field in override) requireValid(typeof override[field] === 'string', `invalid ${field}`);
      }
      for (const field of ['tools', 'disabledTools']) {
        if (field in override) requireValid(Array.isArray(override[field]) && override[field].every((tool) => typeof tool === 'string'), `invalid ${field}`);
      }
      if ('autonomyLevel' in override) requireValid(Number.isFinite(override.autonomyLevel) && override.autonomyLevel >= 0 && override.autonomyLevel <= 100, 'autonomyLevel must be 0–100');
    }
  }
  return value;
}