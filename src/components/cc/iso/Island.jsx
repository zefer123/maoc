import { AGENTS } from '../../../data/agents.js';
import Sparkline from '../Sparkline.jsx';
import GuildBuilding from './GuildBuilding.jsx';
import PixelAgent from './PixelAgent.jsx';
import GuildGround from './GuildGround.jsx';
import GuildProps from './GuildProps.jsx';
import { guildPalette } from '../../../data/cozyGuild.js';
import { spatialLabel } from '../../../lib/spatialModel.js';

export default function Island({ island, teamSignal, agentSignals, focusedAgentId, onFocusAgent, onEnter, history = [] }) {
  const count = history.reduce((sum, value) => sum + value, 0);
  const palette = guildPalette(island.id);
  return <div className="guild-island" data-team={island.id} data-spatial-state={teamSignal?.kind} style={{ left: island.x, top: island.y, '--guild-accent': palette.accent }}>
    <GuildGround teamId={island.id} />
    <GuildProps teamId={island.id} />
    <button type="button" className="guild-entrance" onClick={() => onEnter?.(island.id)} aria-label={`เข้าห้อง ${island.label}`}>
      <GuildBuilding teamId={island.id} />
      <span className="guild-name">{island.label}</span><span className="guild-enter">{teamSignal ? spatialLabel(teamSignal) : `${palette.title} · เข้าห้อง ↗`}</span>
    </button>
    <div className="guild-signal" title="จำนวน event ที่รับมา · 16 ช่วง ช่วงละ 5 วินาที · แสงสแกนเป็นเอฟเฟกต์ตกแต่ง">
      <Sparkline points={history} width={96} height={20} tone={count ? 'up' : 'neutral'} scan label={`กิจกรรม ${island.label}: ${count} events ในช่วงประวัติล่าสุด ไม่ใช่ราคาหรือกำไร`} />
      <span>{count} EVT</span>
    </div>
    <div className="guild-agents">{island.agentIds.map((id) => {
      const agent = AGENTS.find((entry) => entry.id === id);
      if (!agent) return null;
      const signal = agentSignals[id];
      return <button key={id} type="button" data-spatial-state={signal?.kind} className={`guild-agent ${focusedAgentId === id ? 'is-selected' : ''}`} aria-label={`${agent.codename} · ${agent.role} · ${spatialLabel(signal)}`} title={spatialLabel(signal)} aria-pressed={focusedAgentId === id} onClick={() => onFocusAgent(id === focusedAgentId ? null : id)}>
        <PixelAgent agent={agent} active={Boolean(signal)} /><span>{agent.codename}</span><i aria-hidden="true" />
      </button>;
    })}</div>
  </div>;
}