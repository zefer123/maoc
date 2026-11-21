// Fixed, bounded scenery; no simulated telemetry, random particles or external assets.
const STARS = [[44, 87], [118, 212], [193, 105], [279, 49], [366, 173], [458, 69], [529, 192], [641, 35], [718, 129], [843, 57], [938, 194], [1027, 96], [1114, 269], [1175, 48], [77, 484], [352, 649], [814, 689], [1091, 576]];

export default function GuildBackdrop() {
  return <svg className="guild-backdrop" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <g fill="#c5bfdc" opacity=".55">{STARS.map(([x, y], index) => <path key={x} d={`M${x} ${y}h${index % 3 === 0 ? 3 : 2}v2h-2Z`} />)}</g>
    <g data-scenery="astral-moon" transform="translate(1000 210)">
      <circle r="59" fill="none" stroke="#a28ab8" strokeOpacity=".15" />
      <circle r="49" fill="none" stroke="#baa88b" strokeOpacity=".3" />
      <path d="M-12-36H9v5h15v8h8v15h5v17h-5v15H19v8H2v5h-19v-7h-13v-12h-7V-5h6v-15h8v-10h11Z" fill="#c6b8d8" opacity=".35" />
      <path d="M7-32h10v7h11v14h6v18h-6v13H16v9H4v5h-15V23H0V12h8V-2H0v-14h7Z" fill="#141629" />
      <path d="M0-67v12m0 110v12m-67-67h12m110 0h12" stroke="#c2ae89" strokeOpacity=".45" strokeWidth="2" />
    </g>
    <g data-scenery="distant-isles" fill="#39314f" opacity=".3">
      <path d="m35 321 101-44 95 42-53 24-20 45-23-13-24-29-37-6Z" />
      <path d="M86 299v-41h14v-20h13v-28l13-23 13 23v42h15v37Z" />
      <path d="m925 428 114-51 126 54-62 32-31 52-29-17-28-40-48-8Z" />
      <path d="M1002 394v-49h17v-41l16-27 16 27v42h21v-23h12v88Z" />
      <path d="m275 714 93-36 76 35-52 20-22 35-22-32-42-4Z" />
    </g>
    <g fill="none" stroke="#95849f" strokeOpacity=".13" strokeWidth="2">
      <path d="m67 320 68-29 67 29-67 29Zm899 110 72-32 84 34-79 33Z" />
      <path d="M112 283v-32l13-21 13 21v26m-26-14 26-13m888 144v-45l9-14 9 14v44" />
      <path d="m105 355 10 13 16 5m918 109 20 15 11-14m-57-40 10 17" />
    </g>
    <g className="guild-astral-mist" fill="none" stroke="#b3a4cd" strokeOpacity=".08" strokeWidth="22">
      <path d="M-80 567q220-75 440 4t410-3 510-17M-80 692q240-70 465-4t420 7 480-2" />
    </g>
    <path d="m181 139 44 21 29-34 54 13" fill="none" stroke="#a3a0bf" strokeOpacity=".16" />
    <g fill="#c3b3db" opacity=".4"><path d="M179 137h4v4h-4Zm44 21h4v4h-4Zm29-34h4v4h-4Zm54 13h4v4h-4Z" /></g>
  </svg>;
}