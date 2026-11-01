import assert from "node:assert/strict";
import test from "node:test";
import {
  CAVEIN_RADIUS,
  DIRT_DIG_TICKS,
  HASTE_DIG_MULT,
  HASTE_TICKS,
  PLAYER_RADIUS,
  POWERUP_INTERVAL,
  ROCK_SWING_TICKS,
  TILE,
} from "../src/core/constants.js";
import { tileAt, tileIndex } from "../src/core/map.js";
import { createMatch, idleActions, step, visibleState } from "../src/core/sim.js";
import { hold, run } from "./helpers.js";

function arena() {
  return createMatch({
    seed: 21,
    map: "empty",
    skipCountdown: true,
    active: [true, false, false, false],
    bots: [false, false, false, false],
  });
}

test("haste, shield, and blast powder are collected on contact", () => {
  const match = arena();
  match.powerups.push({ x: 4, y: 4, kind: "haste" });
  match.powerups.push({ x: 4, y: 5, kind: "shield" });
  match.players[0].x = 4.5;
  match.players[0].y = 4.5;
  let events = step(match, idleActions());
  assert.equal(match.players[0].haste, HASTE_TICKS);
  assert.ok(events.some((event) => event.type === "powerup" && event.kind === "haste"));
  match.players[0].y = 5.5;
  events = step(match, idleActions());
  assert.equal(match.players[0].shield, true);
  assert.equal(match.powerups.length, 0);
  match.players[0].blastReady = true;
  match.players[0].x = 5.5;
  match.players[0].y = 5.5;
  events = step(match, hold(0, { action: true }));
  assert.equal(match.charges[0].radius, CAVEIN_RADIUS + 1);
  assert.equal(match.players[0].blastReady, false);
  assert.ok(events.some((event) => event.type === "plant"));
});

test("secondary pick smash opens dirt and chips rock", () => {
  const dirt = arena();
  dirt.map[tileIndex(6, 6)] = TILE.DIRT;
  dirt.players[0].x = 6 - PLAYER_RADIUS - 0.02;
  dirt.players[0].y = 6.5;
  dirt.players[0].facingX = 1;
  const events = step(dirt, hold(0, { secondary: true }));
  assert.equal(tileAt(dirt.map, 6, 6), TILE.EMPTY);
  assert.ok(events.some((event) => event.type === "swing"));
  assert.ok(events.some((event) => event.type === "break"));

  const rock = arena();
  rock.map[tileIndex(6, 6)] = TILE.ROCK;
  rock.players[0].x = 6 - PLAYER_RADIUS - 0.02;
  rock.players[0].y = 6.5;
  rock.players[0].facingX = 1;
  step(rock, hold(0, { secondary: true }));
  assert.equal(tileAt(rock.map, 6, 6), TILE.ROCK);
  assert.equal(rock.players[0].digProgress, ROCK_SWING_TICKS);
  assert.ok(ROCK_SWING_TICKS < DIRT_DIG_TICKS || ROCK_SWING_TICKS === 36);
});

test("haste digs dirt in fewer ticks", () => {
  const match = arena();
  match.map[tileIndex(6, 6)] = TILE.DIRT;
  match.players[0].x = 6 - PLAYER_RADIUS - 0.02;
  match.players[0].y = 6.5;
  match.players[0].haste = 100;
  const ticks = Math.ceil(DIRT_DIG_TICKS / HASTE_DIG_MULT);
  run(match, ticks - 1, () => hold(0, { x: 1 }));
  assert.equal(tileAt(match.map, 6, 6), TILE.DIRT);
  step(match, hold(0, { x: 1 }));
  assert.equal(tileAt(match.map, 6, 6), TILE.EMPTY);
});

test("power-up spawns are deterministic for a seed", () => {
  function spawned(seed) {
    const match = createMatch({
      seed,
      map: "empty",
      skipCountdown: true,
      active: [true, false, false, false],
      bots: [false, false, false, false],
    });
    run(match, POWERUP_INTERVAL);
    return visibleState(match).powerups;
  }
  const first = spawned(4);
  assert.ok(first.length >= 1);
  assert.deepEqual(first, spawned(4));
  assert.notDeepEqual(first, spawned(5));
});
