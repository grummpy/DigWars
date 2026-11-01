import assert from "node:assert/strict";
import test from "node:test";
import { DIG_CONTACT, DIRT_DIG_TICKS, DT, MOVE_SPEED, PLAYER_RADIUS, ROCK_DIG_TICKS, TILE } from "../src/core/constants.js";
import { tileAt, tileIndex } from "../src/core/map.js";
import { createMatch, idleActions, step } from "../src/core/sim.js";
import { hold, run } from "./helpers.js";

function openMatch() {
  return createMatch({
    seed: 3,
    map: "empty",
    skipCountdown: true,
    active: [true, true, false, false],
    bots: [false, false, false, false],
  });
}

test("open ground moves at speed and diagonals stay unit length", () => {
  const match = openMatch();
  match.players[0].x = 4.5;
  match.players[0].y = 6.5;
  run(match, 60, () => hold(0, { x: 1 }));
  assert.ok(Math.abs(match.players[0].x - (4.5 + MOVE_SPEED)) < 1e-6);
  assert.equal(match.players[0].y, 6.5);

  const diagonal = openMatch();
  diagonal.players[0].x = 4.5;
  diagonal.players[0].y = 4.5;
  run(diagonal, 60, () => hold(0, { x: 1, y: 1 }));
  const stepLen = (MOVE_SPEED * Math.SQRT1_2);
  assert.ok(Math.abs(diagonal.players[0].x - (4.5 + stepLen)) < 1e-6);
  assert.ok(Math.abs(diagonal.players[0].y - (4.5 + stepLen)) < 1e-6);
  assert.ok(DT > 0);
});

test("bedrock blocks movement", () => {
  const match = openMatch();
  match.players[0].x = 1.5;
  match.players[0].y = 6.5;
  run(match, 40, () => hold(0, { x: -1 }));
  assert.ok(match.players[0].x >= 1 + PLAYER_RADIUS - 1e-6);
  assert.ok(match.players[0].x < 1 + PLAYER_RADIUS + MOVE_SPEED * DT);
  assert.equal(tileAt(match.map, 0, 6), TILE.BEDROCK);
});

test("dirt and rock stop a dwarf until dug, and rock takes longer", () => {
  function digWall(tile) {
    const match = openMatch();
    match.map[tileIndex(6, 6)] = tile;
    match.players[0].x = 6 - PLAYER_RADIUS - 0.02;
    match.players[0].y = 6.5;
    match.players[0].facingX = 1;
    match.players[0].facingY = 0;
    assert.ok(6 - match.players[0].x <= DIG_CONTACT + PLAYER_RADIUS);
    return match;
  }

  const dirt = digWall(TILE.DIRT);
  run(dirt, DIRT_DIG_TICKS - 1, () => hold(0, { x: 1 }));
  assert.equal(tileAt(dirt.map, 6, 6), TILE.DIRT);
  step(dirt, hold(0, { x: 1 }));
  assert.equal(tileAt(dirt.map, 6, 6), TILE.EMPTY);

  const rock = digWall(TILE.ROCK);
  run(rock, DIRT_DIG_TICKS, () => hold(0, { x: 1 }));
  assert.equal(tileAt(rock.map, 6, 6), TILE.ROCK);
  run(rock, ROCK_DIG_TICKS - DIRT_DIG_TICKS - 1, () => hold(0, { x: 1 }));
  assert.equal(tileAt(rock.map, 6, 6), TILE.ROCK);
  step(rock, hold(0, { x: 1 }));
  assert.equal(tileAt(rock.map, 6, 6), TILE.EMPTY);
  assert.ok(ROCK_DIG_TICKS > DIRT_DIG_TICKS);
});

test("dwarves cannot occupy the same spot", () => {
  const match = openMatch();
  match.players[0].x = 5.5;
  match.players[0].y = 5.5;
  match.players[1].x = 5.7;
  match.players[1].y = 5.5;
  step(match, idleActions());
  const dx = match.players[1].x - match.players[0].x;
  const dy = match.players[1].y - match.players[0].y;
  assert.ok(Math.hypot(dx, dy) >= PLAYER_RADIUS * 2 - 1e-6);
  assert.equal(match.players[0].x, 5.5);
});
