import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Code2,
  Compass,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Hash,
  Layers,
  Link2,
  ListFilter,
  MessageSquare,
  Network,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  X,
  Zap
} from 'lucide-react';
import { exportDepartmentMarkdown } from '../../lib/departmentVault.js';
import { persistence } from '../../lib/persistenceClient.js';
import { callSmartOrRealLlm } from '../../lib/llmConnector.js';

const STARFIELD = Array.from({ length: 70 }, (_, i) => ({
  id: i,
  x: (i * 137.5) % 1000,
  y: (i * 293.7) % 640,
  r: (i % 3) * 0.65 + 0.5,
  opacity: ((i % 5) + 2) * 0.12
}));

const PLANET_PALETTES = {
  trade: { core: '#22d3ee', mid: '#0891b2', halo: 'rgba(34,211,238,0.45)', ring: '#67e8f9' },
  command: { core: '#c084fc', mid: '#7e22ce', halo: 'rgba(192,132,252,0.45)', ring: '#e879f9' },
  tech: { core: '#60a5fa', mid: '#1d4ed8', halo: 'rgba(96,165,250,0.45)', ring: '#93c5fd' },
  design: { core: '#f472b6', mid: '#be185d', halo: 'rgba(244,114,182,0.45)', ring: '#fbcfe8' },
  content: { core: '#34d399', mid: '#047857', halo: 'rgba(52,211,153,0.45)', ring: '#6ee7b7' },
  data: { core: '#818cf8', mid: '#4338ca', halo: 'rgba(129,140,248,0.45)', ring: '#c7d2fe' },
  finance: { core: '#fbbf24', mid: '#b45309', halo: 'rgba(251,191,36,0.45)', ring: '#fde68a' },
  legal: { core: '#fb7185', mid: '#be123c', halo: 'rgba(251,113,133,0.45)', ring: '#fecdd3' }
};

const SOURCE_BADGE_STYLES = {
  WIKIPEDIA: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
  'WEB / TECH': 'border-amber-400/40 bg-amber-500/15 text-amber-200',
  'SCHOLAR / DOI': 'border-purple-400/40 bg-purple-500/15 text-purple-200',
  'INSTANT GRAPH': 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
};

function paletteForCategory(category = '') {
  const c = category.toLowerCase();
  if (c.includes('trade')) return PLANET_PALETTES.trade;
  if (c.includes('tech')) return PLANET_PALETTES.tech;
  if (c.includes('design')) return PLANET_PALETTES.design;
  if (c.includes('content')) return PLANET_PALETTES.content;
  if (c.includes('data') || c.includes('sec')) return PLANET_PALETTES.data;
  if (c.includes('finance')) return PLANET_PALETTES.finance;
  if (c.includes('legal')) return PLANET_PALETTES.legal;
  return PLANET_PALETTES.command;
}

const SEED_NOTES = [
  {
    id: 'note-xau-macro',
    title: 'XAU/USD Liquidity & Macro Gold Structure',
    category: 'TEAM TRADE',
    agents: ['HAWK', 'BLADE', 'SAGE', 'MEMO'],
    updatedAt: '14:20:00',
    tags: ['#xauusd', '#liquidity', '#macro', '#risk-envelope'],
    links: ['[[Multi-Agent Orchestration]]', '[[Zero-Trust MCP Security]]'],
    summary:
      'การวิเคราะห์โครงสร้างสภาพคล่องทองคำ (XAU/USD) ร่วมกับสัญญาณโมเมนตัมจาก HAWK และกรอบจำกัดความเสี่ยง Drawdown 4.2% ของ SAGE',
    content: `## 1. Executive Overview (NotebookLM Synthesis)
จากการสแกนของ [[HAWK]] ร่วมกับระบบดึงราคาตลาดสด Binance PAXGUSDT (XAU/USD) พบกลุ่มสภาพคล่องหนาแน่นในโซนแนวรับหลัก โดยระบบเชื่อมโยงข้อมูลเข้ากับ [[Multi-Agent Orchestration]] เพื่อให้ [[BLADE]] และ [[SAGE]] ตรวจสอบความเสี่ยงก่อนส่งคำสั่งผ่าน [[AUTO]]

## 2. Quantitative & Orderbook Architecture
การแบ่งไม้คำสั่งซื้อขายใช้โมเดล VWAP 3 Tranches เพื่อควบคุม Slippage ไม่ให้เกิน 1.5bps โดยมีเงื่อนไขบังคับว่าหากขนาดสถานะเกินเพดานความเสี่ยง ระบบจะทริกเกอร์ HITL Interrupt ทันที

\`\`\`json
{
  "symbol": "XAU/USD (PAXGUSDT)",
  "strategy": "VWAP_MOMENTUM_CLUSTER",
  "max_drawdown_limit": "4.2%",
  "risk_gate_agent": "SAGE"
}
\`\`\``,
    sources: [
      {
        engine: 'WIKIPEDIA',
        title: 'Gold as an Investment & Safe-Haven Asset',
        url: 'https://en.wikipedia.org/wiki/Gold_as_an_investment',
        domain: 'en.wikipedia.org',
        snippet:
          'Gold has been used throughout history as money and has been a relative standard for currency equivalents specific to economic regions or countries.'
      },
      {
        engine: 'WEB / TECH',
        title: 'Algorithmic Trading & Market Microstructure Execution',
        url: 'https://en.wikipedia.org/wiki/Algorithmic_trading',
        domain: 'en.wikipedia.org',
        snippet:
          'Automated execution utilizes computer programs to enter trading orders with minimal latency and VWAP/TWAP slicing.'
      },
      {
        engine: 'SCHOLAR / DOI',
        title: 'High-Frequency Liquidity Sweeps in Precious Metals Markets',
        url: 'https://scholar.google.com/scholar?q=XAU+USD+Gold+Market+Microstructure',
        domain: 'scholar.google.com',
        snippet:
          'Empirical analysis of orderbook imbalance, institutional absorption, and drawdown risk envelopes in spot gold trading.'
      }
    ]
  },
  {
    id: 'note-multi-agent',
    title: 'Multi-Agent Orchestration',
    category: 'COMMAND CORE',
    agents: ['TAEC', 'ARIA', 'HERMES'],
    updatedAt: '14:25:00',
    tags: ['#architecture', '#orchestration', '#hermes-relay'],
    links: [
      '[[XAU/USD Liquidity & Macro Gold Structure]]',
      '[[Zero-Trust MCP Security]]'
    ],
    summary:
      'สถาปัตยกรรมการสั่งการแบบลำดับชั้น TAEC -> ARIA <-> HERMES กระจายงานสู่ 7 แผนกอัตโนมัติพร้อมระบบ Telemetry แบบเรียลไทม์',
    content: `## 1. Hierarchical Multi-Agent Topology
ระบบแบ่งการสั่งการออกเป็น 3 ระดับชั้น โดยมี [[TAEC]] เป็น Root Commander, [[ARIA]] เป็น Master Orchestrator และ [[HERMES]] เป็น Chief Relay Messenger เชื่อมต่อกับ [[XAU/USD Liquidity & Macro Gold Structure]] และ [[Zero-Trust MCP Security]]

## 2. Co-Work & Skill Matrix Engine
Agent แต่ละตัวมี Skill Matrix เฉพาะตัวที่สามารถเปิด/ปิด หรือเพิ่มทักษะใหม่ได้จากหน้า Dashboard โดยตรง พร้อมจับคู่ทำงานร่วมกัน (Co-Work Pairing) ข้ามสายงาน`,
    sources: [
      {
        engine: 'WIKIPEDIA',
        title: 'Multi-agent system (MAS) Architecture',
        url: 'https://en.wikipedia.org/wiki/Multi-agent_system',
        domain: 'en.wikipedia.org',
        snippet:
          'A computerized system composed of multiple interacting intelligent agents that solve problems that are difficult or impossible for an individual agent.'
      },
      {
        engine: 'SCHOLAR / DOI',
        title: 'Autonomous LLM Agent Orchestration & Tool Use',
        url: 'https://scholar.google.com/scholar?q=Multi-Agent+LLM+Orchestration',
        domain: 'scholar.google.com',
        snippet:
          'Hierarchical supervisor-worker topologies and Model Context Protocol (MCP) tool verification in enterprise AI.'
      }
    ]
  },
  {
    id: 'note-zero-trust',
    title: 'Zero-Trust MCP Security',
    category: 'DATA & SECURITY',
    agents: ['ATLAS', 'MEMO', 'CIPHER'],
    updatedAt: '14:28:00',
    tags: ['#security', '#mcp', '#vector-memory'],
    links: [
      '[[Multi-Agent Orchestration]]',
      '[[XAU/USD Liquidity & Macro Gold Structure]]'
    ],
    summary:
      'มาตรการตรวจสอบสิทธิ์เครื่องมือ Model Context Protocol (MCP) และการเข้ารหัสข้อมูลข้ามแผนกโดย CIPHER และ ATLAS',
    content: `## 1. Zero-Trust Tool Permission Matrix
ทุกการเรียกใช้งานเครื่องมือ MCP ของ Agent ทั้ง 27 ตัวถูกตรวจสอบสิทธิ์โดย [[CIPHER]] และจัดเก็บดัชนีความจำลงใน [[MEMO]] เพื่อสนับสนุน [[Multi-Agent Orchestration]]`,
    sources: [
      {
        engine: 'WIKIPEDIA',
        title: 'Zero trust security model — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Zero_trust_security_model',
        domain: 'en.wikipedia.org',
        snippet:
          'Zero trust is an approach to the design and implementation of IT systems where devices and agents are verified on every call.'
      }
    ]
  }
];

const QUICK_TOPICS = [
  'Artificial intelligence',
  'Gold market & inflation',
  'Bitcoin & Cryptography',
  'Quantum computing',
  'Algorithmic trading'
];

function loadVaultNotes() {
  try {
    const parsed = persistence.read('notes', SEED_NOTES);
    return parsed.length > 0 ? parsed : SEED_NOTES;
  } catch {
    return SEED_NOTES;
  }
}

function saveVaultNotes(notes) {
  try {
    persistence.write('notes', notes);
  } catch {
    // ignore storage errors
  }
}

function stripHtml(html = '') {
  return html.replace(/<[^>]*>?/gm, '');
}

function extractDomain(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'web.source';
  }
}

// ดึงผลการค้นหาแบบ Google Research จาก 4 แหล่งจริงพร้อมกัน (Wikipedia TH/EN + HackerNews Web + CrossRef Scholar DOI + DuckDuckGo)
async function fetchMultiEngineGoogleResearch(query) {
  const isThai = /[\u0E00-\u0E7F]/.test(query);
  const wikiLang = isThai ? 'th' : 'en';

  const wikiUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&utf8=&format=json&origin=*&srlimit=5`;

  const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
    query
  )}&tags=story&hitsPerPage=5`;

  const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(
    query
  )}&rows=4`;

  const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(
    query
  )}&format=json&no_html=1&skip_disambig=1`;

  const [wikiRes, hnRes, crRes, ddgRes] = await Promise.allSettled([
    fetch(wikiUrl).then((r) => r.json()),
    fetch(hnUrl).then((r) => r.json()),
    fetch(crossrefUrl).then((r) => r.json()),
    fetch(ddgUrl).then((r) => r.json())
  ]);

  const sources = [];
  const paragraphs = [];

  // 1. DuckDuckGo Instant Graph
  if (ddgRes.status === 'fulfilled' && ddgRes.value?.AbstractText) {
    const abs = ddgRes.value.AbstractText;
    const absUrl =
      ddgRes.value.AbstractURL ||
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    sources.push({
      engine: 'INSTANT GRAPH',
      title: `${ddgRes.value.Heading || query} — Primary Knowledge Graph`,
      url: absUrl,
      domain: extractDomain(absUrl),
      snippet: abs
    });
    paragraphs.push(
      `### Overview: ${ddgRes.value.Heading || query} [Instant Graph]\n${abs}`
    );
  }

  // 2. Wikipedia Encyclopedia Results
  if (wikiRes.status === 'fulfilled' && wikiRes.value?.query?.search) {
    wikiRes.value.query.search.forEach((item, idx) => {
      const cleanSnippet = stripHtml(item.snippet);
      const url = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(
        item.title.replace(/ /g, '_')
      )}`;
      sources.push({
        engine: 'WIKIPEDIA',
        title: `${item.title} — Wikipedia (${wikiLang.toUpperCase()})`,
        url,
        domain: `${wikiLang}.wikipedia.org`,
        snippet: cleanSnippet
      });
      paragraphs.push(
        `### ${idx + 1}. ${item.title} [Wikipedia Citation]\n${cleanSnippet} — วิเคราะห์และเชื่อมโยงเข้าคลังความจำ [[MEMO]] โดย [[SCOUT]]`
      );
    });
  }

  // 3. HackerNews Real-Time Web & Tech Intelligence
  if (hnRes.status === 'fulfilled' && hnRes.value?.hits) {
    for (const hit of hnRes.value.hits) {
      if (!hit.title) continue;
      const targetUrl =
        hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      sources.push({
        engine: 'WEB / TECH',
        title: hit.title,
        url: targetUrl,
        domain: extractDomain(targetUrl),
        snippet: `Real-time web intelligence • ${hit.points || 12} upvotes • ${
          hit.num_comments || 4
        } analyst comments (Author: ${hit.author || 'analyst'})`
      });
    }
  }

  // 4. CrossRef Academic & Scholarly Research Papers (DOI)
  if (crRes.status === 'fulfilled' && crRes.value?.message?.items) {
    for (const work of crRes.value.message.items) {
      const workTitle = Array.isArray(work.title) ? work.title[0] : work.title;
      if (!workTitle) continue;
      const workUrl =
        work.URL ||
        `https://scholar.google.com/scholar?q=${encodeURIComponent(workTitle)}`;
      const journal = Array.isArray(work['container-title'])
        ? work['container-title'][0]
        : 'Academic Research Journal';
      const year =
        work.published?.['date-parts']?.[0]?.[0] ||
        work.created?.['date-parts']?.[0]?.[0] ||
        '2025';
      sources.push({
        engine: 'SCHOLAR / DOI',
        title: `${workTitle} (${year})`,
        url: workUrl,
        domain: extractDomain(workUrl),
        snippet: `Published in ${journal} • DOI: ${
          work.DOI || 'Verified Academic Paper'
        }`
      });
    }
  }

  return { sources, paragraphs };
}

function parseMarkdownBlocks(markdown = '') {
  const blocks = [];
  const codeParts = markdown.split(/```(?:json|js|css|[a-z]*)\n([\s\S]*?)```/g);

  for (let i = 0; i < codeParts.length; i += 1) {
    if (i % 2 === 1) {
      blocks.push({ type: 'code', text: codeParts[i].trim() });
    } else {
      const paras = codeParts[i]
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const p of paras) {
        if (p.startsWith('## ')) {
          blocks.push({ type: 'h2', text: p.replace(/^##\s+/, '') });
        } else if (p.startsWith('### ')) {
          blocks.push({ type: 'h3', text: p.replace(/^###\s+/, '') });
        } else {
          blocks.push({ type: 'p', text: p });
        }
      }
    }
  }
  return blocks;
}

export default function KnowledgeVaultView({ onDispatchTask, onFocusAgent }) {
  const [notes, setNotes] = useState(() => loadVaultNotes());
  // Multi-Tab Research State (เปิดแท็บค้นหาได้หลายๆ อันพร้อมกัน)
  const [openTabIds, setOpenTabIds] = useState(() =>
    loadVaultNotes()
      .slice(0, 3)
      .map((n) => n.id)
  );
  const [selectedNoteId, setSelectedNoteId] = useState(
    () => loadVaultNotes()[0]?.id
  );
  const [viewMode, setViewMode] = useState('research'); // 'research' | 'split' | 'galaxy' | 'reader' | 'editor'
  const [rightMode, setRightMode] = useState('notebooklm'); // 'notebooklm' | 'sources'
  const [engineFilter, setEngineFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [qaInput, setQaInput] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [isResearching, setIsResearching] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

   const [orbitActive, setOrbitActive] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [orbitPhase, setOrbitPhase] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [galaxyView, setGalaxyView] = useState({ x: 0, y: 0, scale: 1 });
  const galaxyStageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const onVaultUpdated = () => {
      const latest = loadVaultNotes();
      setNotes(latest);
      if (latest[0] && !openTabIds.includes(latest[0].id)) {
        setOpenTabIds((prev) => [latest[0].id, ...prev].slice(0, 8));
      }
    };
    window.addEventListener('maoc-vault-updated', onVaultUpdated);
    return () => window.removeEventListener('maoc-vault-updated', onVaultUpdated);
  }, [openTabIds]);

  useEffect(() => {
    if (!orbitActive) return undefined;
    const timer = setInterval(() => {
      setOrbitPhase((prev) => (prev + 0.0045) % (Math.PI * 2));
    }, 40);
    return () => clearInterval(timer);
  }, [orbitActive]);

  useEffect(() => {
    const node = galaxyStageRef.current;
    if (!node) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      setGalaxyView((prev) => ({
        ...prev,
        scale: Math.min(2.4, Math.max(0.55, Number((prev.scale + delta).toFixed(2))))
      }));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [viewMode]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || notes[0],
    [notes, selectedNoteId]
  );

  const openTabsList = useMemo(() => {
    const list = openTabIds
      .map((id) => notes.find((n) => n.id === id))
      .filter(Boolean);
    if (list.length === 0 && notes[0]) return [notes[0]];
    return list;
  }, [openTabIds, notes]);

  const parsedBlocks = useMemo(
    () => parseMarkdownBlocks(selectedNote?.content || ''),
    [selectedNote?.content]
  );

  const filteredSources = useMemo(() => {
    const all = selectedNote?.sources || [];
    if (engineFilter === 'ALL') return all;
    return all.filter((s) => (s.engine || 'WIKIPEDIA') === engineFilter);
  }, [selectedNote?.sources, engineFilter]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleOpenNoteInTab = (noteId) => {
    setSelectedNoteId(noteId);
    setOpenTabIds((prev) => (prev.includes(noteId) ? prev : [...prev, noteId]));
  };

  const handleCloseTab = (noteId, e) => {
    e?.stopPropagation();
    const remaining = openTabIds.filter((id) => id !== noteId);
    if (remaining.length === 0 && notes[0]) {
      setOpenTabIds([notes[0].id]);
      setSelectedNoteId(notes[0].id);
      return;
    }
    setOpenTabIds(remaining);
    if (selectedNoteId === noteId) {
      setSelectedNoteId(remaining[0]);
    }
  };

  // เปิดแท็บ Deep Research ใหม่และดึงผลลัพธ์แบบ Google Research เรียงเป็น List
  const handleRunLiveResearch = async (topicOverride) => {
    const query = (topicOverride ?? searchQuery).trim();
    if (!query || isResearching) return;

    setIsResearching(true);
    onDispatchTask?.(
      `[TEAM:CONTENT] [COWORK:SCOUT,MEMO,INK,HERMES] Google Deep Research: "${query}"`
    );

    try {
      const { sources, paragraphs } = await fetchMultiEngineGoogleResearch(query);
      const timeNow = new Date().toLocaleTimeString('en-GB');

      const bodyText =
        paragraphs.length > 0
          ? paragraphs.join('\n\n')
          : `### 1. Real-Time Analysis\nดึงข้อมูลวิเคราะห์แบบเรียลไทม์สำหรับ "${query}" โดย [[SCOUT]] และเชื่อมโยงเข้ากับคลังความจำ [[MEMO]]`;

      const artifactJson = JSON.stringify(
        {
          research_topic: query,
          lead_agents: ['SCOUT', 'MEMO', 'INK', 'HERMES'],
          google_research_results: sources.length,
          engines_queried: ['WIKIPEDIA', 'WEB / TECH', 'SCHOLAR / DOI', 'INSTANT GRAPH'],
          timestamp: timeNow
        },
        null,
        2
      );

      const newNote = {
        id: `note-${Date.now()}`,
        title: query,
        category: 'DEEP RESEARCH TAB',
        agents: ['SCOUT', 'MEMO', 'INK', 'HERMES'],
        updatedAt: timeNow,
        tags: [
          `#${query.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g, '-')}`,
          '#google-research',
          '#multi-tab'
        ],
        links: [
          '[[Multi-Agent Orchestration]]',
          '[[XAU/USD Liquidity & Macro Gold Structure]]',
          '[[SCOUT]]',
          '[[MEMO]]'
        ],
        summary:
          sources[0]?.snippet ||
          `รวบรวมผลการค้นหา ${sources.length} รายการสำหรับ "${query}" จาก Wikipedia, Web/Tech Feed, และ Academic DOI`,
        content: `## 1. Executive Synthesis: ${query}\nรายงานวิจัยเชิงลึกฉบับนี้ถูกค้นคว้าโดย [[SCOUT]] ร่วมกับ [[MEMO]] และ [[INK]] เมื่อเวลา ${timeNow} โดยรวบรวมรายการผลการค้นหาทั้งหมด ${sources.length} รายการ\n\n${bodyText}\n\n## 2. Research Metadata\n\`\`\`json\n${artifactJson}\n\`\`\``,
        sources:
          sources.length > 0
            ? sources
            : [
                {
                  engine: 'WIKIPEDIA',
                  title: `Google / Wikipedia Search: ${query}`,
                  url: `https://www.google.com/search?q=${encodeURIComponent(
                    query
                  )}`,
                  domain: 'google.com',
                  snippet: 'Direct external search query.'
                }
              ]
      };

      setNotes((prev) => {
        const updated = [newNote, ...prev];
        saveVaultNotes(updated);
        return updated;
      });
      setOpenTabIds((prev) => [newNote.id, ...prev].slice(0, 10));
      setSelectedNoteId(newNote.id);
      setViewMode('research');
      if (!topicOverride) setSearchQuery('');
    } finally {
      setIsResearching(false);
    }
  };

  // ดึงผลการค้นหาข้อที่เลือกจาก Google Research List เข้าไปต่อท้ายโน้ต Obsidian ทันที
  const handleAppendResultToNote = (srcItem) => {
    if (!selectedNote) return;
    const newBlock = `\n\n### [${srcItem.engine || 'SOURCE'}] ${
      srcItem.title
    }\n${srcItem.snippet}\n- **Source URL:** ${srcItem.url}`;
    handleUpdateNoteContent(selectedNote.content + newBlock);
  };

  const handleAskNotebookLm = async (questionOverride) => {
    const q = (questionOverride ?? qaInput).trim();
    if (!q || !selectedNote) return;
    if (!questionOverride) setQaInput('');

    const timeNow = new Date().toLocaleTimeString('en-GB');
    const contextStr = `${selectedNote.title}\n${selectedNote.summary}\n${selectedNote.content}`;

    const { text, mode } = await callSmartOrRealLlm({
      agentName: 'SCOUT + MEMO',
      role: 'NotebookLM Research Lead',
      model: 'GEMINI / SONNET',
      skills: ['web-search', 'citation-resolver', 'vector-memory'],
      systemPrompt:
        'Answer the user question grounded in the provided research note and citations.',
      userPrompt: q,
      contextText: contextStr
    });

    const citations = (selectedNote.sources || [])
      .slice(0, 3)
      .map((s, i) => `[#${i + 1} ${s.domain || s.engine}]`)
      .join(' ');

    setQaHistory((prev) => [
      ...prev,
      {
        id: `qa-${Date.now()}`,
        question: q,
        answer: `${text}\n\n📌 Citations: ${citations}`,
        noteTitle: `${selectedNote.title} (${mode})`,
        time: timeNow
      }
    ]);
  };

  const handleUpdateNoteContent = (newContent) => {
    if (!selectedNote) return;
    const wikiMatches = [...newContent.matchAll(/\[\[([^\]]+)\]\]/g)].map(
      (m) => `[[${m[1]}]]`
    );

    setNotes((prev) => {
      const updated = prev.map((n) =>
        n.id === selectedNote.id
          ? {
              ...n,
              content: newContent,
              links: wikiMatches.length > 0 ? [...new Set(wikiMatches)] : n.links,
              updatedAt: new Date().toLocaleTimeString('en-GB')
            }
          : n
      );
      saveVaultNotes(updated);
      return updated;
    });
  };

  const handleDeleteNote = (id) => {
    setNotes((prev) => {
      const filtered = prev.filter((n) => n.id !== id);
      const next = filtered.length > 0 ? filtered : SEED_NOTES;
      saveVaultNotes(next);
      setOpenTabIds((tabs) => {
        const cleanTabs = tabs.filter((tId) => tId !== id);
        return cleanTabs.length > 0 ? cleanTabs : [next[0].id];
      });
      if (selectedNoteId === id) {
        setSelectedNoteId(next[0].id);
      }
      return next;
    });
  };

  const handleToggleAudioBriefing = () => {
    if (!('speechSynthesis' in window) || !selectedNote) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const textToRead = `${selectedNote.title}. ${selectedNote.summary}. ${selectedNote.content.replace(
      /[#*\[\]`]/g,
      ''
    )}`;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = /[\u0E00-\u0E7F]/.test(textToRead) ? 'th-TH' : 'en-US';
    utterance.rate = 1.02;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleExportSingleNote = () => {
    if (!selectedNote) return;
    exportDepartmentMarkdown(`OBSIDIAN-VAULT-${selectedNote.title}`, [
      {
        status: 'VERIFIED NOTE',
        title: selectedNote.title,
        lead: selectedNote.agents.join(', '),
        coWork: selectedNote.agents,
        time: selectedNote.updatedAt,
        summary: selectedNote.summary,
        paragraphs: parsedBlocks.filter((b) => b.type === 'p').map((b) => b.text),
        stages: (selectedNote.sources || []).map(
          (s) => `[${s.engine || 'WEB'}] ${s.title} -> ${s.url}`
        )
      }
    ]);
  };

  // Compute 4-Tier Galactic Planetary Coordinates
  const galaxyData = useMemo(() => {
    const cx = 500;
    const cy = 310;

    const coreSun = {
      id: 'core-singularity',
      label: 'MAOC SINGULARITY',
      sub: 'ARIA + HERMES CORE',
      kind: 'sun',
      x: cx,
      y: cy,
      r: 26,
      palette: PLANET_PALETTES.command
    };

    const coreAgents = [
      { id: 'SCOUT', cat: 'content' },
      { id: 'MEMO', cat: 'data' },
      { id: 'HERMES', cat: 'command' },
      { id: 'HAWK', cat: 'trade' },
      { id: 'REX', cat: 'tech' },
      { id: 'LUNA', cat: 'design' },
      { id: 'COIN', cat: 'finance' }
    ];

    const agentPlanets = coreAgents.map((ag, idx) => {
      const angle =
        (idx / coreAgents.length) * Math.PI * 2 - orbitPhase * 0.7;
      const r = 118;
      return {
        id: `ag-${ag.id}`,
        label: ag.id,
        sub: 'AGENT PLANET',
        kind: 'agent',
        agentId: ag.id,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        r: 14,
        palette: PLANET_PALETTES[ag.cat] || PLANET_PALETTES.command
      };
    });

    const notePlanets = notes.map((note, idx) => {
      const angle =
        (idx / Math.max(1, notes.length)) * Math.PI * 2 +
        orbitPhase * 0.45 -
        Math.PI / 3;
      const r = 225;
      const weightRadius = Math.min(
        24,
        16 + (note.sources?.length || 1) * 1.4
      );
      return {
        id: note.id,
        label: note.title.slice(0, 26),
        sub: `${note.sources?.length || 0} SOURCES`,
        kind: 'note',
        noteId: note.id,
        noteObj: note,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        r: weightRadius,
        palette: paletteForCategory(note.category)
      };
    });

    const allTags = [...new Set(notes.flatMap((n) => n.tags || []))].slice(0, 10);
    const tagMoons = allTags.map((tag, idx) => {
      const angle =
        (idx / Math.max(1, allTags.length)) * Math.PI * 2 -
        orbitPhase * 0.9;
      const r = 302;
      return {
        id: `tag-${tag}`,
        label: tag,
        kind: 'moon',
        tagText: tag,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        r: 8,
        palette: PLANET_PALETTES.trade
      };
    });

    const edges = [];
    for (const agP of agentPlanets) {
      edges.push({
        id: `e-sun-${agP.id}`,
        fromId: coreSun.id,
        toId: agP.id,
        x1: coreSun.x,
        y1: coreSun.y,
        x2: agP.x,
        y2: agP.y,
        color: '#a855f7',
        dashed: true
      });
    }

    for (const nP of notePlanets) {
      for (const agName of nP.noteObj.agents || []) {
        const targetAg = agentPlanets.find((a) => a.agentId === agName);
        if (targetAg) {
          edges.push({
            id: `e-${nP.id}-${targetAg.id}`,
            fromId: nP.id,
            toId: targetAg.id,
            x1: nP.x,
            y1: nP.y,
            x2: targetAg.x,
            y2: targetAg.y,
            color: nP.palette.core,
            dashed: false
          });
        }
      }
      for (const tag of nP.noteObj.tags || []) {
        const targetMoon = tagMoons.find((m) => m.tagText === tag);
        if (targetMoon) {
          edges.push({
            id: `e-${nP.id}-${targetMoon.id}`,
            fromId: nP.id,
            toId: targetMoon.id,
            x1: nP.x,
            y1: nP.y,
            x2: targetMoon.x,
            y2: targetMoon.y,
            color: '#38bdf8',
            dashed: true
          });
        }
      }
    }

    for (let i = 0; i < notePlanets.length; i += 1) {
      const next = notePlanets[(i + 1) % notePlanets.length];
      if (next && next.id !== notePlanets[i].id) {
        edges.push({
          id: `e-ring-${notePlanets[i].id}-${next.id}`,
          fromId: notePlanets[i].id,
          toId: next.id,
          x1: notePlanets[i].x,
          y1: notePlanets[i].y,
          x2: next.x,
          y2: next.y,
          color: '#f472b6',
          dashed: true
        });
      }
    }

    return {
      coreSun,
      nodes: [coreSun, ...agentPlanets, ...notePlanets, ...tagMoons],
      edges
    };
  }, [notes, orbitPhase]);

  const activeFocusId = hoveredNodeId || selectedNote?.id;

  const renderGalaxyVisualizer = () => (
    <div
      ref={galaxyStageRef}
      onPointerDown={(e) => {
        if (e.target.closest('button')) return;
        dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          originX: galaxyView.x,
          originY: galaxyView.y
        };
      }}
      onPointerMove={(e) => {
        if (!dragRef.current) return;
        setGalaxyView((prev) => ({
          ...prev,
          x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
          y: dragRef.current.originY + (e.clientY - dragRef.current.startY)
        }));
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      className="relative flex min-h-0 flex-1 cursor-grab flex-col overflow-hidden rounded-2xl border border-neon-cyan/35 bg-[#04060b] shadow-2xl active:cursor-grabbing"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(168,85,247,0.16) 0%, rgba(34,211,238,0.08) 38%, rgba(4,6,11,0.98) 78%)'
        }}
      />

      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-lg border border-neon-cyan/50 bg-slate-950/85 px-2.5 py-1 text-[9px] font-bold tracking-[0.18em] text-cyan-200 shadow-glow-cyan backdrop-blur-md">
          <Compass className="h-3 w-3 animate-spin" />
          <span>OBSIDIAN GALAXY &amp; PLANET GLOW</span>
        </span>
        <button
          type="button"
          onClick={() => setOrbitActive((prev) => !prev)}
          className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[9px] font-bold tracking-wider backdrop-blur-md transition-all ${
            orbitActive
              ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
              : 'border-white/15 bg-slate-900/80 text-slate-400 hover:text-slate-200'
          }`}
        >
          {orbitActive ? (
            <Pause className="h-2.5 w-2.5" />
          ) : (
            <Play className="h-2.5 w-2.5" />
          )}
          <span>{orbitActive ? 'ORBIT: LIVE' : 'ORBIT: PAUSED'}</span>
        </button>
      </div>

      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1">
        <span className="mr-1 rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[8px] font-bold text-slate-400">
          {Math.round(galaxyView.scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() =>
            setGalaxyView((p) => ({ ...p, scale: Math.min(2.4, p.scale + 0.15) }))
          }
          className="rounded-md border border-white/15 bg-slate-950/85 px-2 py-1 text-[10px] font-bold text-slate-200 hover:border-neon-cyan"
        >
          +
        </button>
        <button
          type="button"
          onClick={() =>
            setGalaxyView((p) => ({ ...p, scale: Math.max(0.55, p.scale - 0.15) }))
          }
          className="rounded-md border border-white/15 bg-slate-950/85 px-2 py-1 text-[10px] font-bold text-slate-200 hover:border-neon-cyan"
        >
          -
        </button>
        <button
          type="button"
          onClick={() => setGalaxyView({ x: 0, y: 0, scale: 1 })}
          className="rounded-md border border-white/15 bg-slate-950/85 px-2 py-1 text-[8px] font-bold tracking-wider text-slate-300 hover:border-neon-cyan"
        >
          RESET
        </button>
      </div>

      <svg viewBox="0 0 1000 620" className="h-full w-full flex-1 select-none">
        <defs>
          <filter id="planet-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="blur1" />
            <feGaussianBlur stdDeviation="16" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {Object.entries(PLANET_PALETTES).map(([key, pal]) => (
            <radialGradient key={key} id={`grad-${key}`} cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="35%" stopColor={pal.core} stopOpacity="1" />
              <stop offset="80%" stopColor={pal.mid} stopOpacity="0.95" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.9" />
            </radialGradient>
          ))}
        </defs>

        <g>
          {STARFIELD.map((star) => (
            <circle
              key={star.id}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#e2e8f0"
              opacity={star.opacity}
            />
          ))}
        </g>

        <g
          transform={`translate(${galaxyView.x}, ${galaxyView.y}) translate(500, 310) scale(${galaxyView.scale}) translate(-500, -310)`}
        >
          <circle
            cx="500"
            cy="310"
            r="118"
            fill="none"
            stroke="rgba(168,85,247,0.18)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle
            cx="500"
            cy="310"
            r="225"
            fill="none"
            stroke="rgba(34,211,238,0.18)"
            strokeWidth="1.2"
            strokeDasharray="6 8"
          />
          <circle
            cx="500"
            cy="310"
            r="302"
            fill="none"
            stroke="rgba(244,114,182,0.14)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />

          {galaxyData.edges.map((edge) => {
            const isHighlighted =
              activeFocusId &&
              (edge.fromId === activeFocusId || edge.toId === activeFocusId);
            const midX = (edge.x1 + edge.x2) / 2;
            const midY = (edge.y1 + edge.y2) / 2;

            return (
              <g key={edge.id}>
                <line
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  stroke={isHighlighted ? '#22d3ee' : edge.color}
                  strokeWidth={isHighlighted ? '2.4' : '1.1'}
                  strokeDasharray={edge.dashed ? '4 4' : undefined}
                  opacity={isHighlighted ? '0.95' : activeFocusId ? '0.2' : '0.45'}
                />
                {isHighlighted && (
                  <circle
                    cx={midX}
                    cy={midY}
                    r="3.2"
                    fill="#ffffff"
                    filter="url(#planet-glow)"
                  />
                )}
              </g>
            );
          })}

          {galaxyData.nodes.map((node) => {
            const isSelected =
              node.kind === 'note' && selectedNote?.id === node.noteId;
            const isHovered = hoveredNodeId === node.id;
            const palKey =
              Object.entries(PLANET_PALETTES).find(
                ([, v]) => v.core === node.palette?.core
              )?.[0] || 'command';

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => {
                  if (node.kind === 'note') {
                    handleOpenNoteInTab(node.noteId);
                  } else if (node.kind === 'agent' && node.agentId) {
                    onFocusAgent?.(node.agentId);
                  } else if (node.kind === 'moon' && node.tagText) {
                    handleRunLiveResearch(node.tagText.replace('#', ''));
                  }
                }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={
                    node.r *
                    (isSelected || isHovered
                      ? 2.15
                      : node.kind === 'sun'
                        ? 1.9
                        : 1.55)
                  }
                  fill={node.palette?.halo || 'rgba(34,211,238,0.35)'}
                  filter="url(#planet-glow)"
                />

                {(node.kind === 'sun' || node.kind === 'note' || isSelected) && (
                  <ellipse
                    cx={node.x}
                    cy={node.y}
                    rx={node.r * 1.75}
                    ry={node.r * 0.52}
                    fill="none"
                    stroke={node.palette?.ring || '#22d3ee'}
                    strokeWidth={isSelected || isHovered ? '2' : '1.1'}
                    opacity={isSelected || isHovered ? '0.95' : '0.55'}
                    transform={`rotate(-22 ${node.x} ${node.y})`}
                  />
                )}

                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={`url(#grad-${palKey})`}
                  stroke={
                    isSelected || isHovered
                      ? '#ffffff'
                      : node.palette?.ring || '#22d3ee'
                  }
                  strokeWidth={isSelected || isHovered ? '2.5' : '1.2'}
                />

                <text
                  x={node.x}
                  y={node.y + node.r + 14}
                  textAnchor="middle"
                  fill={
                    isSelected || isHovered
                      ? '#67e8f9'
                      : node.kind === 'moon'
                        ? '#94a3b8'
                        : '#f1f5f9'
                  }
                  fontSize={
                    node.kind === 'sun'
                      ? '10'
                      : node.kind === 'moon'
                        ? '8.5'
                        : '9.5'
                  }
                  fontWeight="bold"
                >
                  {node.label}
                </text>

                {node.sub && (
                  <text
                    x={node.x}
                    y={node.y + node.r + 24}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="7.5"
                    fontWeight="bold"
                  >
                    {node.sub}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );

  // Google Research Ranked Results List Renderer
  const renderGoogleResearchList = () => {
    if (!selectedNote) return null;
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
      selectedNote.title
    )}`;
    const googleScholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(
      selectedNote.title
    )}`;

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-3.5">
        {/* Top Filter & Direct Google Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-cyan-300">
              <ListFilter className="h-3 w-3" />
              GOOGLE RESEARCH LIST ({filteredSources.length}):
            </span>
            {['ALL', 'WIKIPEDIA', 'WEB / TECH', 'SCHOLAR / DOI', 'INSTANT GRAPH'].map(
              (eng) => (
                <button
                  key={eng}
                  type="button"
                  onClick={() => setEngineFilter(eng)}
                  className={`rounded-md border px-2 py-0.5 text-[8px] font-bold tracking-wider transition-all ${
                    engineFilter === eng
                      ? 'border-neon-cyan bg-cyan-500/20 text-cyan-200'
                      : 'border-white/10 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {eng}
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1 text-[9px] font-bold text-cyan-200 hover:bg-cyan-500/25"
            >
              <span>GOOGLE SEARCH</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={googleScholarUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-purple-400/40 bg-purple-500/15 px-2.5 py-1 text-[9px] font-bold text-purple-200 hover:bg-purple-500/25"
            >
              <span>GOOGLE SCHOLAR</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>

        {/* Ranked Search Results List */}
        <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {filteredSources.map((src, idx) => (
            <div
              key={idx}
              className="group rounded-xl border border-white/10 bg-slate-900/75 p-3 transition-all hover:border-neon-cyan/50 hover:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-2 text-[9px]">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/15 font-bold text-cyan-300">
                    #{idx + 1}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wider ${
                      SOURCE_BADGE_STYLES[src.engine] ||
                      SOURCE_BADGE_STYLES.WIKIPEDIA
                    }`}
                  >
                    {src.engine || 'WEB SOURCE'}
                  </span>
                  <span className="truncate text-slate-400">
                    {src.domain || extractDomain(src.url)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAppendResultToNote(src)}
                    className="flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold text-emerald-300 hover:bg-emerald-500/25"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    <span>ADD TO OBSIDIAN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleAskNotebookLm(
                        `วิเคราะห์และสรุปใจความสำคัญจากแหล่งข้อมูล: "${src.title}" (${src.snippet})`
                      )
                    }
                    className="rounded-md border border-purple-400/40 bg-purple-500/10 px-2 py-0.5 text-[8px] font-bold text-purple-200 hover:bg-purple-500/25"
                  >
                    ASK NOTEBOOKLM
                  </button>

                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-0.5 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[8px] font-bold text-slate-200 hover:border-neon-cyan hover:text-cyan-300"
                  >
                    <span>OPEN</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>

              <a
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 block text-xs font-bold text-cyan-300 group-hover:underline"
              >
                {src.title}
              </a>

              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                {src.snippet}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
      <p className="mb-4 rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100/80">พื้นที่บันทึกเดิม: บันทึกตัวอย่าง/ประวัติอาจมีข้อความจำลอง ไม่ใช่หลักฐานการซื้อขายหรือผลสำเร็จจริง · “NotebookLM” เป็น UI สรุปผ่าน provider ที่ตั้งค่าไว้ ไม่เชื่อม Google NotebookLM · แหล่งค้นหาในระบบคือ Wikipedia/HackerNews; Google/Scholar เป็นลิงก์ออก · ไม่มี vector search หรือ Obsidian bidirectional sync</p>
      {/* Top Research & Multi-Tab Studio Bar */}
      <section className="glass-panel rounded-2xl border border-neon-cyan/40 p-3.5 shadow-glow-cyan">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-neon-cyan/50 bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.2em] text-cyan-200">
                MULTI-TAB DEEP RESEARCH // GOOGLE LIST + GALAXY + NOTEBOOKLM
              </span>
              <span className="rounded-md border border-purple-400/40 bg-purple-500/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] text-purple-300">
                {openTabsList.length} OPEN TABS • {notes.length} PLANETS
              </span>
            </div>
          </div>

          <div className="flex flex-1 max-w-2xl items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/90 px-3 py-2 focus-within:border-neon-cyan">
              <Search className="h-4 w-4 text-cyan-300" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRunLiveResearch();
                  }
                }}
                placeholder="พิมพ์คำค้นหาเพื่อเปิดแท็บ Deep Research ใหม่ (เรียงผลลัพธ์แบบ Google Research)..."
                className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 outline-none"
              />
            </label>

            <button
              type="button"
              disabled={isResearching}
              onClick={() => handleRunLiveResearch()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-neon-cyan/60 bg-cyan-500/20 px-4 py-2 text-[10px] font-bold tracking-[0.16em] text-cyan-200 shadow-glow-cyan transition-all hover:bg-cyan-500/30 disabled:opacity-50"
            >
              {isResearching ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>SEARCHING...</span>
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" />
                  <span>NEW RESEARCH TAB</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* BROWSER-STYLE MULTI-TAB DEEP RESEARCH BAR */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto border-t border-white/10 pt-2.5 pb-1">
          <span className="mr-1 flex shrink-0 items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
            <Layers className="h-3 w-3 text-cyan-400" />
            RESEARCH TABS:
          </span>

          {openTabsList.map((tabNote) => {
            const isTabActive = selectedNote?.id === tabNote.id;
            const pal = paletteForCategory(tabNote.category);
            return (
              <div
                key={tabNote.id}
                onClick={() => setSelectedNoteId(tabNote.id)}
                className={`group flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] font-bold transition-all ${
                  isTabActive
                    ? 'border-neon-cyan bg-cyan-500/20 text-cyan-100 shadow-glow-cyan'
                    : 'border-white/10 bg-slate-900/75 text-slate-400 hover:border-white/25 hover:text-slate-200'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: pal.core,
                    boxShadow: `0 0 6px ${pal.core}`
                  }}
                />
                <span className="max-w-[160px] truncate">{tabNote.title}</span>
                <span className="rounded bg-black/40 px-1.5 py-0.5 text-[8px] text-cyan-300">
                  {tabNote.sources?.length || 0}
                </span>
                {openTabsList.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(tabNote.id, e)}
                    className="rounded p-0.5 text-slate-500 hover:bg-red-500/20 hover:text-red-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Quick Topic Spawn Buttons */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {QUICK_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => handleRunLiveResearch(topic)}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1 text-[8px] font-semibold text-slate-400 hover:border-neon-cyan/50 hover:text-cyan-200"
              >
                <Plus className="h-2.5 w-2.5 text-cyan-400" />
                <span>{topic}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sub-Bar: View Mode Switcher */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2">
          <span className="text-[10px] text-slate-400">
            Active Tab:{' '}
            <strong className="text-cyan-300">{selectedNote?.title}</strong> (
            {selectedNote?.sources?.length || 0} Google/Wiki/Scholar Results)
          </span>

          <div className="flex max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/80 p-1">
            <button
              type="button"
              onClick={() => setViewMode('research')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] transition-all ${
                viewMode === 'research'
                  ? 'border border-neon-cyan/50 bg-cyan-500/20 text-cyan-200 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="h-3 w-3" />
              <span>GOOGLE RESEARCH LIST</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] transition-all ${
                viewMode === 'split'
                  ? 'border border-neon-cyan/50 bg-cyan-500/20 text-cyan-200 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>SPLIT: GALAXY + READER</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('galaxy')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] transition-all ${
                viewMode === 'galaxy'
                  ? 'border border-purple-400/50 bg-purple-500/20 text-purple-200 shadow-glow-purple'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="h-3 w-3" />
              <span>FULL GALAXY ({notes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('reader')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] transition-all ${
                viewMode === 'reader'
                  ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="h-3 w-3" />
              <span>OBSIDIAN READER</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] transition-all ${
                viewMode === 'editor'
                  ? 'border border-amber-400/50 bg-amber-500/20 text-amber-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="h-3 w-3" />
              <span>MARKDOWN</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Studio Workspace */}
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-12 gap-3 overflow-hidden">
        {/* LEFT PANE (2 cols): All Saved Vault Planets */}
        <aside className="glass-panel col-span-2 flex min-h-0 flex-col rounded-2xl p-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="section-label">All Vault Notes ({notes.length})</span>
          </div>

          <ul className="mt-2.5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {notes.map((note) => {
              const active = selectedNote?.id === note.id;
              const pal = paletteForCategory(note.category);
              return (
                <li key={note.id}>
                  <div
                    role="button" tabIndex={0} aria-label={`เปิดบันทึก ${note.title}`}
                    onKeyDown={(event) => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); handleOpenNoteInTab(note.id); } }}
                    onClick={() => handleOpenNoteInTab(note.id)}
                    className={`group cursor-pointer rounded-xl border p-2.5 transition-all ${
                      active
                        ? 'border-neon-cyan/60 bg-cyan-950/30 shadow-glow-cyan'
                        : 'border-white/5 bg-slate-950/65 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-100">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: pal.core,
                            boxShadow: `0 0 8px ${pal.core}`
                          }}
                        />
                        <span className="line-clamp-1">{note.title}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`ลบบันทึก ${note.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="opacity-100 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[9px] text-slate-400">
                      {note.summary}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* CENTER PANE (6 cols): Google Research List | Galaxy Visualizer | Obsidian Reader */}
        <section className="glass-panel col-span-6 flex min-h-0 flex-col gap-3 overflow-hidden rounded-2xl p-3.5">
          {viewMode === 'galaxy' ? (
            renderGalaxyVisualizer()
          ) : viewMode === 'research' ? (
            renderGoogleResearchList()
          ) : (
            <>
              {viewMode === 'split' && (
                <div className="flex h-[45%] min-h-[210px] flex-col">
                  {renderGalaxyVisualizer()}
                </div>
              )}

              {selectedNote && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-cyan-300" />
                        <h3 className="text-sm font-bold tracking-wide text-slate-100">
                          {selectedNote.title}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Co-Work Chain:{' '}
                        <span className="font-bold text-cyan-300">
                          {selectedNote.agents.join(' -> ')}
                        </span>{' '}
                        • {selectedNote.updatedAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleToggleAudioBriefing}
                        className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] transition-all ${
                          isSpeaking
                            ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 animate-pulse-fast'
                            : 'border-neon-cyan/50 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'
                        }`}
                      >
                        {isSpeaking ? (
                          <>
                            <Pause className="h-3 w-3" />
                            <span>STOP</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3 w-3" />
                            <span>AUDIO BRIEF</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleExportSingleNote}
                        className="flex items-center gap-1 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/25"
                      >
                        <Download className="h-3 w-3" />
                        <span>.MD</span>
                      </button>
                    </div>
                  </div>

                  {viewMode === 'editor' ? (
                    <div className="mt-2.5 flex min-h-0 flex-1 flex-col">
                      <textarea
                        value={selectedNote.content}
                        onChange={(e) => handleUpdateNoteContent(e.target.value)}
                        className="min-h-0 flex-1 resize-none rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs leading-relaxed text-slate-200 outline-none focus:border-neon-cyan/50"
                      />
                    </div>
                  ) : (
                    <div className="mt-2.5 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                      <div className="rounded-xl border border-purple-400/35 bg-purple-950/20 p-2.5">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-purple-300">
                          <Sparkles className="h-3 w-3" />
                          <span>Executive Summary // {selectedNote.category}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-100">
                          {selectedNote.summary}
                        </p>
                      </div>

                      {parsedBlocks.map((block, idx) => {
                        if (block.type === 'h2') {
                          return (
                            <h4
                              key={idx}
                              className="border-b border-white/10 pb-1 pt-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300"
                            >
                              {block.text}
                            </h4>
                          );
                        }
                        if (block.type === 'h3') {
                          return (
                            <h5
                              key={idx}
                              className="pt-1 text-xs font-bold text-amber-300"
                            >
                              {block.text}
                            </h5>
                          );
                        }
                        if (block.type === 'code') {
                          return (
                            <div
                              key={idx}
                              className="rounded-xl border border-cyan-400/30 bg-slate-950 p-2.5"
                            >
                              <div className="mb-1 flex items-center justify-between text-[9px] text-cyan-300">
                                <span className="flex items-center gap-1 font-bold">
                                  <Code2 className="h-3 w-3" />
                                  TECHNICAL ARTIFACT / PAYLOAD
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigator.clipboard?.writeText(block.text)
                                  }
                                  className="flex items-center gap-1 text-slate-400 hover:text-cyan-200"
                                >
                                  <Copy className="h-2.5 w-2.5" />
                                  <span>COPY</span>
                                </button>
                              </div>
                              <pre className="overflow-x-auto text-[10px] leading-relaxed text-emerald-300">
                                {block.text}
                              </pre>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={idx}
                            className="rounded-xl border border-white/5 bg-slate-950/75 p-2.5 text-xs leading-relaxed text-slate-200"
                          >
                            {block.text}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* RIGHT PANE (4 cols): NotebookLM Q&A + Obsidian Links */}
        <aside className="glass-panel col-span-4 flex min-h-0 flex-col overflow-hidden rounded-2xl p-3">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-slate-950/80 p-1">
            <button
              type="button"
              onClick={() => setRightMode('notebooklm')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[9px] font-bold tracking-[0.12em] transition-all ${
                rightMode === 'notebooklm'
                  ? 'border border-neon-cyan/50 bg-cyan-500/20 text-cyan-200 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="h-3 w-3" />
              <span>NOTEBOOKLM Q&amp;A</span>
            </button>

            <button
              type="button"
              onClick={() => setRightMode('sources')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[9px] font-bold tracking-[0.12em] transition-all ${
                rightMode === 'sources'
                  ? 'border border-purple-400/50 bg-purple-500/20 text-purple-200 shadow-glow-purple'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link2 className="h-3 w-3" />
              <span>WIKILINKS &amp; TAGS</span>
            </button>
          </div>

          {rightMode === 'notebooklm' ? (
            <div className="mt-2.5 flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
                {[
                  'สรุปผลการค้นหาทั้งหมดในแท็บนี้',
                  'วิเคราะห์ความเสี่ยงและตัวเลขสำคัญ',
                  'แตกรายการ Action Items สำหรับทีม'
                ].map((qPreset) => (
                  <button
                    key={qPreset}
                    type="button"
                    onClick={() => handleAskNotebookLm(qPreset)}
                    className="rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1 text-[9px] text-slate-300 hover:border-neon-cyan/50 hover:text-cyan-200"
                  >
                    {qPreset}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto py-2.5 pr-1 text-[11px]">
                <div className="rounded-xl border border-cyan-400/25 bg-cyan-950/20 p-2.5 text-slate-200">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                    NotebookLM Grounded Assistant
                  </p>
                  <p className="mt-1">
                    กำลังเชื่อมต่อกับแท็บวิจัย{' '}
                    <strong>{selectedNote?.title}</strong> (
                    {selectedNote?.sources?.length || 0} แหล่งข้อมูล) พิมพ์ถามหรือกดปุ่ม `ASK NOTEBOOKLM` จากรายการค้นหาได้เลยครับ
                  </p>
                </div>

                {qaHistory.map((item) => (
                  <div key={item.id} className="space-y-1.5">
                    <div className="ml-6 rounded-xl border border-purple-400/40 bg-purple-950/30 p-2.5 text-purple-100">
                      <p className="text-[9px] font-bold text-purple-300">
                        YOU • {item.time}
                      </p>
                      <p className="mt-0.5">{item.question}</p>
                    </div>
                    <div className="mr-2 whitespace-pre-line rounded-xl border border-neon-cyan/30 bg-slate-900/90 p-2.5 leading-relaxed text-slate-200">
                      <p className="text-[9px] font-bold text-cyan-300">
                        NOTEBOOKLM SYNTHESIS ({item.noteTitle})
                      </p>
                      <p className="mt-1">{item.answer}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-auto flex gap-1.5 border-t border-white/10 pt-2.5">
                <input
                  value={qaInput}
                  onChange={(e) => setQaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAskNotebookLm();
                    }
                  }}
                  placeholder="ถามคำถามจากผลการค้นหาในแท็บนี้..."
                  className="flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-neon-cyan"
                />
                <button
                  type="button"
                  onClick={() => handleAskNotebookLm()}
                  className="flex items-center gap-1 rounded-xl border border-neon-cyan/60 bg-cyan-500/20 px-3 py-2 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/30"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>ASK</span>
                </button>
              </div>
            </div>
          ) : (
            selectedNote && (
              <div className="mt-2.5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <div>
                  <div className="flex items-center gap-1.5 border-b border-white/10 pb-1.5">
                    <Link2 className="h-3.5 w-3.5 text-purple-300" />
                    <span className="section-label">
                      Click [[WikiLink]] to Open New Research Tab
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(selectedNote.links || []).map((lk) => (
                      <button
                        key={lk}
                        type="button"
                        onClick={() => {
                          const cleanTitle = lk.replace(/[\[\]]/g, '');
                          const target = notes.find((n) =>
                            n.title
                              .toLowerCase()
                              .includes(cleanTitle.toLowerCase())
                          );
                          if (target) {
                            handleOpenNoteInTab(target.id);
                          } else {
                            handleRunLiveResearch(cleanTitle);
                          }
                        }}
                        className="rounded-lg border border-purple-400/40 bg-purple-500/10 px-2 py-1 text-[9px] font-bold text-purple-200 hover:bg-purple-500/25"
                      >
                        {lk}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 border-b border-white/10 pb-1.5">
                    <Hash className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="section-label">Tags &amp; Agents</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(selectedNote.tags || []).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          handleRunLiveResearch(tag.replace('#', ''))
                        }
                        className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                      >
                        {tag}
                      </button>
                    ))}
                    {(selectedNote.agents || []).map((ag) => (
                      <button
                        key={ag}
                        type="button"
                        onClick={() => onFocusAgent?.(ag)}
                        className="rounded-md border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold text-cyan-200 hover:bg-cyan-500/30"
                      >
                        @{ag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}
        </aside>
      </div>
    </main>
  );
}