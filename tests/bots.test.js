import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, idleActions, step } from "../src/core/sim.js";

test("a solo bot can dig out, take the treasure, and win the round", () => {
  const match = createMatch({
    seed: 2,
    map: "empty",
    skipCountdown: true,
    roundsToWin: 3,
    active: [true, false, false, false],
    bots: [true, false, false, false],
  });
  const startX = match.players[0].x;
  const startY = match.players[0].y;
  let moved = false;
  for (let i = 0; i < 900; i++) {
    step(match, idleActions());
    if (match.players[0].x !== startX || match.players[0].y !== startY) moved = true;
    if (match.players[0].score >= 1) break;
  }
  assert.equal(moved, true);
  assert.equal(match.players[0].score, 1);
  assert.equal(match.roundWinner, 0);
});
