import { persistence, PERSISTENCE_KEYS } from './persistenceClient.js';
import { backendChat, syncBackendEngine } from './backendLlm.js';

export const syncEngineConfig = syncBackendEngine;

const ENGINE_CONFIG_KEY = 'maoc_llm_engine_config_v1';

export const DEFAULT_ENGINE_CONFIG = {
  provider: 'gemini',
  apiKey: '',
  modelName: 'gemini-2.5-flash',
  ollamaUrl: 'http://localhost:11434/v1/chat/completions',
  webhookUrl: '',
  autoWebhookOnComplete: true,
  autoFailover: true,
  fallbackProviders: ['openrouter', 'openai'],
  rpm: 10,
  maxHandoffs: 12,
  maxToolRounds: 4,
  maxToolCalls: 24,
  maxTaskTokens: 60000,
  maxOutputTokens: 1600,
  taskTimeoutMs: 300000,
  providerModels: {}
};

export const PROVIDER_PRESETS = {
  gemini: {
    label: 'Google Gemini API',
    defaultModel: 'gemini-2.5-flash',
    placeholderKey: 'AIzaSy...'
  },
  openrouter: {
    label: 'OpenRouter (Claude / Hermes / Qwen)',
    defaultModel: 'nousresearch/hermes-3-llama-3.1-70b',
    placeholderKey: 'sk-or-v1-...'
  },
  openai: {
    label: 'OpenAI API (GPT)',
    defaultModel: 'gpt-4o-mini',
    placeholderKey: 'sk-proj-...'
  },
  ollama: {
    label: 'Local Ollama (No API Key Needed)',
    defaultModel: 'llama3.1',
    placeholderKey: 'local-ollama'
  }
};

export function loadEngineConfig() {
  try {
    const raw = localStorage.getItem(ENGINE_CONFIG_KEY);
    if (!raw) return DEFAULT_ENGINE_CONFIG;
    return { ...DEFAULT_ENGINE_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ENGINE_CONFIG;
  }
}

export function saveEngineConfig(patch) {
  try {
    const current = loadEngineConfig();
    const updated = { ...current, ...patch };
    const providerKeys = { ...(current.providerKeys || {}), ...(patch.providerKeys || {}) };
    if (current.provider !== 'ollama' && current.apiKey?.trim()) providerKeys[current.provider] = current.apiKey.trim();
    if (updated.provider !== 'ollama' && updated.apiKey?.trim()) providerKeys[updated.provider] = updated.apiKey.trim();
    delete providerKeys.ollama;
    updated.providerKeys = providerKeys;
    localStorage.setItem(ENGINE_CONFIG_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_ENGINE_CONFIG;
  }
}

export async function callRealLlm({ systemPrompt, userPrompt }) {
  const result = await backendChat({ config: loadEngineConfig(), systemPrompt, userPrompt });
  return result.text;
}

// เรียก AI จริงเมื่อตั้งค่า Key ไว้ หรือสลับใช้ Smart Context Synthesis อัตโนมัติทันที
export async function callSmartOrRealLlm({
  agentName = 'ARIA',
  role = 'Orchestrator',
  model = 'SONNET',
  skills = [],
  systemPrompt = '',
  userPrompt = '',
  contextText = ''
}) {
  try {
    const fullPrompt = contextText
      ? `Context:\n${contextText}\n\nUser Directive: ${userPrompt}`
      : userPrompt;
    const realReply = await callRealLlm({
      systemPrompt: `${systemPrompt} (Agent: ${agentName}, Role: ${role}, Skills: ${skills.join(
        ', '
      )})`,
      userPrompt: fullPrompt
    });
    return { text: realReply, mode: 'REAL_LLM' };
  } catch {
    const activeSkills = skills.length > 0 ? skills.join(', ') : 'core-mcp-suite';
    const synthesized = [
      `1. [OFFLINE SYNTHESIS — ไม่ใช่ผล LLM จริง] ${agentName} (${model}) ไม่สามารถเชื่อมต่อ backend AI ได้ ข้อความต่อไปนี้เป็นเพียง context สำรอง ไม่มีการเรียกเครื่องมือ [${activeSkills}]`,
      contextText
        ? `2. ข้อมูลอ้างอิงจากคลังความรู้: ${contextText.slice(0, 240)}...`
        : `2. ยังไม่มีผลวิเคราะห์หรือการบันทึกจาก Agent สำหรับคำสั่ง "${userPrompt}" กรุณาตรวจการตั้งค่า backend และลองใหม่`
    ].join('\n\n');
    return { text: synthesized, mode: 'SMART_SYNTHESIS' };
  }
}

export async function sendHermesRealWebhook({
  title,
  summary,
  department = 'COMMAND CORE',
  agent = 'HERMES'
}) {
  const cfg = loadEngineConfig();
  const url = (cfg.webhookUrl || '').trim();
  if (!url) {
    return { sent: false, reason: 'No webhook URL configured' };
  }

  try {
    const payload = {
      username: `MAOC // ${agent} RELAY`,
      content: `⚡ **[${department}] ${title}**\n> ${summary}`
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return { sent: res.ok, status: res.status };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

export function exportFullWorkspaceBackup() {
  const keys = [
    'maoc_agent_overrides_v1',
    'maoc_saved_commands_v1',
    'maoc_dept_chats_v1',
    'maoc_dept_deliverables_v1',
    'maoc_obsidian_vault_v1',
    'maoc_llm_engine_config_v1'
  ];
  const dump = {
    version: 'v4.0-phase2-checkpoint',
    exported_at: new Date().toISOString(),
    storage: {}
  };
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (raw) {
      try {
        dump.storage[k] = JSON.parse(raw);
        if (k === ENGINE_CONFIG_KEY) {
          delete dump.storage[k].apiKey;
          delete dump.storage[k].providerKeys;
          delete dump.storage[k].webhookUrl;
        }
      } catch {
        dump.storage[k] = raw;
      }
    }
  }
  const blob = new Blob([JSON.stringify(dump, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maoc-full-workspace-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importFullWorkspaceBackup(jsonString) {
  const parsed = JSON.parse(jsonString);
  const storageObj = parsed.storage || parsed;
  for (const [key, val] of Object.entries(storageObj)) {
    if (key.startsWith('maoc_')) {
      const collection = Object.keys(PERSISTENCE_KEYS).find((name) => PERSISTENCE_KEYS[name] === key);
      if (collection) {
        persistence.write(collection, typeof val === 'string' ? JSON.parse(val) : val);
        continue;
      }
      if (key === 'maoc_persistence_sync_v1') continue;
      localStorage.setItem(
        key,
        typeof val === 'string' ? val : JSON.stringify(val)
      );
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('maoc-vault-updated'));
  }
}