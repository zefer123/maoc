import { createServer, get } from 'node:http';
import { COLLECTIONS, record, validateCollection } from '../src/validation.js';

const collectionRoutes = new Set(COLLECTIONS.map((name) => `/api/storage/${name}`));
const policy = "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

// The upstream is a listener created by the fixture, never a URL from env/CLI/browser.
export function createReadonlyFixtureTransport(fixture, assets) {
  const address = fixture.address();
  if (address?.address !== '127.0.0.1' || !address.port || address.port === 8787) {
    throw new Error('Read-only fixture requires a separate IPv4 loopback listener');
  }
  const upstream = `http://127.0.0.1:${address.port}`;
  return createReadonlyGateway(assets, async (path) => {
    if (!fixture.listening) throw new Error('Fixture stopped');
    const response = await fetch(upstream + path, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    return { status: response.status, body: await response.text() };
  });
}

export async function captureReadonlyCollections(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid collection port');
  const entries = await Promise.all(COLLECTIONS.map(async (name) => {
    try {
      const envelope = await readLoopbackEnvelope(port, `/api/storage/${name}`);
      if (!record(envelope) || envelope.schemaVersion !== 1 || !Number.isSafeInteger(envelope.revision) || envelope.revision < 0 ||
          !(envelope.updatedAt === null || (typeof envelope.updatedAt === 'string' && Number.isFinite(Date.parse(envelope.updatedAt))))) {
        throw new Error('Invalid envelope');
      }
      validateCollection(name, envelope.data);
      return [name, envelope];
    } catch {
      throw new Error(`Could not capture valid collection: ${name}`);
    }
  }));
  return Object.fromEntries(entries);
}

async function readLoopbackEnvelope(port, path) {
  // A direct socket, no shared proxy agent, no redirects, and bounded response bytes.
  const response = await new Promise((resolve, reject) => {
    const req = get({ hostname: '127.0.0.1', port, path, agent: false, signal: AbortSignal.timeout(5000) }, resolve);
    req.once('error', reject);
  });
  if (response.statusCode !== 200 || !/^application\/json\b/i.test(response.headers['content-type'] || '')) {
    response.destroy();
    throw new Error('Unexpected collection response');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of response) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) throw new Error('Collection response exceeds limit');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createReadonlySnapshotTransport(snapshot, assets) {
  const bodies = new Map(COLLECTIONS.map((name) => [`/api/storage/${name}`, JSON.stringify(snapshot[name])]));
  return createReadonlyGateway(assets, (path) => ({ status: 200, body: bodies.get(path) }));
}

function createReadonlyGateway(assets, readCollection) {
  const gateway = createServer(async (req, res) => {
    res.setHeader('content-security-policy', policy);
    res.setHeader('cache-control', 'no-store');
    const read = req.method === 'GET' && !req.headers['transfer-encoding'] &&
      (!req.headers['content-length'] || req.headers['content-length'] === '0');
    if (!read) return res.writeHead(403).end();
    // Synthetic fixture metadata only; never forwards access or auth to the live backend.
    if (req.url === '/api/access') return res.writeHead(200, { 'content-type': 'application/json' }).end('{"gateEnabled":false,"role":"local"}');
    if (!collectionRoutes.has(req.url)) {
      const asset = assets.get(req.url);
      return asset ? res.writeHead(200, { 'content-type': asset.type }).end(asset.body) : res.writeHead(403).end();
    }
    try {
      const { status, body } = await readCollection(req.url);
      res.writeHead(status, { 'content-type': 'application/json' }).end(body);
    } catch {
      res.writeHead(502, { 'content-type': 'application/json' }).end('{"error":"Collection unavailable"}');
    }
  });
  gateway.on('upgrade', (_, socket) => {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  return gateway;
}