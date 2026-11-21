import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:8787';
const WS_URL = 'ws://localhost:8787/ws';
const TIMEOUT_MS = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postJson(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed with status ${response.status}`);
  }
  return response.json();
}

async function main() {
  const socket = new WebSocket(WS_URL);

  let approvalId = null;
  let approved = false;
  let completed = false;
  let failed = false;

  const closed = new Promise((resolve) => {
    socket.on('close', resolve);
  });

  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());

    if (message.type === 'SNAPSHOT') {
      console.log(`[ws] snapshot received: ${message.events.length} past events`);
      return;
    }

    const event = message.event;
    if (!event) return;
    console.log(
      `[ws] ${event.event_type.padEnd(16)} ${event.source_agent} -> ${
        event.target_agent ?? '-'
      } | ${String(event.progress_pct).padStart(3)}% | ${event.payload_summary}`
    );

    if (event.event_type === 'HITL_INTERRUPT' && !approvalId) {
      approvalId = event.approval_id;
    }

    if (event.event_type === 'TASK_COMPLETED') {
      completed = true;
      failed = event.outcome !== 'COMPLETED';
    }
  });

  socket.on('open', async () => {
    console.log('[ws] connected, submitting task via REST...');
    const task = await postJson('/api/tasks', {
      description: 'Selftest: scan XAU/USD and execute momentum strategy'
    });
    console.log(`[http] task created: ${task.task_id}`);
  });

  const startedAt = Date.now();
  while (!completed && Date.now() - startedAt < TIMEOUT_MS) {
    if (approvalId && !approved) {
      approved = true;
      console.log(`[http] HITL interrupt detected, approving: ${approvalId}`);
      await postJson(`/api/hitl/${approvalId}`, { decision: 'approve' });
    }
    await sleep(300);
  }

  socket.close();
  await closed;

  if (completed && !failed) {
    console.log('[selftest] PASSED: full pipeline ARIA -> HAWK -> BLADE -> SAGE(HITL) -> AUTO completed');
    process.exit(0);
  }

  console.log(failed ? '[selftest] FAILED: mission reported a failure (not a successful completion)' : '[selftest] FAILED: timeout waiting for TASK_COMPLETED');
  process.exit(1);
}

main().catch((error) => {
  console.error('[selftest] error:', error.message);
  process.exit(1);
});