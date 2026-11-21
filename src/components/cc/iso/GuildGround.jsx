import { guildPalette } from '../../../data/cozyGuild.js';

export default function GuildGround({ teamId }) {
  const palette = guildPalette(teamId);
  return <svg className="guild-ground" width="270" height="210" viewBox="0 0 270 210" aria-hidden="true" focusable="false">
    <ellipse cx="135" cy="183" rx="109" ry="23" fill="#090b18" opacity=".5" />
    <path data-terrain="floating-cliff" d="M14 94 135 33 256 94v35l-22 12-6 19-31 8-19 21-24-4-20 18-30-17-22-2-18-23-25-8-10-18-15-9Z" fill="#302c43" stroke="#151725" strokeWidth="2" />
    <path d="m14 107 121 61-1 35-30-17-22-2-18-23-25-8-10-18-15-9Z" fill="#494052" />
    <path d="m135 168 121-61v22l-22 12-6 19-31 8-19 21-24-4-20 18Z" fill="#25283d" />
    <path d="m39 131 13 7 4 16m31 3 6 20m16-13 7 17m44-17-4 17m38-29-7 22m36-39-8 21" fill="none" stroke="#817386" strokeOpacity=".5" strokeWidth="3" />
    <path d="m14 94 121-61 121 61-121 61Z" fill={palette.floor} stroke="#c8b69a" strokeOpacity=".45" strokeWidth="2" />
    <path d="m38 82 121 61m-97-73 121 61M87 58l121 61m-97-73 121 61M38 106l121-61m-97 73 121-61m-97 73 121-61m-97 73 121-61" stroke="#e1d0b1" strokeOpacity=".13" strokeWidth="2" />
    <path d="m22 94 113 56 113-56M22 122l15 7m11 6 17 8m120 4 17-9m12-6 16-8" fill="none" stroke="#d7c3a0" strokeOpacity=".6" strokeWidth="2" />
    <path d="m34 94 101-51 101 51-101 50Z" fill="none" stroke={palette.accent} strokeOpacity=".24" strokeWidth="2" />
    <path d="m105 140 30-15 30 15-30 15Z" fill="#b6a58a" />
    <path d="m111 149 24-12 24 12-24 12Zm6 10 18-9 18 9-18 9Z" fill="#c9b799" stroke="#76695f" />
    <path d="m26 101 10 5v7l-10-5zm205 1 11-6v8l-11 6ZM48 133l9 4v6l-9-4Zm159 14 9-4v6l-9 4Z" fill="#8ba086" opacity=".8" />
    {['content', 'design'].includes(teamId) && <g data-terrain="moon-garden">
      <path d="m21 95 25-13 18 9-13 9-15-2-10 5Zm179 23 27-14 20 10-15 7-5 10-14-3Z" fill="#526858" />
      <path d="m25 95 19-9 7 4-14 7Zm186 22 16-8 11 6-14 7Z" fill="#91a691" />
    </g>}
    {teamId === 'trade' && <g data-terrain="celestial-dial" fill="none" stroke="#d2bd96" strokeOpacity=".65">
      <ellipse cx="135" cy="98" rx="76" ry="36" /><ellipse cx="135" cy="98" rx="66" ry="30" />
      <path d="M135 62v10m0 52v10M59 98h18m116 0h18m-119-25 11 7m64 37 11 7m0-51-11 7m-64 37-11 7" strokeWidth="2" />
    </g>}
    {teamId === 'tech' && <path data-terrain="circuit-inlay" d="m32 101 27-14 19 9m126 5 18 9-24 12m-164-19 6 3m179 5-6 3" fill="none" stroke={palette.accent} strokeWidth="2" opacity=".75" />}
  </svg>;
}