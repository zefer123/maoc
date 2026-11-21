const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;
const SECRET = /key|token|authorization|password|secret|cookie|webhook|prompt|description|content/i;

function sanitize(value, depth = 0) {
  if (depth > 5) return '[truncated]';
  if (value instanceof Error) return { name: value.name, code: value.code || 'INTERNAL_ERROR' };
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key, SECRET.test(key) ? '[redacted]' : sanitize(item, depth + 1)
    ]));
  }
  return value;
}

export function createLogger(write = (line) => process.stdout.write(line)) {
  return Object.fromEntries(Object.keys(LEVELS).map((level) => [level, (event, fields = {}) => {
    if (LEVELS[level] < threshold) return;
    write(`${JSON.stringify({ ...sanitize(fields), timestamp: new Date().toISOString(), level, event })}\n`);
  }]));
}

export const logger = createLogger();