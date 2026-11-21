// Presentation only. These palettes and costumes never grant tools or imply live status.
export const GUILD_PALETTES = Object.freeze({
  command: { accent: '#d2baf5', roof: '#5a456f', roofShade: '#30283f', wall: '#9c8da8', shade: '#544762', floor: '#61546b', title: 'ศาลาบัญชาการ', prop: 'banner' },
  tech: { accent: '#83dbe8', roof: '#314a65', roofShade: '#1e2b43', wall: '#7c94a6', shade: '#3c4d65', floor: '#455366', title: 'เวิร์กช็อประบบ', prop: 'tools' },
  design: { accent: '#edacd9', roof: '#8a567f', roofShade: '#4d355b', wall: '#b49bb7', shade: '#72607f', floor: '#6f587b', title: 'สตูดิโอสร้างสรรค์', prop: 'easel' },
  trade: { accent: '#a2ccea', roof: '#53738f', roofShade: '#2d405b', wall: '#a7a7b2', shade: '#596078', floor: '#535b70', title: 'หอสังเกตการณ์', prop: 'scope' },
  content: { accent: '#b4cc9c', roof: '#526b59', roofShade: '#30433e', wall: '#bdad98', shade: '#7d6c68', floor: '#656652', title: 'ห้องสมุดนักเขียน', prop: 'books' },
  data: { accent: '#a6baf5', roof: '#58578c', roofShade: '#333453', wall: '#959ebd', shade: '#515975', floor: '#52576c', title: 'หอจดหมายเหตุ', prop: 'archive' },
  finance: { accent: '#e7c68c', roof: '#746045', roofShade: '#423647', wall: '#b3a08a', shade: '#69566a', floor: '#665b59', title: 'สำนักงานบัญชี', prop: 'ledger' },
  legal: { accent: '#c9bfdf', roof: '#51475f', roofShade: '#2d2a3d', wall: '#a79baa', shade: '#63566e', floor: '#5c5266', title: 'สำนักเอกสาร', prop: 'scroll' }
});

// Explicit, stable appearances; not derived from runtime state, model tier or permissions.
export const AGENT_OUTFITS = Object.freeze({
  TAEC: { hair: '#654e53', skin: '#eac19e', accessory: 'crown' },
  ARIA: { hair: '#ddd0b8', skin: '#c68f73', accessory: 'book' },
  HERMES: { hair: '#b87d4e', skin: '#efcba7', accessory: 'satchel' },
  REX: { hair: '#64534d', skin: '#bd896e', accessory: 'glasses' },
  NOVA: { hair: '#dfc8a4', skin: '#edc2a0', accessory: 'book' },
  BYTE: { hair: '#655f89', skin: '#d9a080', accessory: 'headset' },
  ZETA: { hair: '#9e6c56', skin: '#b77d63', accessory: 'glasses' },
  FORGE: { hair: '#504a48', skin: '#e4b58d', accessory: 'apron' },
  LUNA: { hair: '#d8bfd3', skin: '#c78f78', accessory: 'beret' },
  PIXEL: { hair: '#a36f58', skin: '#f0c9a8', accessory: 'apron' },
  HAWK: { hair: '#635f52', skin: '#c28e6f', accessory: 'scarf' },
  BLADE: { hair: '#d3c3ad', skin: '#e2ad89', accessory: 'satchel' },
  SAGE: { hair: '#c7c4b7', skin: '#b47f65', accessory: 'glasses' },
  AUTO: { hair: '#68828b', skin: '#c3ad98', accessory: 'headset' },
  SCOUT: { hair: '#9b7750', skin: '#d19d7d', accessory: 'scarf' },
  INK: { hair: '#51454e', skin: '#e7bb96', accessory: 'book' },
  GRACE: { hair: '#a96a5b', skin: '#c78e71', accessory: 'beret' },
  VIBE: { hair: '#b89a78', skin: '#e9bd9d', accessory: 'headset' },
  ATLAS: { hair: '#736258', skin: '#ce9877', accessory: 'satchel' },
  MEMO: { hair: '#baa58d', skin: '#b27c62', accessory: 'book' },
  CIPHER: { hair: '#5b626c', skin: '#dfad8d', accessory: 'glasses' },
  COIN: { hair: '#b58b56', skin: '#e7b896', accessory: 'glasses' },
  DEAL: { hair: '#584a48', skin: '#bd876a', accessory: 'satchel' },
  BOOST: { hair: '#ceaa79', skin: '#eec6a3', accessory: 'scarf' },
  LEX: { hair: '#b8acb8', skin: '#c58d70', accessory: 'book' },
  NEXUS: { hair: '#65586d', skin: '#e4b592', accessory: 'glasses' },
  ECHO: { hair: '#bb8272', skin: '#b98269', accessory: 'headset' }
});

export function guildPalette(teamId) {
  return Object.hasOwn(GUILD_PALETTES, teamId) ? GUILD_PALETTES[teamId] : GUILD_PALETTES.command;
}

export function agentOutfit(agentId) {
  return Object.hasOwn(AGENT_OUTFITS, agentId) ? AGENT_OUTFITS[agentId] : AGENT_OUTFITS.ARIA;
}