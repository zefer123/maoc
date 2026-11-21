import { guildPalette } from '../../../data/cozyGuild.js';

const SYMBOLS = { command: 'HQ', tech: '</>', design: '*', trade: '+', content: 'Aa', data: '#', finance: '$', legal: '§' };

export default function GuildBuilding({ teamId }) {
  const palette = guildPalette(teamId);
  return <svg className="guild-building" data-building={teamId} width="152" height="122" viewBox="0 0 160 128" aria-hidden="true" focusable="false">
    <ellipse cx="81" cy="112" rx="67" ry="13" fill="#242032" opacity=".35" />
    {teamId === 'command' && <g data-feature="grand-hall">
      <path d="M18 77 80 46l62 31v29l-62 20-62-20Z" fill={palette.wall} stroke="#30293f" strokeWidth="2" />
      <path d="M80 46 142 77v29l-62 20Z" fill={palette.shade} />
      <path d="m12 76 68-37 68 37-68 23Z" fill={palette.roof} stroke="#cfb382" strokeWidth="2" />
      <path d="M30 74V34l12-7 12 7v50Zm76 10V34l12-7 12 7v40Z" fill={palette.wall} stroke="#3f344d" strokeWidth="2" />
      <path d="m24 35 18-25 18 25Zm76 0 18-25 18 25Z" fill={palette.roofShade} stroke="#c5a779" />
      <path d="M62 70V28L80 8l18 20v42L80 81Z" fill={palette.wall} stroke="#d3ba91" strokeWidth="2" />
      <path d="m58 29 22-27 22 27-22-9Z" fill={palette.roof} />
      <path d="M80 2V0M42 10V3m76 7V3" stroke="#ead0a0" strokeWidth="2" />
      <path d="M72 49V36l8-10 8 10v13l-8 5Z" fill={palette.accent} stroke="#e3c89a" strokeWidth="2" />
      <path d="M80 29v23m-7-12h14" stroke="#655179" strokeWidth="2" />
      <path className="guild-window" d="M37 45h8v17h-8Zm77 0h8v17h-8Z" fill="#f3d49b" />
      <path d="m24 104 56 17 56-17m-105 6 49 15 49-15" fill="none" stroke="#d5bd95" strokeWidth="3" />
    </g>}
    {teamId === 'tech' && <g data-feature="cyber-workshop">
      <path d="M15 65 67 39l63 29v39l-52 18-63-28Z" fill={palette.wall} stroke="#233044" strokeWidth="2" />
      <path d="M78 83 130 68v39l-52 18Z" fill={palette.shade} />
      <path d="m11 64 56-29 67 31-56 22Z" fill={palette.roofShade} stroke="#8ba2b5" strokeWidth="2" />
      <path d="M91 66V21l21-11 22 11v54l-22 12Z" fill={palette.shade} stroke="#93b7c1" strokeWidth="2" />
      <path d="m88 22 24-21 26 21-26 12Z" fill={palette.roof} />
      <path d="M112 4V0m-9 41v22m9-27v22m10-24v22" stroke={palette.accent} strokeWidth="3" />
      <path d="M24 68v19l34 16V84Zm8-24V20h13v20" fill="#26354b" stroke="#bda583" strokeWidth="2" />
      <path d="m28 77 25 12m-25-5 18 9m-6-59h10m-21-12h20" stroke={palette.accent} strokeWidth="2" />
      <path d="m133 88 18-8v20l-18 8Z" fill="#34283f" stroke="#d78bc0" strokeWidth="2" />
      <path d="m138 89 8-4m-8 10 8-4" stroke="#e3a6d4" strokeWidth="2" />
    </g>}
    {teamId === 'design' && <g data-feature="dream-studio">
      <path d="M23 73 79 45l56 28v33l-56 20-56-20Z" fill={palette.wall} stroke="#57405f" strokeWidth="2" />
      <path d="M79 91 135 73v33l-56 20Z" fill={palette.shade} />
      <path d="m16 74 36-44 26 18 31-37 34 62-64 23Z" fill={palette.roof} stroke="#dbbdc2" strokeWidth="2" />
      <path d="m109 11 34 62-34 12-13-50Z" fill={palette.roofShade} />
      <path d="M32 66V45l15-16 15 16v35Z" fill={palette.wall} stroke="#dcc3cf" strokeWidth="2" />
      <path d="M40 61V46l7-8 7 8v22Z" fill="#cba3e9" /><path d="m47 41 0 23m-6-13 12 6" stroke="#825983" strokeWidth="2" />
      <path d="M103 10h12V6h-12Zm-2 15h16v-5h-16Z" fill="#dbcba6" />
      <path d="m111 52 9-6 9 9-9 7Z" fill="#9ed3db" stroke="#e4d0bb" />
      <path d="m10 98 17-9v23l-17 8Z" fill="#d5c5a7" stroke="#8a6681" strokeWidth="2" /><path d="m13 109 5-10 6 10Z" fill={palette.accent} />
    </g>}
    {teamId === 'trade' && <g data-feature="starfall-observatory">
      <path d="M27 69 80 43l53 26v35l-53 22-53-22Z" fill={palette.wall} stroke="#384157" strokeWidth="2" />
      <path d="M80 89 133 69v35l-53 22Z" fill={palette.shade} />
      <path d="M28 67V49l8-16 17-13 27-7 27 7 17 13 8 16v18L80 88Z" fill={palette.roof} stroke="#cfb58c" strokeWidth="2" />
      <path d="M80 13v75l52-21V49l-8-16-17-13Z" fill={palette.roofShade} />
      <path d="M80 15 63 26 53 45v32m29-60 17 15 9 21v24M31 50l49 20 49-20" fill="none" stroke="#c3a983" strokeWidth="2" />
      <path d="m81 42 53-25 7 15-53 25Z" fill="#b6ae9b" stroke="#554c58" strokeWidth="2" /><path d="m132 17 7 15" stroke="#f3d49b" strokeWidth="5" />
      <path d="M19 84v25m-8-17 17 8" stroke="#b99d76" strokeWidth="2" /><path d="m11 84 8-8 9 8-9 8Z" fill={palette.accent} />
    </g>}
    {teamId === 'content' && <g data-feature="hearth-library">
      <path d="M14 77 66 49l73 29v28l-61 20-64-24Z" fill={palette.wall} stroke="#53484d" strokeWidth="2" />
      <path d="M78 97 139 78v28l-61 20Z" fill={palette.shade} />
      <path d="m8 77 36-36 28 7 35-22 39 51-68 25Z" fill={palette.roof} stroke="#b8b28d" strokeWidth="2" />
      <path d="m107 26 39 51-38 14-30-43Z" fill={palette.roofShade} />
      <path d="M108 38V14h13v40" fill="#8a7270" stroke="#c3ab8e" strokeWidth="2" /><path d="M104 12h21v6h-21Z" fill="#d2b798" />
      <path className="guild-window" d="M29 78V65l12-12 12 12v23Z" fill="#edcc8e" stroke="#a17e6a" strokeWidth="2" /><path d="M41 56v25m-11-9 22 9" stroke="#8f7460" strokeWidth="2" />
      <path d="m90 95 42-15v10l-42 15Z" fill="#718e74" stroke="#c6bd9b" /><path d="m94 88 38-13m-36 29v8m29-18v8" stroke="#c5a878" strokeWidth="2" />
      <path d="M18 91v12l42 16V99Z" fill="#7a604f" /><path d="m23 95 5 2v11l-5-2Zm9 3 6 2v11l-6-2Zm10 4 6 2v11l-6-2Z" fill="#dec09b" />
    </g>}
    {teamId === 'data' && <g data-feature="astral-archive">
      <path d="m28 91 52-26 52 26v17l-52 18-52-18Z" fill={palette.shade} stroke="#baaacf" strokeWidth="2" />
      <path d="M49 90V35l31-17 31 17v55l-31 17Z" fill={palette.wall} stroke="#444158" strokeWidth="2" />
      <path d="M80 18 111 35v55l-31 17Z" fill={palette.shade} />
      <path d="m42 35 38-33 38 33-38 20Z" fill={palette.roof} stroke="#d3bd96" strokeWidth="2" /><path d="m80 2 38 33-38 20Z" fill={palette.roofShade} />
      <path d="M57 47v26m10-32v26m26-19v22m9-17v22" stroke={palette.accent} strokeWidth="3" />
      <ellipse cx="80" cy="41" rx="66" ry="13" fill="none" stroke="#c5ad83" strokeWidth="2" transform="rotate(-18 80 41)" />
      <path d="m22 57 6-10 6 10-6 10Zm98 13 7-12 7 12-7 12Z" fill={palette.accent} stroke="#e1d5e7" />
      <path d="m12 88 20-8 10 5-20 8Zm112 9 18-8 11 5-18 8Z" fill="#c0ac94" stroke="#6c5a7e" strokeWidth="2" />
    </g>}
    {teamId === 'finance' && <g data-feature="gilded-counting-house">
      <path d="M18 70 80 40l62 30v35l-62 21-62-21Z" fill={palette.wall} stroke="#423246" strokeWidth="2" /><path d="M80 92 142 70v35l-62 21Z" fill={palette.shade} />
      <path d="m12 68 68-41 68 41-68 26Z" fill={palette.roofShade} stroke="#ddbd83" strokeWidth="2" /><path d="m33 61 47-26 47 26-47 18Z" fill={palette.roof} />
      <path d="M71 41V19l9-12 9 12v22Z" fill="#b59b6e" stroke="#e5c994" strokeWidth="2" /><path d="M80 13v22m-5-14h10" stroke="#4b384b" strokeWidth="2" />
      <path d="M26 78v24m16-18v24m16-18v24m43-22v24m17-30v24m16-30v24" stroke="#d9ba85" strokeWidth="5" /><path d="m22 102 41 16m36 1 40-16" stroke="#ead0a1" strokeWidth="3" />
      <path d="m127 111 16-7 9 5-16 8Z" fill="#ddbf80" />
    </g>}
    {teamId === 'legal' && <g data-feature="obsidian-chapterhouse">
      <path d="M20 76 80 43l60 33v30l-60 20-60-20Z" fill={palette.wall} stroke="#302939" strokeWidth="2" /><path d="M80 43 140 76v30l-60 20Z" fill={palette.shade} />
      <path d="m13 75 36-48 31 14 31-14 36 48-67 22Z" fill={palette.roofShade} stroke="#a99ab6" strokeWidth="2" />
      <path d="M62 78V31L80 7l18 24v47L80 88Z" fill={palette.wall} stroke="#c5b6c6" strokeWidth="2" /><path d="m57 32 23-30 23 30-23-10Z" fill={palette.roof} />
      <path d="M30 91V44l9-17 9 17v40m64 0V44l9-17 9 17v47" fill={palette.shade} stroke="#c2ad9b" strokeWidth="2" />
      <path d="m80 34 10 10-10 10-10-10Z" fill={palette.accent} stroke="#ecd5ab" strokeWidth="2" /><path d="M80 36v16m-8-8h16" stroke="#726182" />
      <path className="guild-window" d="m28 100 7-3v10l-7 3Zm96-3 7 3v10l-7-3Z" fill="#f0cf97" />
    </g>}
    <g data-detail="gothic-entry">
      <path d="M70 120v-15l10-11 10 11v15l-10 5Z" fill="#292537" stroke="#d1b58b" strokeWidth="2" />
      <path d="M80 101v21m-5-13v9m10-9v9" stroke={palette.accent} strokeWidth="2" />
      <path d="M70 83h20v12H70Z" fill="#292537" stroke="#bfa47c" />
      <text x="80" y="92" fill="#f0ddba" textAnchor="middle" fontSize="8" fontFamily="monospace" fontWeight="bold">{SYMBOLS[teamId] || 'HQ'}</text>
    </g>
  </svg>;
}