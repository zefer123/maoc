import { agentOutfit, guildPalette } from '../../../data/cozyGuild.js';

// Original SVG sprites: no asset downloads, external fonts or game-engine dependency.
export default function PixelAgent({ agent, active = false }) {
  const outfit = agentOutfit(agent.id);
  const color = guildPalette(agent.team).accent;
  return <svg className={`pixel-agent ${active ? 'has-recent-event' : ''}`} data-outfit={outfit.accessory} width="36" height="44" viewBox="0 0 18 22" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <ellipse cx="9" cy="20" rx="6" ry="1" fill="#262133" opacity=".5" />
    <g className="pixel-agent-body">
      <path data-costume="guild-cloak" d="M5 12h8l2 7h-4v-2H7v2H3Z" fill={guildPalette(agent.team).roofShade} />
      <path d="M5 4h8v2h1v7H4V6h1Z" fill={outfit.hair} />
      <path d="M6 7h6v6H6ZM5 8h1v3H5Zm7 0h1v3h-1Z" fill={outfit.skin} />
      <path d="M5 5h8v3h-2V7H8v1H5Z" fill={outfit.hair} />
      <path d="M7 9h1v1H7Zm3 0h1v1h-1Z" fill="#3b3341" /><path d="M8 11h2v1H8Z" fill="#a56b63" />
      <path d="M6 13h6v5H6Zm-2 1h2v3H4Zm8 0h2v3h-2Z" fill={color} />
      <path d="M7 13h4v1H7Zm1 1h2v3H8Z" fill="#f0dfbf" />
      <path d="M6 17h6v1H6Zm2-3h2v1H8Z" fill="#b7935e" />
      <path d="M5 14h1v3H5Zm7 0h1v3h-1Z" fill={guildPalette(agent.team).roof} />
      <path d="M4 17h2v1H4Zm8 0h2v1h-2Z" fill={outfit.skin} />
      <path d="M6 18h2v2H5v-1h1Zm4 0h2v1h1v1h-3Z" fill="#65524d" />
      {outfit.accessory === 'crown' && <path d="M4 2h2v1h2V1h2v2h2V2h2v4H4Z" fill="#e8bf73" />}
      {outfit.accessory === 'book' && <g><path d="M11 14h5v5h-5Z" fill="#937483" /><path d="M12 15h3v3h-3Z" fill="#ead7b3" /></g>}
      {outfit.accessory === 'satchel' && <g><path d="m5 13 7 5" stroke="#795d47" /><path d="M11 16h5v4h-5Z" fill="#b28a59" /><path d="M12 17h3v1h-3Z" fill="#e3c08a" /></g>}
      {outfit.accessory === 'glasses' && <path d="M6 8h3v3H6Zm4 0h3v3h-3ZM9 9h1" fill="none" stroke="#685755" strokeWidth=".7" />}
      {outfit.accessory === 'headset' && <path d="M4 8V5h10v6h-2M4 8v3h1" fill="none" stroke="#ead6b0" />}
      {outfit.accessory === 'apron' && <g><path d="M7 14h4v5H7Z" fill="#d8b98e" /><path d="M8 16h2v1H8Z" fill="#9e7b62" /></g>}
      {outfit.accessory === 'beret' && <path d="M4 4h2V3h7v1h2v2H4Zm5-2h2v1H9Z" fill="#b5828c" />}
      {outfit.accessory === 'scarf' && <path d="M5 12h8v2H9v3H7v-3H5Z" fill="#d8ae79" />}
    </g>
  </svg>;
}