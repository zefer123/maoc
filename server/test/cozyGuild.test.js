import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENTS } from '../../src/data/agents.js';
import { ISLANDS } from '../../src/data/islands.js';
import { AGENT_OUTFITS, GUILD_PALETTES, agentOutfit, guildPalette } from '../../src/data/cozyGuild.js';
import { fitCozyRoom } from '../../src/lib/cozySpatial.js';

test('cozy art covers all eight existing teams without changing membership', () => {
  assert.deepEqual(Object.keys(GUILD_PALETTES).sort(), ISLANDS.map((island) => island.id).sort());
  assert.equal(new Set(Object.values(GUILD_PALETTES).map((item) => item.title)).size, 8);
  assert.equal(new Set(Object.values(GUILD_PALETTES).map((item) => item.prop)).size, 8);
  for (const island of ISLANDS) {
    const palette = guildPalette(island.id);
    for (const field of ['accent', 'roof', 'roofShade', 'wall', 'shade', 'floor']) assert.match(palette[field], /^#[\da-f]{6}$/i);
    assert.deepEqual(Object.keys(palette).sort(), ['accent', 'floor', 'prop', 'roof', 'roofShade', 'shade', 'title', 'wall']);
  }
});

test('all 27 agents have explicit stable costumes with no runtime or model fields', () => {
  assert.equal(AGENTS.length, 27);
  assert.deepEqual(Object.keys(AGENT_OUTFITS).sort(), AGENTS.map((agent) => agent.id).sort());
  const accessories = new Set(['crown', 'book', 'satchel', 'glasses', 'headset', 'apron', 'beret', 'scarf']);
  for (const agent of AGENTS) {
    const outfit = agentOutfit(agent.id);
    assert.equal(agentOutfit(agent.id), outfit);
    assert.deepEqual(Object.keys(outfit).sort(), ['accessory', 'hair', 'skin']);
    assert.ok(accessories.has(outfit.accessory));
    assert.match(outfit.hair, /^#[\da-f]{6}$/i); assert.match(outfit.skin, /^#[\da-f]{6}$/i);
  }
  assert.deepEqual(Object.keys(AGENT_OUTFITS).filter((id) => AGENT_OUTFITS[id].accessory === 'crown'), ['TAEC']);
});

test('fantasy palettes preserve team-facing titles and distinct material combinations', () => {
  assert.deepEqual(ISLANDS.map(({ id }) => guildPalette(id).title), [
    'ศาลาบัญชาการ', 'เวิร์กช็อประบบ', 'สตูดิโอสร้างสรรค์', 'หอสังเกตการณ์',
    'สำนักงานบัญชี', 'สำนักเอกสาร', 'หอจดหมายเหตุ', 'ห้องสมุดนักเขียน'
  ]);
  assert.equal(new Set(Object.values(GUILD_PALETTES).map(({ roof, wall, floor }) => `${roof}:${wall}:${floor}`)).size, 8);
  for (const palette of Object.values(GUILD_PALETTES)) {
    assert.notEqual(palette.roof, palette.roofShade);
    assert.notEqual(palette.wall, palette.shade);
    assert.notEqual(palette.accent, palette.floor);
  }
});

test('presentation lookups safely fall back for unknown and inherited identifiers', () => {
  for (const id of ['unknown', '__proto__', 'constructor', null, undefined]) {
    assert.equal(guildPalette(id), GUILD_PALETTES.command);
    assert.equal(agentOutfit(id), AGENT_OUTFITS.ARIA);
  }
});

test('room fit contains scene on supported desktop/tablet/mobile sizes with bounded zoom', () => {
  for (const [width, height] of [[1368, 740], [792, 700], [760, 750], [390, 650], [360, 650], [294, 650]]) {
    for (const open of [true, false]) {
      const view = fitCozyRoom(width, height, open);
      const reserved = open && width >= 900 ? 410 : 0;
      assert.ok(view.scale >= .2 && view.scale <= 1);
      assert.ok(view.scale * 960 <= width - reserved - 32 + 1);
      assert.ok(view.scale * 700 <= height - 190 + 1);
      assert.equal(view.x, -reserved / 2); assert.equal(view.y, 45);
    }
  }
});

test('opening desktop console reserves its space; fitting has no stateful side effects', () => {
  const open = fitCozyRoom(1368, 740, true);
  const closed = fitCozyRoom(1368, 740, false);
  assert.ok(open.x < closed.x); assert.ok(open.scale <= closed.scale);
  assert.deepEqual(fitCozyRoom(360, 650, true), fitCozyRoom(360, 650, false));
  assert.deepEqual(fitCozyRoom(1368, 740, true), open);
});