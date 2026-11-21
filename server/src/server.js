import { config } from './config.js';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Orchestrator } from './orchestrator.js';
import { LlmEngine } from './llmEngine.js';
import { ToolExecutor } from './toolExecutor.js';
import { TaskScheduler } from './taskScheduler.js';
import { TaskTemplateStore } from './taskTemplateStore.js';
import { PerformanceStore } from './performanceStore.js';
import { MissionHistory } from './missionHistory.js';
import { AccessKeys, validateAdminKey } from './accessKeys.js';
import { ANALYTICS_WINDOWS } from '../../src/lib/performanceAnalytics.js';
import { AGENTS } from '../../src/data/agents.js';
import { telemetryBus } from './eventBus.js';
import { StorageEngine, StorageWriteError } from './storageEngine.js';
import { logger } from './logger.js';
import { createDependencyChecks } from './healthChecks.js';
import { HttpError, record, requireValid, validateDescription, validateDecision, validateId } from './validation.js';

export async function createApplication(options = {}) {
  const settings = { ...config, ...options };
  validateAdminKey(settings.accessGate, settings.adminKey);
  const restLimit = settings.restRequestsPerMinute;
  requireValid(Number.isSafeInteger(restLimit) && restLimit >= 1 && restLimit <= 60_000, 'Invalid REST request limit');
  const restRateClock = options.restRateClock || (() => performance.now());
  let restResetAt = -Infinity;
  let restRequests = 0;
  const llmEngine = options.llmEngine || new LlmEngine({ settings });
  const driver = options.storageDriver || 'atomic-json';
  requireValid(['atomic-json', 'sqlite'].includes(driver), 'Invalid storage driver');
  const collectionRealtime = options.collectionRealtime === true;
  const Storage = driver === 'sqlite' ? (await import('./sqliteStorageEngine.js')).SqliteStorageEngine : StorageEngine;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const storage = await new Storage(settings.vaultDir, {
    importJson: options.sqliteImportJson === true,
    onCommit: collectionRealtime ? (collection, revision) => {
      for (const socket of wss.clients) send(socket, { type: 'COLLECTION_CHANGED', collection, revision });
    } : undefined
  }).init();
  const toolExecutor = new ToolExecutor({ storage });
  const analytics = new PerformanceStore(storage, { clock: options.analyticsClock });
  const history = new MissionHistory(storage);
  const access = new AccessKeys(storage, settings);
  const orchestrator = options.orchestrator || new Orchestrator({ llmEngine, toolExecutor, storage, analytics, history, clock: options.analyticsClock });
  let scheduler;
  let templates;
  try {
    await access.init();
    await history.init();
    await analytics.init();
    scheduler = await new TaskScheduler({ storage, orchestrator, bus: telemetryBus, clock: options.schedulerClock }).init();
    templates = await new TaskTemplateStore(storage).init();
  } catch (error) { await scheduler?.close(); await analytics.close(); await storage.close(); throw error; }
  const app = express();
  const server = createServer(app);
  let shuttingDown = false;
  let closePromise;
  const inFlightRoutes = new Set();
  const asyncRoute = (handler) => (req, res, next) => {
    const work = Promise.resolve().then(() => {
      if (access.invalidReason(req.access)) throw new HttpError(401, 'Activation key is no longer valid');
      return handler(req, res);
    }).catch(next)
      .finally(() => inFlightRoutes.delete(work));
    inFlightRoutes.add(work);
  };
  const originAllowed = (origin) => !origin || settings.corsOrigins.includes(origin);
  const checkDependencies = createDependencyChecks(settings);
  const loopback = (host) => ['127.0.0.1', '::1', 'localhost'].includes(host);
  const localRequest = (req) => loopback(server.address()?.address) && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(req.headers.host || '') &&
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
    (!req.headers.origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(req.headers.origin));
  const bearer = (req) => req.headers.authorization === undefined ? undefined : (/^Bearer ([A-Za-z0-9_-]{1,128})$/i.exec(req.headers.authorization)?.[1] || '');
  let failed = 0, resetAt = 0;
  const authenticate = (req, key) => {
    if (key === undefined) return access.authenticate(undefined, localRequest(req));
    if (!localRequest(req)) return null;
    if (Date.now() >= resetAt) { failed = 0; resetAt = Date.now() + 60_000; }
    const principal = access.authenticate(key);
    if (!principal && ++failed > 60) throw new HttpError(429, 'Too many invalid activation attempts; wait one minute');
    return principal;
  };
  const adminOnly = (req, res, next) => next(req.access?.role === 'admin' && localRequest(req) ? undefined : new HttpError(403, 'Admin access required'));
  const socketCounts = () => {
    const counts = new Map();
    for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN && ws.access?.role === 'user' && !access.invalidReason(ws.access)) {
      counts.set(ws.access.id, (counts.get(ws.access.id) || 0) + 1);
    }
    return counts;
  };

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    res.setHeader('Cache-Control', 'no-store');
    const started = performance.now();
    res.on('finish', () => logger.info('http.request', {
      requestId: req.requestId, method: req.method, route: req.route?.path || 'unmatched',
      status: res.statusCode, durationMs: Math.round((performance.now() - started) * 100) / 100
    }));
    if (!originAllowed(req.headers.origin)) return next(new HttpError(403, 'origin not allowed'));
    if (shuttingDown) return next(new HttpError(503, 'server is shutting down'));
    next();
  });
  app.use(cors({ origin: (origin, done) => done(null, originAllowed(origin)), methods: ['GET', 'POST', 'PUT', 'OPTIONS'] }));
  // One bucket for this local backend, including requests arriving via the Vite proxy.
  // Never trust forwarded addresses to create another bucket.
  app.use('/api', (req, res, next) => {
    const now = restRateClock();
    if (now >= restResetAt) {
      restRequests = 0;
      restResetAt = now + 60_000;
    }
    if (restRequests >= restLimit) {
      res.setHeader('Retry-After', String(Math.ceil((restResetAt - now) / 1000)));
      return res.status(429).json({ error: 'REST request limit exceeded', request_id: req.requestId });
    }
    restRequests += 1;
    next();
  });
  app.get('/api/access', (req, res, next) => {
    try {
      const key = bearer(req);
      const auth = authenticate(req, key);
      if (key !== undefined && !auth) throw new HttpError(401, 'Activation key is invalid, expired, revoked or replaced');
      res.json({ gateEnabled: access.enabled, role: auth?.role ?? null });
    } catch (error) { next(error); }
  });
  app.use('/api', (req, res, next) => {
    try {
      req.access = authenticate(req, bearer(req));
      if (!req.access) throw new HttpError(401, 'Activation key is required or no longer valid');
      next();
    } catch (error) { next(error); }
  });
  app.use(express.json({ limit: '5mb' }));
  // Requests already reading a body must not begin a route after shutdown starts.
  app.use((req, res, next) => next(shuttingDown ? new HttpError(503, 'server is shutting down') : undefined));
  app.use('/api', (req, res, next) => next(access.invalidReason(req.access) ? new HttpError(401, 'Activation key is no longer valid') : undefined));

  app.get('/api/admin/keys', adminOnly, (req, res) => {
    const sessions = socketCounts();
    res.json({ keys: access.list().map((row) => ({ ...row, activeSessions: sessions.get(row.id) || 0 })) });
  });
  app.post('/api/admin/keys', adminOnly, asyncRoute(async (req, res) => res.status(201).json(await access.change('create', null, req.body))));
  for (const action of ['rekey', 'revoke', 'reactivate']) {
    app.post(`/api/admin/keys/:id/${action}`, adminOnly, asyncRoute(async (req, res) => {
      res.json(await access.change(action, req.params.id, req.body ?? {}, (id) => {
        for (const ws of wss.clients) if (ws.access?.id === id) authorizedSocket(ws);
      }));
    }));
  }

  app.get('/api/health', asyncRoute(async (req, res) => {
    requireValid(req.query.deep === undefined || ['true', 'false'].includes(req.query.deep), 'deep must be true or false');
    const disk = await storage.health();
    const dependencies = req.query.deep === 'true' ? await checkDependencies() : { status: 'not_checked' };
    const llmStatus = llmEngine.inspect();
    const providers = Object.fromEntries(['gemini', 'openrouter', 'openai'].map((name) => [name, {
      configured: llmStatus.configured[name], connectivity: 'not_checked'
    }]));
    providers.ollama = { configured: Boolean(settings.providers.ollamaUrl), connectivity: 'not_checked' };
    const analyticsHealth = analytics.health();
    const missionHistoryHealth = history.health();
    const ok = disk.status === 'ok' && !scheduler.stopped && analyticsHealth.status === 'ok' && missionHistoryHealth.status === 'ok';
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded', uptime_sec: process.uptime(),
      checks: {
        process: { status: shuttingDown ? 'closing' : 'running' }, backup: { status: 'not_checked' },
        storage: disk, telemetry: telemetryBus.health(), analytics: analyticsHealth, missionHistory: missionHistoryHealth,
        websocket: { status: shuttingDown ? 'closing' : 'ok', clients: wss.clients.size },
        orchestrator: { status: shuttingDown ? 'closing' : 'ok', tasks: orchestrator.listTasks().length },
        scheduler: { status: scheduler.stopped ? 'stopped' : 'ok', schedules: scheduler.list().length },
        providers, llm: { provider: llmStatus.provider, queuePending: llmStatus.queuePending, rpm: llmStatus.rpm },
        dependencies, webhook: { configured: Boolean(settings.webhookUrl), connectivity: 'not_checked' }
      }
    });
  }));

  app.get('/api/llm/config', (req, res) => res.json(llmEngine.inspect()));
  app.put('/api/llm/config', (req, res, next) => {
    if (req.access.role === 'user') return next(new HttpError(403, 'Admin access is required to change the shared AI provider'));
    try { res.json(llmEngine.configure(req.body)); } catch (error) { next(error); }
  });
  app.get('/api/tools', (req, res) => res.json({ tools: toolExecutor.capabilities(), transport: 'in-process-registry', mcpTransportConnected: false }));
  app.get('/api/human-inputs', (req, res) => res.json({ inputs: orchestrator.listHumanInputs() }));
  app.post('/api/human-inputs/:inputId', (req, res, next) => {
    try {
      const id = validateId(req.params.inputId);
      if (!orchestrator.resolveHumanInput(id, req.body)) throw new HttpError(409, 'human input not found or already resolved');
      res.json({ accepted: true, input_id: id });
    } catch (error) { next(error); }
  });
  let activeLlmTests = 0;
  app.post('/api/llm/chat', asyncRoute(async (req, res) => {
    requireValid(record(req.body) && typeof req.body.userPrompt === 'string' && req.body.userPrompt.trim().length > 0 && req.body.userPrompt.length <= 20000, 'Invalid userPrompt');
    requireValid(req.body.systemPrompt === undefined || (typeof req.body.systemPrompt === 'string' && req.body.systemPrompt.length <= 12000), 'Invalid systemPrompt');
    if (activeLlmTests >= 2) throw new HttpError(429, 'Too many concurrent chat requests');
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', abort); activeLlmTests += 1;
    try {
      const result = await llmEngine.complete({ messages: [{ role: 'system', content: req.body.systemPrompt || 'You are a concise MAOC assistant.' }, { role: 'user', content: req.body.userPrompt }], signal: AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]) });
      res.json({ text: result.text, provider: result.provider, model: result.model, token_usage: result.usage });
    } finally { activeLlmTests -= 1; res.off('close', abort); }
  }));
  app.get('/api/tasks', (req, res) => res.json({ tasks: orchestrator.listTasks() }));
  app.get('/api/mission-history', (req, res) => res.json(history.list()));
  app.get('/api/reviews', (req, res, next) => {
    try {
      requireValid(Object.keys(req.query).every((key) => ['offset', 'limit', 'outcome'].includes(key)), 'Unknown AAR filter');
      const { offset = '0', limit = '25', outcome = 'all' } = req.query;
      requireValid(typeof offset === 'string' && /^\d{1,4}$/.test(offset) && typeof limit === 'string' && /^\d{1,2}$/.test(limit) && typeof outcome === 'string', 'Invalid AAR pagination');
      res.json(analytics.reviewList({ offset: Number(offset), limit: Number(limit), outcome }));
    } catch (error) { next(error); }
  });
  app.get('/api/reviews/:taskId', (req, res, next) => {
    try {
      requireValid(Object.keys(req.query).length === 0, 'AAR detail accepts no query parameters');
      res.json(analytics.review(req.params.taskId));
    } catch (error) { next(error); }
  });
  app.get('/api/schedules', (req, res) => res.json({ schedules: scheduler.list(), stopped: scheduler.stopped }));
  app.get('/api/templates', (req, res) => res.json({ templates: templates.list() }));
  app.post('/api/templates', asyncRoute(async (req, res) => res.status(201).json({ template: await templates.create(req.body) })));
  app.post('/api/templates/:templateId/render', (req, res, next) => {
    try { res.json({ mission: templates.render(req.params.templateId, req.body) }); } catch (error) { next(error); }
  });
  app.post('/api/templates/:templateId', asyncRoute(async (req, res) => res.json(await templates.remove(req.params.templateId, req.body))));
  app.post('/api/schedules', asyncRoute(async (req, res) => res.status(201).json({ schedule: await scheduler.create(req.body) })));
  app.post('/api/schedules/:scheduleId', asyncRoute(async (req, res) => res.json(await scheduler.action(req.params.scheduleId, req.body))));
  app.get('/api/analytics', (req, res, next) => {
    try {
      requireValid(Object.keys(req.query).every((key) => ['window', 'team', 'agent'].includes(key)), 'Unknown analytics filter');
      const { window = '7d', team = 'all', agent = 'all' } = req.query;
      requireValid(typeof window === 'string' && Object.hasOwn(ANALYTICS_WINDOWS, window), 'Invalid analytics window');
      requireValid(typeof team === 'string' && ['all', 'human', ...new Set(AGENTS.map((item) => item.team))].includes(team), 'Invalid analytics team');
      requireValid(typeof agent === 'string' && ['all', 'HUMAN', ...AGENTS.map((item) => item.id)].includes(agent), 'Invalid analytics agent');
      res.json(analytics.snapshot({ window, team, agent }));
    } catch (error) { next(error); }
  });
  app.get('/api/events', (req, res, next) => {
    try {
      const raw = req.query.limit;
      requireValid(raw === undefined || (typeof raw === 'string' && /^\d{1,3}$/.test(raw)), 'limit must be an integer from 0 to 500');
      const limit = raw === undefined ? 50 : Number(raw);
      requireValid(limit <= 500, 'limit must be an integer from 0 to 500');
      res.json({ events: telemetryBus.snapshot(limit) });
    } catch (error) { next(error); }
  });
  app.post('/api/tasks', asyncRoute(async (req, res) => {
    requireValid(record(req.body), 'task must be an object');
    const task = orchestrator.submitTask(validateDescription(req.body.description), req.body.workflow, req.body.swarm);
    if (task.accepted) await task.accepted;
    res.status(201).json({ task_id: task.id, state: task.accepted ? 'RUNNING' : task.state });
  }));
  app.post('/api/hitl/:approvalId', (req, res, next) => {
    try {
      const id = validateId(req.params.approvalId);
      const decision = validateDecision(req.body?.decision);
      if (!orchestrator.resolveHitl(id, decision)) throw new HttpError(409, 'approval not found or already resolved');
      res.json({ approval_id: id, decision });
    } catch (error) { next(error); }
  });
  app.get('/api/storage/:collection', (req, res, next) => {
    try { res.json(storage.get(req.params.collection)); } catch (error) { next(error); }
  });
  app.put('/api/storage/:collection', asyncRoute(async (req, res) => {
    storage.get(req.params.collection);
    requireValid(record(req.body) && Number.isInteger(req.body.revision) && req.body.revision >= 0 && 'data' in req.body, 'data and non-negative revision are required');
    res.json(await storage.put(req.params.collection, req.body.data, req.body.revision));
  }));
  app.use((req, res, next) => next(new HttpError(404, 'endpoint not found')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error.type === 'entity.too.large' ? 413 : 500);
    logger[status >= 500 ? 'error' : 'warn']('http.error', { requestId: req.requestId, status, error });
    if (error instanceof StorageWriteError) return res.status(status).json({ error: error.message, code: error.code, request_id: req.requestId });
    const message = error.type === 'entity.parse.failed' ? 'invalid JSON body' : error.message;
    res.status(status).json({ error: status >= 500 ? 'internal server error' : message, request_id: req.requestId });
  });

  server.on('upgrade', (req, socket, head) => {
    if (shuttingDown || req.url !== '/ws' || !originAllowed(req.headers.origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    const key = bearer(req);
    const browserAuth = key === undefined && req.headers['sec-websocket-protocol'] === 'maoc-auth';
    try {
      const auth = browserAuth && localRequest(req) ? null : authenticate(req, key);
      if ((!browserAuth && !auth) || (browserAuth && !localRequest(req))) {
        socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return;
      }
      if (wss.clients.size >= 100) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return; }
      wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client, req, auth));
    } catch {
      socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    }
  });
  function authorizedSocket(socket) {
    if (!socket.access || socket.readyState !== WebSocket.OPEN) return false;
    const reason = access.invalidReason(socket.access);
    if (reason) { socket.access = null; socket.close(4401, reason); return false; }
    return true;
  }
  function send(socket, value) {
    if (!authorizedSocket(socket)) return;
    if (socket.bufferedAmount > 1024 * 1024) return socket.close(1013, 'slow consumer');
    socket.send(JSON.stringify(value), (error) => {
      if (error) logger.warn('websocket.send_failed', { error });
    });
  }
  wss.on('connection', (socket, req, auth) => {
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('error', (error) => logger.warn('websocket.error', { error }));
    const attach = (principal) => {
      socket.access = principal;
      send(socket, { type: 'SNAPSHOT', collection_realtime: collectionRealtime, tasks: orchestrator.listTasks(), events: telemetryBus.snapshot(50), human_inputs: orchestrator.listHumanInputs(), schedules: scheduler.list() });
      socket.once('close', telemetryBus.subscribe((event) => send(socket, { type: 'EVENT', event })));
    };
    if (auth) attach(auth);
    const authTimeout = auth ? null : setTimeout(() => socket.close(4401, 'AUTH_REQUIRED'), 5000);
    authTimeout?.unref();
    socket.once('close', () => clearTimeout(authTimeout));
    socket.on('message', async (raw, isBinary) => {
      try {
        if (shuttingDown) throw new HttpError(503, 'server is shutting down');
        if (!socket.access) {
          if (socket.readyState !== WebSocket.OPEN) return;
          clearTimeout(authTimeout);
          let principal;
          try {
            if (!isBinary && raw.length <= 512) {
              const message = JSON.parse(raw.toString());
              if (message?.type === 'AUTH' && typeof message.key === 'string') principal = authenticate(req, message.key);
            }
          } catch { /* only disclose a generic authentication failure */ }
          if (!principal) return socket.close(4401, 'INVALID_KEY');
          attach(principal); return;
        }
        if (!authorizedSocket(socket)) return;
        requireValid(!isBinary, 'binary messages are not supported');
        let message;
        try { message = JSON.parse(raw.toString()); } catch { throw new HttpError(400, 'invalid JSON'); }
        requireValid(record(message), 'message must be an object');
        if (message.type === 'SUBMIT_TASK') {
          const task = orchestrator.submitTask(validateDescription(message.description), message.workflow, message.swarm);
          if (task.accepted) await task.accepted;
        } else if (message.type === 'HUMAN_INPUT_RESPONSE') {
          const id = validateId(message.input_id);
          if (!orchestrator.resolveHumanInput(id, message.response)) throw new HttpError(409, 'human input not found or already resolved');
          send(socket, { type: 'HUMAN_INPUT_ACK', input_id: id, accepted: true });
        } else if (message.type === 'HITL_RESPONSE') {
          const id = validateId(message.approval_id);
          const decision = validateDecision(message.decision);
          if (!orchestrator.resolveHitl(id, decision)) throw new HttpError(409, 'approval not found or already resolved');
        } else {
          throw new HttpError(400, 'unknown message type');
        }
      } catch (error) {
        logger.warn('websocket.invalid_message', { status: error.status || 500 });
        send(socket, { type: 'ERROR', status: error.status || 500, error: error.status ? error.message : 'internal server error' });
      }
    });
  });
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.access && !authorizedSocket(socket)) continue;
      if (!socket.isAlive) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);
  heartbeat.unref();

  function close() {
    if (closePromise) return closePromise;
    shuttingDown = true;
    closePromise = (async () => {
      logger.info('server.shutdown_started');
      clearInterval(heartbeat);
      const force = setTimeout(() => {
        logger.warn('server.shutdown_transport_timeout', { pendingRoutes: inFlightRoutes.size });
        for (const socket of wss.clients) socket.terminate();
        server.closeAllConnections();
      }, settings.shutdownTimeoutMs);
      force.unref();
      try {
        const httpClosed = new Promise((resolve, reject) => {
          if (!server.listening) return resolve();
          server.close((error) => error ? reject(error) : resolve());
        });
        const wsClosed = new Promise((resolve) => wss.close(resolve));
        for (const socket of wss.clients) socket.close(1001, 'server shutdown');
        const schedulerClosed = scheduler.close();
        const templatesClosed = templates.close();
        llmEngine.close();
        // Disconnecting a client does not cancel a route that has already started.
        // Cancel missions now, but keep the Vault owned until their work and routes settle.
        const settled = await Promise.allSettled([
          httpClosed, wsClosed, schedulerClosed, templatesClosed, orchestrator.shutdown?.(), ...inFlightRoutes
        ]);
        const failures = settled.filter(({ status }) => status === 'rejected');
        if (failures.length) throw new AggregateError(failures.map(({ reason }) => reason), 'Shutdown drain failed');
        await analytics.close();
        await access.queue;
        await storage.close();
        logger.info('server.shutdown_completed');
      } finally { clearTimeout(force); }
    })();
    return closePromise;
  }

  return {
    app, server, wss, storage, orchestrator, scheduler, templates, analytics, close,
    async listen(port = settings.port, host = settings.host) {
      if ((settings.accessGate || settings.adminKey) && !loopback(host)) throw new Error('Key-based access requires a loopback listener');
      await new Promise((resolve, reject) => {
        const onError = (error) => { server.off('listening', onListen); reject(error); };
        const onListen = () => { server.off('error', onError); resolve(); };
        server.once('error', onError);
        server.once('listening', onListen);
        server.listen(port, host);
      });
      logger.info('server.ready', { host, port: server.address().port, collectionRealtime });
      if (options.schedulerAutoStart !== false) scheduler.start();
      return server.address();
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let application;
  const stop = async (signal) => {
    try {
      logger.info('server.signal', { signal });
      await application?.close();
    } catch (error) {
      logger.error('server.shutdown_failed', { error });
      process.exitCode = 1;
    }
  };
  try {
    application = await createApplication({
      storageDriver: config.storageDriver,
      schedulerAutoStart: config.schedulerAutoStart,
      collectionRealtime: config.collectionRealtime
    });
    process.once('SIGTERM', () => { void stop('SIGTERM'); });
    process.once('SIGINT', () => { void stop('SIGINT'); });
    // IPC is available only when a local parent starts this process with an IPC channel.
    if (process.send) {
      process.on('message', (message) => {
        if (message?.type === 'SHUTDOWN') {
          void stop('IPC').finally(() => { if (process.connected) process.disconnect(); });
        }
      });
    }
    await application.listen();
  } catch (error) {
    logger.error('server.start_failed', { error });
    await application?.close();
    process.exitCode = 1;
  }
}