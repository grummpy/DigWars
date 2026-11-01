import assert from "node:assert/strict";
import test from "node:test";
import { BURY_TICKS, CAVEIN_FUSE, CAVEIN_RADIUS, STUN_TICKS, TILE } from "../src/core/constants.js";
import { isProtected, spawnTiles, tileAt, tileIndex, treasureTile } from "../src/core/map.js";
import { createMatch, idleActions, step } from "../src/core/sim.js";
import { hold, run } from "./helpers.js";

function arena() {
  return createMatch({
    seed: 11,
    map: "empty",
    skipCountdown: true,
    active: [true, true, false, false],
    bots: [false, false, false, false],
  });
}

function detonateAt(match, player, x, y) {
  match.players[player].x = x;
  match.players[player].y = y;
  match.players[player].alive = true;
  match.players[player].stun = 0;
  const planted = step(match, hold(player, { action: true }));
  assert.ok(planted.some((event) => event.type === "plant"));
  assert.equal(match.charges[0].fuse, CAVEIN_FUSE);
  run(match, CAVEIN_FUSE - 1);
  assert.equal(match.players[player].alive, true);
  assert.equal(match.charges.length, 1);
  return step(match, idleActions());
}

test("a cave-in buries dwarves, refills tunnels, and respawns them", () => {
  const match = arena();
  match.map[tileIndex(4, 5)] = TILE.ROCK;
  match.players[0].carrying = true;
  match.treasure.carriedBy = 0;
  const boom = detonateAt(match, 0, 5.5, 5.5);
  assert.equal(match.players[0].alive, false);
  assert.equal(match.players[0].eliminations, 1);
  assert.equal(match.players[0].respawnIn, BURY_TICKS);
  assert.equal(match.players[0].carrying, false);
  assert.equal(match.treasure.carriedBy, null);
  const center = treasureTile();
  assert.equal(match.treasure.x, center.x);
  assert.equal(match.treasure.y, center.y);
  assert.equal(tileAt(match.map, 5, 5), TILE.DIRT);
  assert.equal(tileAt(match.map, 6, 5), TILE.DIRT);
  assert.equal(tileAt(match.map, 4, 5), TILE.ROCK);
  assert.equal(tileAt(match.map, center.x, center.y), TILE.EMPTY);
  assert.equal(isProtected(center.x, center.y), true);
  assert.ok(boom.some((event) => event.type === "elimination" && event.player === 0));
  assert.ok(boom.some((event) => event.type === "cavein"));
  assert.equal(match.phase, "playing");
  assert.equal(match.players[0].score, 0);

  run(match, BURY_TICKS - 1);
  assert.equal(match.players[0].alive, false);
  step(match, idleActions());
  assert.equal(match.players[0].alive, true);
  const home = spawnTiles()[0];
  assert.ok(Math.abs(match.players[0].x - (home.x + 0.5)) < 1e-6);
  assert.ok(Math.abs(match.players[0].y - (home.y + 0.5)) < 1e-6);
  assert.ok(CAVEIN_RADIUS >= 1);
});

test("safe tiles only stun, dropping a carried treasure short of a score", () => {
  const match = arena();
  match.players[0].carrying = true;
  match.treasure.carriedBy = 0;
  const events = detonateAt(match, 0, 2.5, 1.5);
  assert.equal(match.players[0].alive, true);
  assert.equal(match.players[0].eliminations, 0);
  assert.equal(match.players[0].stun, STUN_TICKS);
  assert.equal(match.players[0].carrying, false);
  assert.equal(match.players[0].score, 0);
  assert.equal(match.phase, "playing");
  assert.equal(match.treasure.carriedBy, null);
  assert.equal(match.treasure.x, 2);
  assert.equal(match.treasure.y, 1);
  assert.equal(tileAt(match.map, 2, 1), TILE.EMPTY);
  assert.ok(events.some((event) => event.type === "stun"));
  assert.ok(events.some((event) => event.type === "drop"));
});

test("a shield blocks one cave-in and a second charge must wait", () => {
  const match = arena();
  match.players[0].shield = true;
  match.players[0].x = 5.5;
  match.players[0].y = 5.5;
  step(match, hold(0, { action: true }));
  step(match, hold(0, { action: true }));
  assert.equal(match.charges.length, 1);
  run(match, CAVEIN_FUSE);
  assert.equal(match.players[0].alive, true);
  assert.equal(match.players[0].shield, false);
  assert.equal(match.players[0].stun, 0);
  assert.equal(match.players[0].eliminations, 0);
  assert.equal(tileAt(match.map, 5, 5), TILE.EMPTY);
  assert.equal(tileAt(match.map, 6, 5), TILE.DIRT);
});
