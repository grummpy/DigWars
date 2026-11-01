import assert from "node:assert/strict";
import test from "node:test";
import { makeRng } from "../src/core/rng.js";
import { generateMap } from "../src/core/map.js";
import { createMatch, idleActions, step, visibleState } from "../src/core/sim.js";

function stream(seed, count) {
  const rng = makeRng(seed);
  return Array.from({ length: count }, () => rng.next());
}

test("seeded rng stays inside the unit interval and repeats", () => {
  const a = stream(42, 64);
  const b = stream(42, 64);
  assert.deepEqual(a, b);
  for (const value of a) {
    assert.ok(value >= 0 && value < 1);
  }
  assert.notDeepEqual(stream(42, 16), stream(99, 16));
  assert.equal(makeRng(42).state(), makeRng(42).state());
});

test("map generation is a pure function of the seed", () => {
  const rngA = makeRng(7);
  const rngB = makeRng(7);
  const rngC = makeRng(8);
  assert.deepEqual(generateMap(rngA, "generated"), generateMap(rngB, "generated"));
  assert.notDeepEqual(generateMap(makeRng(7), "generated"), generateMap(rngC, "generated"));
});

test("identical seeds and inputs replay the same match", () => {
  const left = createMatch({ seed: 1234, skipCountdown: true });
  const right = createMatch({ seed: 1234, skipCountdown: true });
  const script = (tick) => {
    const actions = idleActions();
    actions[0] = { x: 1, y: tick % 40 < 20 ? 0 : 1, action: tick % 100 === 0, secondary: tick % 37 === 0, pause: false };
    actions[1] = { x: -1, y: 1, action: tick % 80 === 10, secondary: false, pause: false };
    actions[2] = { x: 0, y: -1, action: false, secondary: tick % 45 === 0, pause: false };
    actions[3] = { x: 1, y: -1, action: tick % 90 === 5, secondary: false, pause: false };
    return actions;
  };
  for (let tick = 0; tick < 240; tick++) {
    step(left, script(tick));
    step(right, script(tick));
  }
  assert.deepEqual(visibleState(left), visibleState(right));
  const other = createMatch({ seed: 99, skipCountdown: true });
  assert.notDeepEqual(other.map, left.map);
});
