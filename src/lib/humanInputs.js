import { accessFetch } from './accessClient.js';

// Pending requests are authoritative snapshot state, not reconstructed from a bounded event log.
export function reduceHumanInputs(current, event) {
  const input = event.human_input;
  if (event.event_type === 'HUMAN_INPUT_REQUESTED' && input?.input_id) return { ...current, [input.input_id]: input };
  if (event.event_type === 'HUMAN_INPUT_RESOLVED' && input?.input_id) {
    const next = { ...current }; delete next[input.input_id]; return next;
  }
  if (event.event_type === 'TASK_COMPLETED') return Object.fromEntries(Object.entries(current).filter(([, value]) => value.task_id !== event.task_id));
  return current;
}

export async function sendHumanResponse(baseUrl, inputId, response, fetcher = accessFetch) {
  const result = await fetcher(`${baseUrl}/api/human-inputs/${encodeURIComponent(inputId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(response), signal: AbortSignal.timeout(10000)
  });
  const data = await result.json();
  if (!result.ok) throw new Error(data.error || 'Human response was not accepted');
  return data;
}