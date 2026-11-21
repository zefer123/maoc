import { guildPalette } from '../../../data/cozyGuild.js';

// Decorative layer only: no hit targets, timers, random placement or telemetry state.
export default function GuildProps({ teamId }) {
  const palette = guildPalette(teamId);
  return <svg className="guild-props" width="270" height="210" viewBox="0 0 270 210" aria-hidden="true" focusable="false" data-prop={palette.prop}>
    <ellipse cx="43" cy="126" rx="23" ry="10" fill="#efc982" opacity=".12" />
    <path d="M41 82h4v40h-4Z" fill="#715d57" /><path d="M34 80h18v15H34Z" fill="#eac789" stroke="#655650" strokeWidth="3" />
    <path d="M32 78h22v4H32Zm6-6h10v6H38Z" fill="#998271" /><path d="M42 83v10" stroke="#fff0c1" strokeWidth="2" />
    <path d="m204 123 20-10 20 10-20 10Z" fill="#3d3c45" opacity=".3" />
    <path d="M207 81h10v-9h14v9h9v22h-33Z" fill={teamId === 'content' ? '#6f927b' : '#77798f'} />
    <path d="M210 82h10v-7h8v9h9v10h-27Z" fill={teamId === 'content' ? '#9cb58d' : '#b6b4c7'} /><path d="M206 96h30v10h-30Z" fill="#5b637a" />
    <path d="m63 143 21-10 16 8-21 10Z" fill="#ba9670" /><path d="M66 145v8m26-10v8" stroke="#70534b" strokeWidth="3" />
    <path d="m174 149 12-6 11 6-12 6Z" fill="#a67864" /><path d="m174 149 11 6 12-6v10l-12 6-11-6Z" fill="#c08f75" />
    <path d="M181 139v11m7-17v14m5-8-6 4m-6 1-6-5" stroke="#88aa85" strokeWidth="4" /><path d="M187 131h4v4h-4Zm-11 5h4v4h-4Z" fill={palette.accent} />
    {['books', 'archive', 'scroll', 'ledger'].includes(palette.prop) && <g>
      <path d="M67 132h16v4H67Z" fill={palette.accent} /><path d="M70 128h13v4H70Z" fill="#ecd5ab" /><path d="M73 124h12v4H73Z" fill="#a77f85" />
    </g>}
    {palette.prop === 'banner' && <g><path d="M93 109v27" stroke="#aa8964" strokeWidth="3" /><path d="M95 109h14v15l-7-4-7 4Z" fill={palette.accent} /><path d="M100 112h4v5h-4Z" fill="#f3dba4" /></g>}
    {palette.prop === 'tools' && <path d="m73 125 8 7m-6-10 7 7m-10 4 10-10" stroke="#b4c5bb" strokeWidth="3" />}
    {palette.prop === 'easel' && <g><path d="M68 118h15v17H68Z" fill="#eed9b5" stroke="#b68f64" strokeWidth="2" /><path d="m70 129 5-7 6 9Z" fill={palette.accent} /></g>}
    {palette.prop === 'scope' && <g><path d="m71 125 14-7 3 5-14 7Z" fill="#cab58e" /><path d="m79 127-6 10m6-10 6 7" stroke="#9b8669" strokeWidth="2" /></g>}
    <g data-detail="garden-lights">
      <path d="M32 126h4v9h-4Zm16 8h4v6h-4Zm190-12h3v8h-3Z" fill="#8f81b3" />
      <path d="M28 124h12v4H28Zm17 8h10v4H45Zm191-12h9v4h-9Z" fill={palette.accent} />
      <path d="M30 125h3v2h-3Zm17 8h2v2h-2Z" fill="#f1dfba" />
    </g>
    {['command', 'legal'].includes(teamId) && <g data-detail="stone-arch">
      <path d="M239 111V78l10-13 10 13v23" fill="none" stroke="#76617f" strokeWidth="6" />
      <path d="M239 110V79l10-12 10 12v23" fill="none" stroke="#d2ba93" strokeWidth="2" />
      <path d="m246 85 3-5 3 5-3 5Z" fill={palette.accent} />
    </g>}
    {['data', 'tech'].includes(teamId) && <g data-detail="astral-crystals">
      <path d="m17 102 7-18 7 18-7 10Zm220 40 5-12 5 12-5 8Z" fill={palette.accent} stroke="#d5d2de" />
      <path d="M24 87v23m218 22v16" stroke="#4c5072" />
    </g>}
  </svg>;
}