/** Keyboard and gamepad state → per-player actions. No DOM. */

export const DEADZONE = 0.35;

export const CONTROL_FIELDS = ["up", "down", "left", "right", "action", "secondary"];

const KEY_LABELS = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Slash: "/",
  Period: ".",
  Semicolon: ";",
  Quote: "'",
  Numpad0: "Num 0",
  Numpad1: "Num 1",
  Numpad2: "Num 2",
  Numpad3: "Num 3",
  Numpad4: "Num 4",
  Numpad5: "Num 5",
  Numpad6: "Num 6",
  Numpad7: "Num 7",
  Numpad8: "Num 8",
  Numpad9: "Num 9",
  NumpadEnter: "Num Enter",
  Space: "Space",
  Enter: "Enter",
  Escape: "Esc",
};

export function defaultBindings() {
  return [
    { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", action: "KeyF", secondary: "KeyG" },
    { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", action: "Slash", secondary: "Period" },
    { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", action: "Semicolon", secondary: "Quote" },
    { up: "Numpad8", down: "Numpad5", left: "Numpad4", right: "Numpad6", action: "Numpad0", secondary: "NumpadEnter" },
  ];
}

export function cloneBindings(bindings) {
  return bindings.map((row) => ({ ...row }));
}

export function keyLabel(code) {
  if (!code) return "—";
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

export function setBinding(bindings, player, field, code) {
  if (!CONTROL_FIELDS.includes(field)) return cloneBindings(bindings);
  if (player < 0 || player > 3) return cloneBindings(bindings);
  if (code === "Escape" || code === "Enter") return cloneBindings(bindings);
  const next = cloneBindings(bindings);
  for (const row of next) {
    for (const name of CONTROL_FIELDS) {
      if (row[name] === code) row[name] = next[player][field];
    }
  }
  next[player][field] = code;
  return next;
}

export function serializeBindings(bindings) {
  return JSON.stringify(bindings);
}

export function parseBindings(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(data) || data.length !== 4) return null;
    const bindings = [];
    for (const row of data) {
      if (!row || typeof row !== "object") return null;
      const next = {};
      for (const field of CONTROL_FIELDS) {
        if (typeof row[field] !== "string" || row[field].length === 0) return null;
        next[field] = row[field];
      }
      bindings.push(next);
    }
    return bindings;
  } catch {
    return null;
  }
}

function hasKey(keysDown, code) {
  if (!keysDown || !code) return false;
  if (typeof keysDown.has === "function") return keysDown.has(code);
  return !!keysDown[code];
}

export function actionsFromKeyboard(binding, keysDown) {
  let x = 0;
  let y = 0;
  if (hasKey(keysDown, binding.left)) x -= 1;
  if (hasKey(keysDown, binding.right)) x += 1;
  if (hasKey(keysDown, binding.up)) y -= 1;
  if (hasKey(keysDown, binding.down)) y += 1;
  return {
    x,
    y,
    action: hasKey(keysDown, binding.action),
    secondary: hasKey(keysDown, binding.secondary),
    pause: false,
  };
}

function buttonDown(buttons, index, name) {
  if (!buttons) return false;
  if (Array.isArray(buttons)) return !!buttons[index];
  if (typeof buttons[index] === "boolean") return buttons[index];
  if (buttons[index] && typeof buttons[index] === "object") return !!(buttons[index].pressed || buttons[index].value > 0.5);
  if (name && buttons[name]) return true;
  return false;
}

export function actionsFromGamepad(pad) {
  const buttons = pad?.buttons;
  let x = 0;
  let y = 0;
  const dpadLeft = buttonDown(buttons, 14, "left");
  const dpadRight = buttonDown(buttons, 15, "right");
  const dpadUp = buttonDown(buttons, 12, "up");
  const dpadDown = buttonDown(buttons, 13, "down");
  if (dpadLeft) x -= 1;
  if (dpadRight) x += 1;
  if (dpadUp) y -= 1;
  if (dpadDown) y += 1;
  const ax = Number(pad?.axes?.[0] ?? 0);
  const ay = Number(pad?.axes?.[1] ?? 0);
  if (x === 0 && Number.isFinite(ax) && Math.abs(ax) > DEADZONE) x = Math.max(-1, Math.min(1, ax));
  if (y === 0 && Number.isFinite(ay) && Math.abs(ay) > DEADZONE) y = Math.max(-1, Math.min(1, ay));
  return {
    x,
    y,
    action: buttonDown(buttons, 0, "a"),
    secondary: buttonDown(buttons, 1, "b"),
    pause: buttonDown(buttons, 9, "start"),
  };
}

/**
 * Pads 0–3 override that player's keyboard bindings while connected.
 * Escape and any Start button request a pause.
 */
export function mapInputs({ bindings, keysDown, gamepads }) {
  const rows = bindings && bindings.length === 4 ? bindings : defaultBindings();
  const pads = gamepads || [];
  const actions = [0, 1, 2, 3].map((index) => {
    const pad = pads[index];
    if (pad && pad.connected) return actionsFromGamepad(pad);
    return actionsFromKeyboard(rows[index], keysDown);
  });
  const pause = hasKey(keysDown, "Escape") || actions.some((action) => action.pause);
  return { actions, pause };
}
