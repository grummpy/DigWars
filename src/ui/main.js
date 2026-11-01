import { CONTROL_FIELDS, mapInputs, setBinding } from "../core/input.js";
import { createMatch, step } from "../core/sim.js";
import { createAudio } from "./audio.js";
import { installKeyboard, readGamepads } from "./input.js";
import {
  HUD_H,
  TILE_PX,
  VIEW_H,
  VIEW_W,
  drawControls,
  drawGame,
  drawJoin,
  drawPause,
  drawSettings,
  drawTitle,
  loadImages,
} from "./render.js";
import { loadSettings, saveSettings } from "./storage.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const images = loadImages();
const audio = createAudio();
const keys = new Set();
const tapped = new Set();
installKeyboard(keys, tapped);

const saved = loadSettings();
const ui = {
  screen: "title",
  paused: false,
  pauseIndex: 0,
  settingsIndex: 0,
  controlPlayer: 0,
  controlField: 0,
  capturing: false,
  matchMenu: 0,
  slots: [
    { mode: "bot" },
    { mode: "bot" },
    { mode: "bot" },
    { mode: "bot" },
  ],
  bindings: saved.bindings,
  volume: saved.volume,
  muted: saved.muted,
  roundsToWin: saved.roundsToWin,
  match: null,
  particles: [],
  shake: 0,
  goUntil: 0,
};

audio.setVolume(ui.volume);
audio.setMuted(ui.muted);

let prevKeys = new Set();
let prevPads = readGamepads();
let last = performance.now();
let acc = 0;

function persist() {
  saveSettings({
    volume: ui.volume,
    muted: ui.muted,
    roundsToWin: ui.roundsToWin,
    bindings: ui.bindings,
  });
}

function fit() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(VIEW_W * dpr);
  canvas.height = Math.round(VIEW_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function keySnapshot() {
  const snap = new Set(keys);
  for (const code of tapped) snap.add(code);
  return snap;
}

function freshKey(snap) {
  for (const code of snap) {
    if (!prevKeys.has(code)) return code;
  }
  return null;
}

function edges(pads, snap) {
  const pressed = [];
  for (let i = 0; i < 4; i++) {
    const now = mapInputs({ bindings: ui.bindings, keysDown: new Set(), gamepads: pads.map((pad, index) => (index === i ? pad : { connected: false })) }).actions[i];
    const beforePad = prevPads[i] && prevPads[i].connected ? prevPads[i] : { connected: false };
    const before = mapInputs({
      bindings: ui.bindings,
      keysDown: new Set(),
      gamepads: [0, 1, 2, 3].map((index) => (index === i ? beforePad : { connected: false })),
    }).actions[i];
    const keyNow = mapInputs({ bindings: ui.bindings, keysDown: snap, gamepads: [] }).actions[i];
    const keyBefore = mapInputs({ bindings: ui.bindings, keysDown: prevKeys, gamepads: [] }).actions[i];
    const usePad = pads[i] && pads[i].connected;
    const current = usePad ? now : keyNow;
    const previous = usePad ? before : keyBefore;
    pressed.push({
      action: current.action && !previous.action,
      secondary: current.secondary && !previous.secondary,
      start: usePad && now.pause && !before.pause,
      x: current.x,
      y: current.y,
      prevY: previous.y,
      prevX: previous.x,
    });
  }
  return pressed;
}

function anyEdge(list, field) {
  return list.some((row) => row[field]);
}

function menuAxis(list, axis, previous) {
  let dir = 0;
  const snap = keySnapshot();
  for (const row of list) {
    if (row[axis] > 0.5 && row[previous] <= 0.5) dir = 1;
    if (row[axis] < -0.5 && row[previous] >= -0.5) dir = -1;
  }
  const hit = (code) => snap.has(code) && !prevKeys.has(code);
  if (axis === "y") {
    if (hit("ArrowDown") || hit("KeyS")) dir = 1;
    if (hit("ArrowUp") || hit("KeyW")) dir = -1;
  } else {
    if (hit("ArrowRight") || hit("KeyD")) dir = 1;
    if (hit("ArrowLeft") || hit("KeyA")) dir = -1;
  }
  return dir;
}

function burst(tileX, tileY, color, count) {
  const x = tileX * TILE_PX;
  const y = HUD_H + tileY * TILE_PX;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 2.2;
    ui.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 18 + Math.random() * 16,
      max: 34,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function paintEvents(events) {
  if (!events) return;
  for (const event of events) {
      if (event.type === "break") burst(event.x + 0.5, event.y + 0.5, "#c4845a", 8);
      if (event.type === "cavein") {
        ui.shake = 7;
        burst(event.x + 0.5, event.y + 0.5, "#ff6a4a", 18);
      }
      if (event.type === "treasure") {
        const carrier = ui.match.players[event.player];
        burst(carrier.x, carrier.y, "#f0c14a", 10);
      }
    if (event.type === "countdown" && event.value === 0) ui.goUntil = performance.now() + 650;
  }
  audio.play(events);
}

function startMatch() {
  const active = ui.slots.map((slot) => slot.mode !== "off");
  if (!active.some(Boolean)) return;
  const bots = ui.slots.map((slot) => slot.mode !== "human" && slot.mode !== "off");
  const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  ui.match = createMatch({
    seed,
    roundsToWin: ui.roundsToWin,
    active,
    bots,
  });
  ui.paused = false;
  ui.pauseIndex = 0;
  ui.screen = "play";
  ui.particles = [];
  ui.shake = 0;
}

function cycleRounds(dir) {
  const options = [1, 3, 5];
  const index = Math.max(0, options.indexOf(ui.roundsToWin));
  ui.roundsToWin = options[(index + dir + options.length) % options.length];
  if (ui.match) ui.match.roundsToWin = ui.roundsToWin;
  persist();
}

function update() {
  const pads = readGamepads();
  const padOn = pads.map((pad) => !!(pad && pad.connected));
  const snap = keySnapshot();
  const menu = edges(pads, snap);
  const escapeEdge = snap.has("Escape") && !prevKeys.has("Escape");
  const enterEdge = (snap.has("Enter") && !prevKeys.has("Enter")) || anyEdge(menu, "start");
  const actionEdge = anyEdge(menu, "action");
  const muteEdge = snap.has("KeyM") && !prevKeys.has("KeyM");

  if (ui.screen === "controls" && ui.capturing) {
    const code = freshKey(snap);
    if (code) {
      ui.capturing = false;
      if (code !== "Escape") {
        ui.bindings = setBinding(ui.bindings, ui.controlPlayer, CONTROL_FIELDS[ui.controlField], code);
        persist();
      }
    }
    prevKeys = new Set(keys);
    prevPads = pads;
    return;
  }

  if (muteEdge && ui.screen !== "controls") {
    ui.muted = !ui.muted;
    audio.setMuted(ui.muted);
    persist();
  }

  if (ui.screen === "title") {
    if (enterEdge || actionEdge || escapeEdge) {
      audio.unlock();
      ui.screen = "join";
    }
  } else if (ui.screen === "join") {
    menu.forEach((row, index) => {
      if (row.action) ui.slots[index].mode = "human";
      else if (row.secondary) {
        const mode = ui.slots[index].mode;
        ui.slots[index].mode = mode === "off" ? "bot" : mode === "human" ? "bot" : "off";
      }
    });
    if (enterEdge && ui.slots.some((slot) => slot.mode !== "off")) startMatch();
    else if (escapeEdge) ui.screen = "title";
  } else if (ui.screen === "settings") {
    const vertical = menuAxis(menu, "y", "prevY");
    const horizontal = menuAxis(menu, "x", "prevX");
    if (vertical) ui.settingsIndex = (ui.settingsIndex + vertical + 4) % 4;
    if (ui.settingsIndex === 0 && horizontal) {
      ui.volume = Math.max(0, Math.min(1, Math.round((ui.volume + horizontal * 0.1) * 10) / 10));
      audio.setVolume(ui.volume);
      persist();
    } else if (ui.settingsIndex === 1 && horizontal) cycleRounds(horizontal);
    else if (ui.settingsIndex === 2 && (actionEdge || enterEdge || horizontal)) {
      ui.muted = !ui.muted;
      audio.setMuted(ui.muted);
      persist();
    } else if (ui.settingsIndex === 3 && (actionEdge || enterEdge || escapeEdge)) {
      ui.screen = ui.match ? "play" : "title";
    } else if (escapeEdge) ui.screen = ui.match ? "play" : "title";
  } else if (ui.screen === "controls") {
    const vertical = menuAxis(menu, "y", "prevY");
    const horizontal = menuAxis(menu, "x", "prevX");
    if (horizontal) ui.controlPlayer = (ui.controlPlayer + horizontal + 4) % 4;
    if (vertical) ui.controlField = (ui.controlField + vertical + CONTROL_FIELDS.length) % CONTROL_FIELDS.length;
    if (actionEdge || enterEdge) ui.capturing = true;
    else if (escapeEdge) ui.screen = ui.match ? "play" : "title";
  } else if (ui.screen === "play" && ui.match) {
    if (ui.match.phase === "matchEnd") {
      const vertical = menuAxis(menu, "y", "prevY");
      if (vertical) ui.matchMenu = (ui.matchMenu + vertical + 2) % 2;
      if (actionEdge || enterEdge) {
        if (ui.matchMenu === 0) startMatch();
        else {
          ui.screen = "title";
          ui.match = null;
        }
      } else if (escapeEdge) {
        ui.screen = "title";
        ui.match = null;
      }
    } else if (escapeEdge || anyEdge(menu, "start")) {
      ui.paused = !ui.paused;
      if (ui.paused) ui.pauseIndex = 0;
    } else if (ui.paused) {
      const vertical = menuAxis(menu, "y", "prevY");
      if (vertical) ui.pauseIndex = (ui.pauseIndex + vertical + 4) % 4;
      if (actionEdge || enterEdge) {
        if (ui.pauseIndex === 0) ui.paused = false;
        else if (ui.pauseIndex === 1) {
          ui.screen = "settings";
          ui.settingsIndex = 0;
        } else if (ui.pauseIndex === 2) {
          ui.screen = "controls";
          ui.capturing = false;
        } else {
          ui.screen = "title";
          ui.match = null;
          ui.paused = false;
        }
      }
    } else {
      const mapped = mapInputs({ bindings: ui.bindings, keysDown: snap, gamepads: pads });
      const events = step(ui.match, mapped.actions);
      paintEvents(events);
      if (ui.match.phase === "matchEnd") ui.matchMenu = 0;
    }
  }

  for (const particle of ui.particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 1;
  }
  ui.particles = ui.particles.filter((particle) => particle.life > 0);
  if (ui.shake > 0) ui.shake *= 0.82;

  tapped.clear();
  prevKeys = new Set(keys);
  prevPads = pads;
  ui.pads = padOn;
}

function render() {
  const pads = ui.pads || [false, false, false, false];
  if (ui.screen === "title") {
    drawTitle(ctx, images);
    return;
  }
  if (ui.screen === "join") {
    drawJoin(ctx, ui.slots);
    return;
  }
  if (ui.match) {
    drawGame(ctx, {
      match: ui.match,
      pads,
      muted: ui.muted,
      particles: ui.particles,
      shake: ui.shake,
      goFlash: performance.now() < ui.goUntil,
      matchMenu: ui.matchMenu,
    });
  } else {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#140e16";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (ui.screen === "play" && ui.paused && ui.match && ui.match.phase !== "matchEnd") drawPause(ctx, ui.pauseIndex);
  if (ui.screen === "settings") drawSettings(ctx, ui);
  if (ui.screen === "controls") drawControls(ctx, ui);
}

function frame(now) {
  let delta = now - last;
  last = now;
  if (delta > 250) delta = 250;
  acc += delta;
  let guard = 0;
  while (acc >= 1000 / 60 && guard < 5) {
    update();
    acc -= 1000 / 60;
    guard += 1;
  }
  render();
  requestAnimationFrame(frame);
}

fit();
window.addEventListener("resize", fit);
window.addEventListener("pointerdown", () => audio.unlock(), { once: true });
requestAnimationFrame(frame);
