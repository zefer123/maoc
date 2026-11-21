// CSS-pixel camera only. No mission state, simulation or persistence.
export function fitCozyRoom(width, height, consoleOpen) {
  const reserved = consoleOpen && width >= 900 ? 410 : 0;
  return { x: -reserved / 2, y: 45, scale: Math.max(0.2, Math.min(1, (width - reserved - 32) / 960, (height - 190) / 700)) };
}