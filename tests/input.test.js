import assert from "node:assert/strict";
import test from "node:test";
import {
  actionsFromGamepad,
  actionsFromKeyboard,
  defaultBindings,
  DEADZONE,
  mapInputs,
  parseBindings,
  serializeBindings,
  setBinding,
} from "../src/core/input.js";

test("default keyboard map matches the four-player split", () => {
  const bindings = defaultBindings();
  const cases = [
    [{ KeyW: true }, 0, { x: 0, y: -1 }],
    [{ KeyA: true }, 0, { x: -1, y: 0 }],
    [{ KeyS: true }, 0, { x: 0, y: 1 }],
    [{ KeyD: true, KeyF: true, KeyG: true }, 0, { x: 1, y: 0, action: true, secondary: true }],
    [{ ArrowUp: true, ArrowLeft: true }, 1, { x: -1, y: -1 }],
    [{ Slash: true }, 1, { action: true }],
    [{ Period: true }, 1, { secondary: true }],
    [{ KeyI: true, KeyJ: true }, 2, { x: -1, y: -1 }],
    [{ KeyK: true, KeyL: true }, 2, { x: 1, y: 1 }],
    [{ Semicolon: true, Quote: true }, 2, { action: true, secondary: true }],
    [{ Numpad8: true, Numpad4: true }, 3, { x: -1, y: -1 }],
    [{ Numpad5: true, Numpad6: true }, 3, { x: 1, y: 1 }],
    [{ Numpad0: true, NumpadEnter: true }, 3, { action: true, secondary: true }],
  ];
  for (const [keys, index, expected] of cases) {
    const action = actionsFromKeyboard(bindings[index], keys);
    for (const [field, value] of Object.entries(expected)) {
      assert.equal(action[field], value, `${index} ${field}`);
    }
  }
});

test("a connected pad overrides that player's keyboard", () => {
  const bindings = defaultBindings();
  const keys = new Set(["KeyA", "KeyF"]);
  const idlePad = { connected: true, axes: [0, 0], buttons: [] };
  const overridden = mapInputs({ bindings, keysDown: keys, gamepads: [idlePad] });
  assert.equal(overridden.actions[0].x, 0);
  assert.equal(overridden.actions[0].action, false);

  const activePad = { connected: true, axes: [0.8, -0.9], buttons: { a: true, b: true, start: true } };
  const stick = mapInputs({ bindings, keysDown: keys, gamepads: [activePad] });
  assert.ok(stick.actions[0].x > DEADZONE);
  assert.ok(stick.actions[0].y < -DEADZONE);
  assert.equal(stick.actions[0].action, true);
  assert.equal(stick.actions[0].secondary, true);
  assert.equal(stick.pause, true);

  const keyboard = mapInputs({
    bindings,
    keysDown: keys,
    gamepads: [{ connected: false, axes: [0.8, 0], buttons: { a: true } }],
  });
  assert.equal(keyboard.actions[0].x, -1);
  assert.equal(keyboard.actions[0].action, true);
  assert.equal(keyboard.pause, false);
});

test("gamepad d-pad, deadzone, and button indexes map to actions", () => {
  const below = actionsFromGamepad({ axes: [DEADZONE, 0], buttons: [] });
  assert.equal(below.x, 0);
  const dpad = actionsFromGamepad({
    axes: [-1, 0],
    buttons: [false, false, false, false, false, false, false, false, false, true, false, false, true, false, false, true],
  });
  assert.equal(dpad.y, -1);
  assert.equal(dpad.x, 1);
  assert.equal(dpad.pause, true);
  const face = actionsFromGamepad({ axes: [0, 0], buttons: [true, true] });
  assert.equal(face.action, true);
  assert.equal(face.secondary, true);
});

test("bindings remap, round-trip, and reject reserved keys", () => {
  const remapped = setBinding(defaultBindings(), 0, "action", "KeyQ");
  assert.equal(remapped[0].action, "KeyQ");
  assert.equal(actionsFromKeyboard(remapped[0], { KeyF: true }).action, false);
  assert.equal(actionsFromKeyboard(remapped[0], { KeyQ: true }).action, true);

  const swapped = setBinding(defaultBindings(), 0, "action", "KeyW");
  assert.equal(swapped[0].action, "KeyW");
  assert.equal(swapped[0].up, "KeyF");

  const reserved = setBinding(defaultBindings(), 1, "action", "Escape");
  assert.equal(reserved[1].action, "Slash");

  const raw = serializeBindings(remapped);
  assert.deepEqual(parseBindings(raw), remapped);
  assert.equal(parseBindings("{nope"), null);
  assert.equal(parseBindings([{ up: "KeyW" }]), null);
});

test("escape pauses even when a pad is idle", () => {
  const mapped = mapInputs({
    bindings: defaultBindings(),
    keysDown: new Set(["Escape"]),
    gamepads: [],
  });
  assert.equal(mapped.pause, true);
});
