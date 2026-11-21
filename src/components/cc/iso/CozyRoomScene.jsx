import { guildPalette } from '../../../data/cozyGuild.js';

export default function CozyRoomScene({ teamId }) {
  const palette = guildPalette(teamId);
  return <svg className="cozy-room-scene" data-interior={teamId} width="960" height="700" viewBox="0 0 960 700" aria-hidden="true" focusable="false">
    <ellipse cx="480" cy="500" rx="376" ry="150" fill="#151522" opacity=".4" />
    <path d="M100 360 480 170 860 360v85L480 635 100 445Z" fill="#5a4d50" stroke="#8e7770" strokeWidth="3" />
    <path d="M100 360 480 170 860 360 480 550Z" fill={palette.floor} />
    {[0, 1, 2, 3, 4, 5, 6].map((row) => <path key={row} d={`M${147 + row * 47} ${336 - row * 23.5}l380 190M${147 + row * 47} ${383 + row * 23.5}l380-190`} stroke="#ddc5a1" strokeOpacity=".13" strokeWidth="2" />)}
    <path d="M100 360V205L480 15v155Z" fill={palette.wall} stroke="#887975" strokeWidth="3" />
    <path d="M480 15 860 205v155L480 170Z" fill={palette.shade} stroke="#716674" strokeWidth="3" />
    <path d="M105 344 480 157l375 187" fill="none" stroke="#bc9b78" strokeWidth="12" />
    <path d="M105 205 480 18l375 187" fill="none" stroke="#d2b48d" strokeWidth="10" />
    <path data-detail="stained-glass" d="M178 279v-78l47-68 47 21v78Z" fill="#29283f" stroke="#d1b68e" strokeWidth="8" />
    <path d="M187 263v-58l38-56 38 18v60Z" fill={palette.roofShade} />
    <path d="m194 221 31-59 29 19-28 57Z" fill={palette.accent} opacity=".65" />
    <path d="M225 156v99m-43-16 86-43m-73-3 58 37" stroke="#c3aa89" strokeWidth="4" />
    <path d="m198 237 14-21 13 8-12 22Z" fill="#f3d299" opacity=".8" />
    <path className="cozy-window-light" d="m178 279 94-47 160 140-94 47Z" fill="#efd08c" opacity=".08" />
    <path d="m671 161 111 55v91l-111-56Z" fill="#685450" stroke="#b7997b" strokeWidth="6" />
    {[0, 1].map((row) => <g key={row} transform={`translate(0 ${row * 39})`}>
      <path d="m680 176 10 5v28l-10-5Zm15 7 8 4v28l-8-4Zm13 6 13 6v28l-13-6Zm20 10 8 4v28l-8-4Zm13 7 11 5v28l-11-5Zm17 8 13 6v28l-13-6Z" fill={row ? '#b29fa4' : '#c5bd96'} />
      <path d="m676 208 100 50" stroke="#d3b28d" strokeWidth="4" />
    </g>)}
    <path d="m328 406 152-76 152 76-152 76Z" fill={palette.roof} stroke="#d1b993" strokeWidth="4" opacity=".75" />
    <path d="m348 406 132-66 132 66-132 66Z" fill="none" stroke={palette.accent} strokeWidth="2" strokeDasharray="5 6" />
    <path d="M130 332h27v42h-27Z" fill="#b18b70" /><path d="M138 293h12v46h-12Z" fill="#7d8869" /><path d="M119 300h47v22h-47Zm8-20h31v25h-31Z" fill="#94ac87" />
    <path d="M802 330h24v41h-24Z" fill="#b18b70" /><path d="M809 284h10v52h-10Z" fill="#7d8869" /><path d="M790 299h46v23h-46Zm9-23h29v27h-29Z" fill="#8ea582" />
    <path d="m380 521 70-35 54 27-70 35Z" fill="#bb9772" /><path d="m384 526 50 25 66-34v8l-66 34-50-25Z" fill="#88654f" />
    <path d="m449 504 13-6 12 6-13 7Z" fill="#e1cba7" /><path d="m449 504 12 7 13-7v7l-13 7-12-7Z" fill="#c3ac89" />
    <g data-detail="gothic-columns" fill={palette.roofShade} stroke="#baa182" strokeWidth="3">
      <path d="M111 343V206l14-7v137Zm333-166V37l14-7v140Zm52-7V30l14 7v140Zm330 166V199l14 7v137Z" />
      <path d="m106 205 26-13v10l-26 13Zm330-164 28-14v10l-28 14Zm54-14 28 14v10l-28-14Zm330 165 26 13v10l-26-13Z" />
    </g>
    <path d="m326 416 154 77 154-77m-299 7 145 72 145-72" fill="none" stroke="#c0a078" strokeWidth="2" opacity=".65" />
    {teamId === 'command' && <g data-room-feature="celestial-hall">
      <path d="M306 225V120l26-39 26 13v105" fill={palette.roof} stroke="#d7bc91" strokeWidth="4" />
      <path d="m322 151 12-19 12 7v28l-12 19-12-7Z" fill={palette.accent} /><path d="M334 140v35m-8-19 16-8" stroke="#d7bc91" strokeWidth="3" />
      <path d="m543 104 64 32v72l-32-6-32-27Z" fill={palette.roofShade} stroke="#c8ad82" strokeWidth="3" />
      <path d="m561 139 14-10 14 24-14 10Z" fill="#e4c791" /><path d="M575 153v27" stroke="#cbb48f" strokeWidth="4" />
    </g>}
    {teamId === 'tech' && <g data-room-feature="cyber-workbench">
      <path d="m303 218 94-47v-68l-94 47Z" fill="#243548" stroke={palette.accent} strokeWidth="4" />
      <path d="m315 166 23-12 0 19 30-15m-53 31 67-33m-23-14 23-11" fill="none" stroke={palette.accent} strokeWidth="4" />
      <path d="m548 134 81 40v56l-81-40Z" fill="#2a2a40" stroke="#b38ec1" strokeWidth="4" /><path d="m561 155 53 26m-53-9 32 16" stroke="#d69bc6" strokeWidth="4" />
    </g>}
    {teamId === 'design' && <g data-room-feature="dream-gallery">
      <path d="m302 226 35-18V108l-35 18Zm52-27 36-18V81l-36 18Z" fill="#d6bdc1" stroke="#b68e86" strokeWidth="5" />
      <path d="m310 193 12-42 8 27-12 22Zm52-57 18-31v48l-18 10Z" fill={palette.roof} />
      <path d="m547 126 67 33v65l-67-33Z" fill={palette.roofShade} stroke="#d7bd95" strokeWidth="4" /><path d="m562 162 18-12 18 29-18 11Z" fill={palette.accent} />
    </g>}
    {teamId === 'trade' && <g data-room-feature="orrery">
      <ellipse cx="585" cy="186" rx="57" ry="26" fill="none" stroke="#dfc499" strokeWidth="4" transform="rotate(24 585 186)" />
      <path d="m585 147 23 39-23 39-23-39Z" fill="none" stroke={palette.accent} strokeWidth="3" /><circle cx="585" cy="186" r="12" fill="#e4bf80" />
      <path d="M585 213v29m-21 10 21-10 21 10" stroke="#d2b587" strokeWidth="5" />
      <path d="m308 190 70-35m-70 12 46-23m-30 60 0-63" stroke={palette.accent} strokeWidth="3" />
    </g>}
    {teamId === 'content' && <g data-room-feature="hearth-reading-nook">
      <path d="m302 244 96-48V99l-96 48Z" fill="#685051" stroke="#c4a386" strokeWidth="5" />
      <path d="m321 229 58-29v-45l-29-4-29 33Z" fill="#2c2836" /><path d="m337 217-6-15 15-26 7 13 10-5 5 16-11 16Z" fill="#e9ad6e" />
      <path d="m308 149 84-42m-84 58 84-42" stroke="#9f8070" strokeWidth="5" />
      <path d="m548 140 73 36m-67-17 60 30m-48-24v28m22-17v28" stroke="#a7bb90" strokeWidth="5" />
    </g>}
    {teamId === 'data' && <g data-room-feature="astral-chart">
      <path d="m302 222 96-48V99l-96 48Z" fill="#2f304d" stroke="#c6b4c9" strokeWidth="4" />
      <path d="m316 180 23-30 21 11 24-39m-45 28 8 40 28-23" fill="none" stroke={palette.accent} strokeWidth="2" />
      <path d="M336 147h6v6h-6Zm21 11h6v6h-6Zm24-39h6v6h-6Zm-37 68h6v6h-6Z" fill="#eddbba" />
      <path d="m580 130 24 38-24 39-24-38Z" fill={palette.accent} stroke="#e5d2ab" strokeWidth="3" /><path d="M580 134v68" stroke={palette.roof} strokeWidth="3" />
    </g>}
    {teamId === 'finance' && <g data-room-feature="gilded-ledgers">
      <path d="m307 235 84-42V104l-84 42Z" fill="#443846" stroke="#dfbe87" strokeWidth="5" />
      <path d="m319 167 60-30m-60 52 60-30m-60 52 60-30m-42-43v66m20-76v66" stroke="#b79765" strokeWidth="4" />
      <path d="m552 139 63 31v58l-63-31Z" fill={palette.roofShade} stroke="#d5b47d" strokeWidth="4" /><path d="m571 169 24 12m-12-15v33m-12-20 24 12" stroke="#e4c68f" strokeWidth="4" />
    </g>}
    {teamId === 'legal' && <g data-room-feature="obsidian-scriptorium">
      <path d="M306 228V149l41-54 41 13v79Z" fill={palette.roofShade} stroke="#cabba8" strokeWidth="4" />
      <path d="m346 135 0 56m-25-27 51-26m-41 32-9 24 20-10Zm29-14-9 24 20-10Z" fill="none" stroke={palette.accent} strokeWidth="4" />
      <path d="m547 125 69 34v64l-69-34Z" fill="#ddd0b6" stroke="#a28b79" strokeWidth="4" /><path d="m559 147 44 22m-44-9 44 22m-44-9 30 15" stroke="#91788e" strokeWidth="3" />
    </g>}
  </svg>;
}