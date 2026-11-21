import { randomUUID } from 'node:crypto';
import { HttpError, record, requireValid } from './validation.js';
import { workflowLayers } from '../../src/lib/workflowGraph.js';

export const MESSAGE_LIMITS = Object.freeze({ total: 24, sender: 4, recipient: 6, characters: 2000 });
const redact = (text) => text.replace(/\b(?:sk-[\w-]{12,}|AIza[\w-]{20,})\b/g, '[REDACTED]');

// Task-local, forward-only mail. Never schedules work, changes edges or grants tools.
export class AgentMailbox {
  constructor(task, publish) {
    this.task = task;
    this.publish = publish;
    this.closed = false;
    this.layers = new Map(workflowLayers(task.workflow).flatMap((layer, index) => layer.map((node) => [node.id, index])));
    this.edges = task.workflow.nodes.reduce((sum, node) => sum + node.dependsOn.length, 0);
    task.agentMessages = [];
  }
  available(nodeId, agentId) {
    return !this.closed && !this.task.signal.aborted && ['RUNNING', 'AWAITING_HITL'].includes(this.task.state) &&
      this.task.workflowNodes.some((node) => node.id === nodeId && node.agent === agentId && node.agent !== 'HUMAN' && node.state === 'RUNNING');
  }
  recipients(nodeId) {
    return this.task.workflowNodes.filter((node) => node.agent !== 'HUMAN' && node.state === 'PENDING' &&
      this.layers.get(node.id) > this.layers.get(nodeId)).map(({ id, agent }) => ({ node_id: id, agent }));
  }
  notify(message) {
    this.publish({ event_type: 'AGENT_MESSAGE', source_agent: message.from_agent, target_agent: message.to_agent,
      node_id: message.from_node, stage: `message_${message.status.toLowerCase()}`, agent_message: structuredClone(message),
      payload_summary: `${message.from_node} -> ${message.to_node} [${message.status}]: ${message.text}` });
  }
  send(input, nodeId, agentId) {
    this.task.signal.throwIfAborted();
    if (!this.available(nodeId, agentId)) throw new HttpError(403, 'Messaging unavailable for this execution');
    requireValid(record(input) && Object.keys(input).every((key) => ['to', 'text'].includes(key)), 'Message accepts only to and text');
    requireValid(typeof input.to === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(input.to), 'Recipient must be a workflow node ID');
    requireValid(typeof input.text === 'string' && input.text.trim().length > 0 && input.text.length <= MESSAGE_LIMITS.characters, 'Message requires 1–2000 characters');
    const target = this.recipients(nodeId).find((node) => node.node_id === input.to);
    requireValid(target, 'Recipient must be a pending AI node in a strictly later dependency layer');
    const messages = this.task.agentMessages;
    if (messages.length >= MESSAGE_LIMITS.total || messages.filter((m) => m.from_node === nodeId).length >= MESSAGE_LIMITS.sender ||
        messages.filter((m) => m.to_node === input.to).length >= MESSAGE_LIMITS.recipient) throw new HttpError(409, 'Message quota exceeded');
    // Reserve every DAG edge, including handoffs not executed yet; mail cannot spend that allowance.
    if (this.edges + messages.length + 1 > this.task.snapshot.settings.maxHandoffs) throw new HttpError(409, 'Loop breaker: messages and planned edges exceed maximum handoffs');
    const text = redact(input.text.trim());
    if (messages.some((m) => m.from_node === nodeId && m.to_node === input.to && m.text === text)) throw new HttpError(409, 'Duplicate message');
    const message = { message_id: randomUUID(), task_id: this.task.id, from_node: nodeId, from_agent: agentId,
      to_node: input.to, to_agent: target.agent, text, status: 'QUEUED', created_at: new Date().toISOString() };
    messages.push(message);
    this.notify(message);
    return { message_id: message.message_id, status: message.status, to: message.to_node };
  }
  receive(nodeId, agentId) {
    this.task.signal.throwIfAborted();
    if (!this.available(nodeId, agentId)) throw new HttpError(403, 'Messaging unavailable for this execution');
    const messages = this.task.agentMessages.filter((m) => m.to_node === nodeId && m.status === 'QUEUED');
    for (const message of messages) {
      message.status = 'DELIVERED'; // Included in the recipient context, not proof of reading or agreement.
      message.delivered_at = new Date().toISOString();
      this.notify(message);
    }
    return structuredClone(messages);
  }
  skip(nodeId) {
    for (const message of this.task.agentMessages) if (message.to_node === nodeId && message.status === 'QUEUED') {
      message.status = 'CANCELLED';
      this.notify(message);
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const message of this.task.agentMessages) if (message.status === 'QUEUED') {
      message.status = 'CANCELLED';
      this.notify(message);
    }
  }
}