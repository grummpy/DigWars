import assert from "node:assert/strict";
import test from "node:test";
import { COUNTDOWN_TICKS, DEFAULT_ROUNDS_TO_WIN, ROUND_END_TICKS } from "../src/core/constants.js";
import { spawnTiles, treasureTile } from "../src/core/map.js";
import { createMatch, idleActions, step } from "../src/core/sim.js";
import { run, untilPhase } from "./helpers.js";

function match(roundsToWin = DEFAULT_ROUNDS_TO_WIN) {
  return createMatch({
    seed: 5,
    map: "empty",
    skipCountdown: true,
    roundsToWin,
    bots: [false, false, false, false],
  });
}

function deliver(game, id) {
  const center = treasureTile();
  for (const player of game.players) player.carrying = false;
  game.treasure.carriedBy = null;
  game.treasure.x = center.x;
  game.treasure.y = center.y;
  game.phase = "playing";
  game.players[id].alive = true;
  game.players[id].stun = 0;
  game.players[id].x = center.x + 0.5;
  game.players[id].y = center.y + 0.5;
  const picked = step(game, idleActions());
  assert.equal(game.players[id].carrying, true, "pickup");
  assert.ok(picked.some((event) => event.type === "treasure" && event.player === id));
  const home = spawnTiles()[id];
  game.players[id].x = home.x + 0.5;
  game.players[id].y = home.y + 0.5;
  return step(game, idleActions());
}

test("countdown announces 3-2-1 then starts the round", () => {
  const game = createMatch({ seed: 1, map: "empty" });
  assert.equal(game.phase, "countdown");
  const events = run(game, COUNTDOWN_TICKS).flat();
  assert.equal(game.phase, "playing");
  assert.ok(events.some((event) => event.type === "countdown" && event.value === 3));
  assert.ok(events.some((event) => event.type === "countdown" && event.value === 2));
  assert.ok(events.some((event) => event.type === "countdown" && event.value === 1));
  assert.ok(events.some((event) => event.type === "countdown" && event.value === 0));
});

test("only the carrier scores, and only at their own corner", () => {
  const game = match();
  const home = spawnTiles()[0];
  game.players[0].x = home.x + 0.5;
  game.players[0].y = home.y + 0.5;
  step(game, idleActions());
  assert.equal(game.players[0].score, 0);
  assert.equal(game.phase, "playing");

  game.players[1].carrying = true;
  game.treasure.carriedBy = 1;
  game.players[1].x = home.x + 0.5;
  game.players[1].y = home.y + 0.5;
  step(game, idleActions());
  assert.equal(game.players[1].score, 0);
  assert.equal(game.players[1].carrying, true);

  const home2 = spawnTiles()[1];
  game.players[1].x = home2.x + 0.5;
  game.players[1].y = home2.y + 0.5;
  const events = step(game, idleActions());
  assert.equal(game.players[1].score, 1);
  assert.equal(game.phase, "roundEnd");
  assert.equal(game.roundWinner, 1);
  assert.ok(events.some((event) => event.type === "roundWin" && event.player === 1));
});

test("first to 3 round wins takes the match and scores survive the reset", () => {
  const game = match(3);
  assert.equal(DEFAULT_ROUNDS_TO_WIN, 3);
  deliver(game, 0);
  assert.equal(game.players[0].score, 1);
  assert.equal(game.phase, "roundEnd");
  run(game, ROUND_END_TICKS);
  assert.equal(game.phase, "countdown");
  assert.equal(game.round, 2);
  assert.equal(game.players[0].score, 1);
  untilPhase(game, "playing");

  deliver(game, 0);
  assert.equal(game.players[0].score, 2);
  untilPhase(game, "playing");
  const events = deliver(game, 0);
  assert.equal(game.players[0].score, 3);
  assert.equal(game.phase, "matchEnd");
  assert.equal(game.winner, 0);
  assert.ok(events.some((event) => event.type === "matchWin" && event.player === 0));
  run(game, 30);
  assert.equal(game.phase, "matchEnd");
  assert.equal(game.players[0].score, 3);
});

test("a custom round target ends the match early", () => {
  const game = match(1);
  deliver(game, 2);
  assert.equal(game.phase, "matchEnd");
  assert.equal(game.winner, 2);
});
