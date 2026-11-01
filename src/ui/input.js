/** DOM keyboard and Gamepad API polling. Hot-plug is just a fresh poll each frame. */

const BLOCKED = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"]);

export function installKeyboard(down, pressed) {
  const onDown = (event) => {
    if (event.repeat) return;
    if (!down.has(event.code)) pressed.add(event.code);
    down.add(event.code);
    if (BLOCKED.has(event.code) || event.code.startsWith("Numpad")) event.preventDefault();
  };
  const onUp = (event) => {
    down.delete(event.code);
  };
  const onBlur = () => down.clear();
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", onBlur);
  return () => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", onBlur);
  };
}

export function readGamepads() {
  const empty = () => ({ connected: false, axes: [0, 0], buttons: [] });
  try {
    const source = navigator.getGamepads ? navigator.getGamepads() : [];
    const pads = [];
    for (let i = 0; i < 4; i++) {
      const pad = source && source[i];
      if (!pad || !pad.connected) {
        pads.push(empty());
        continue;
      }
      pads.push({
        connected: true,
        axes: [pad.axes[0] || 0, pad.axes[1] || 0],
        buttons: Array.from(pad.buttons || [], (button) => !!(button.pressed || button.value > 0.5)),
      });
    }
    return pads;
  } catch {
    return [empty(), empty(), empty(), empty()];
  }
}
