import { COLS, DWARVES, ROWS, TILE } from "../core/constants.js";
import { CONTROL_FIELDS, keyLabel } from "../core/input.js";
import { isProtected, spawnTiles, tileAt, treasureTile } from "../core/map.js";

export const TILE_PX = 48;
export const HUD_H = 86;
export const VIEW_W = COLS * TILE_PX;
export const VIEW_H = HUD_H + ROWS * TILE_PX;

const DIRT = ["#6b3a24", "#7a4630", "#5a301c"];
const ROCK = ["#6a707c", "#7d8491", "#555b66"];

function hash(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function world(x, y) {
  return { x: x * TILE_PX, y: HUD_H + y * TILE_PX };
}

function drawTile(ctx, map, tx, ty) {
  const tile = tileAt(map, tx, ty);
  const x = tx * TILE_PX;
  const y = HUD_H + ty * TILE_PX;
  const n = hash(tx, ty);
  if (tile === TILE.BEDROCK) {
    ctx.fillStyle = "#241c2c";
    ctx.fillRect(x, y, TILE_PX, TILE_PX);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(x, y, TILE_PX, 3);
    return;
  }
  if (tile === TILE.DIRT || tile === TILE.ROCK) {
    const palette = tile === TILE.DIRT ? DIRT : ROCK;
    ctx.fillStyle = palette[Math.floor(n * palette.length) % palette.length];
    ctx.fillRect(x, y, TILE_PX, TILE_PX);
    ctx.fillStyle = tile === TILE.DIRT ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.12)";
    ctx.fillRect(x, y, TILE_PX, 5);
    ctx.fillStyle = tile === TILE.DIRT ? "#3a2014" : "#3e4450";
    for (let i = 0; i < 3; i++) {
      const px = x + 6 + hash(tx + i, ty + 3) * (TILE_PX - 12);
      const py = y + 10 + hash(tx + 5, ty + i) * (TILE_PX - 16);
      ctx.fillRect(px, py, tile === TILE.ROCK ? 7 : 3, tile === TILE.ROCK ? 3 : 2);
    }
    if (tile === TILE.ROCK) {
      ctx.strokeStyle = "rgba(30,32,40,0.45)";
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 14);
      ctx.lineTo(x + 28, y + 34);
      ctx.stroke();
    }
    return;
  }
  const protectedTile = isProtected(tx, ty);
  ctx.fillStyle = protectedTile ? "#2a2218" : "#16111c";
  ctx.fillRect(x, y, TILE_PX, TILE_PX);
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  ctx.fillRect(x + (n * 20), y + 8, 10, 2);
  const neighbors = [
    [0, -1, 0, 0, TILE_PX, 5],
    [0, 1, 0, TILE_PX - 5, TILE_PX, 5],
    [-1, 0, 0, 0, 5, TILE_PX],
    [1, 0, TILE_PX - 5, 0, 5, TILE_PX],
  ];
  for (const [ox, oy, rx, ry, rw, rh] of neighbors) {
    const next = tileAt(map, tx + ox, ty + oy);
    if (next === TILE.DIRT || next === TILE.ROCK || next === TILE.BEDROCK) {
      ctx.fillStyle = next === TILE.ROCK ? "#3d434d" : "#3a2418";
      ctx.fillRect(x + rx, y + ry, rw, rh);
    }
  }
}

function drawMap(ctx, match) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) drawTile(ctx, match.map, x, y);
  }
  const homes = spawnTiles();
  homes.forEach((home, index) => {
    if (!match.players[index].active) return;
    const cell = world(home.x, home.y);
    ctx.strokeStyle = DWARVES[index].color;
    ctx.lineWidth = 2;
    ctx.strokeRect(cell.x + 4, cell.y + 4, TILE_PX - 8, TILE_PX - 8);
  });
  const center = treasureTile();
  for (let y = center.y - 1; y <= center.y + 1; y++) {
    for (let x = center.x - 1; x <= center.x + 1; x++) {
      const cell = world(x, y);
      ctx.fillStyle = "rgba(255, 196, 70, 0.05)";
      ctx.fillRect(cell.x, cell.y, TILE_PX, TILE_PX);
    }
  }
}

function drawTreasure(ctx, match) {
  if (match.treasure.carriedBy != null) return;
  const bob = Math.sin(match.tick / 8) * 2;
  const cell = world(match.treasure.x + 0.5, match.treasure.y + 0.5);
  ctx.save();
  ctx.translate(cell.x, cell.y + bob);
  ctx.fillStyle = "rgba(255, 200, 60, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0c14a";
  roundRect(ctx, -11, -8, 22, 14, 3);
  ctx.fill();
  ctx.fillStyle = "#8a5a12";
  ctx.fillRect(-11, -2, 22, 3);
  ctx.fillStyle = "#fff4c4";
  ctx.fillRect(-2, -4, 4, 6);
  ctx.restore();
}

function drawCharge(ctx, charge, tick) {
  const cell = world(charge.x + 0.5, charge.y + 0.5);
  const pulse = 0.55 + Math.sin(tick / 3) * 0.25;
  ctx.save();
  ctx.translate(cell.x, cell.y);
  ctx.strokeStyle = `rgba(255, 70, 50, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, (0.35 + (charge.fuse % 10) / 28) * TILE_PX, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ff5644";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPowerup(ctx, powerup, tick) {
  const cell = world(powerup.x + 0.5, powerup.y + 0.5);
  const bob = Math.sin(tick / 9 + powerup.x) * 2;
  const colors = { haste: "#7CFFB2", shield: "#8ecbff", blast: "#ff9b6a" };
  ctx.save();
  ctx.translate(cell.x, cell.y + bob);
  ctx.fillStyle = colors[powerup.kind] || "#fff";
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 9);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1a120c";
  ctx.font = "bold 9px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(powerup.kind === "haste" ? "H" : powerup.kind === "shield" ? "S" : "B", 0, 3);
  ctx.restore();
}

function drawDwarf(ctx, player, tick) {
  const cell = world(player.x, player.y);
  const look = DWARVES[player.id];
  ctx.save();
  ctx.translate(cell.x, cell.y);
  if (!player.alive) {
    ctx.fillStyle = "#4a2c1c";
    ctx.beginPath();
    ctx.ellipse(0, 4, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1810";
    ctx.fillRect(-6, -2, 12, 5);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 16, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  if (player.facingX < 0) ctx.scale(-1, 1);
  ctx.fillStyle = "#2b2118";
  ctx.fillRect(-8, 6, 5, 9);
  ctx.fillRect(3, 6, 5, 9);
  ctx.fillStyle = look.color;
  roundRect(ctx, -10, -6, 20, 16, 5);
  ctx.fill();
  ctx.fillStyle = look.light;
  ctx.beginPath();
  ctx.ellipse(0, 2, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.dark;
  roundRect(ctx, -11, -14, 22, 10, 4);
  ctx.fill();
  ctx.fillStyle = "#1b120c";
  ctx.fillRect(-2, -16, 4, 4);
  ctx.fillStyle = "#fff";
  ctx.fillRect(2, -8, 3, 3);
  ctx.strokeStyle = "#d7d0c4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(18, player.digProgress > 0 ? 8 : -6);
  ctx.stroke();
  ctx.fillStyle = "#c0c6d0";
  ctx.beginPath();
  ctx.moveTo(16, -10);
  ctx.lineTo(22, -4);
  ctx.lineTo(12, -2);
  ctx.fill();
  ctx.restore();
  if (player.carrying) {
    ctx.fillStyle = "#f0c14a";
    roundRect(ctx, -6, -22, 12, 8, 2);
    ctx.fill();
  }
  if (player.shield) {
    ctx.strokeStyle = "rgba(140, 210, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (player.stun > 0) {
    ctx.fillStyle = "#ffe27a";
    const spin = tick / 5;
    for (let i = 0; i < 3; i++) {
      const angle = spin + (i * Math.PI * 2) / 3;
      ctx.fillRect(Math.cos(angle) * 16 - 2, Math.sin(angle) * 10 - 16, 4, 4);
    }
  }
  if (player.digProgress > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(-12, 18, 24, 4);
    ctx.fillStyle = look.color;
    const frac = Math.max(0, Math.min(1, player.digProgress / 108));
    ctx.fillRect(-12, 18, 24 * frac, 4);
  }
  ctx.restore();
}

function drawPad(ctx, x, y, on) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = on ? 1 : 0.25;
  ctx.fillStyle = on ? "#d7ffe8" : "#8d8794";
  roundRect(ctx, 0, 0, 22, 14, 4);
  ctx.fill();
  ctx.fillStyle = "#1b1420";
  ctx.fillRect(4, 4, 3, 6);
  ctx.fillRect(3, 5, 5, 3);
  ctx.beginPath();
  ctx.arc(15, 7, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx, match, pads, muted) {
  ctx.fillStyle = "#120c16";
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = "#e7c27a";
  ctx.fillRect(0, HUD_H - 3, VIEW_W, 3);
  const width = VIEW_W / 4;
  match.players.forEach((player, index) => {
    const look = DWARVES[index];
    const x = index * width;
    ctx.fillStyle = player.active ? look.color : "#3a3340";
    ctx.fillRect(x + 8, 10, 10, 28);
    ctx.fillStyle = player.active ? "#f4efe6" : "#756d7c";
    ctx.font = "bold 16px Trebuchet MS, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(player.name, x + 24, 24);
    ctx.font = "12px Trebuchet MS, sans-serif";
    const tag = !player.active ? "OFF" : player.bot ? "BOT" : "HUMAN";
    ctx.fillStyle = "#b5adba";
    ctx.fillText(tag, x + 24, 40);
    for (let pip = 0; pip < match.roundsToWin; pip++) {
      ctx.fillStyle = pip < player.score ? look.color : "#3a3144";
      roundRect(ctx, x + 78 + pip * 16, 14, 12, 12, 2);
      ctx.fill();
    }
    drawPad(ctx, x + width - 36, 14, !!(pads && pads[index]));
    if (player.carrying) {
      ctx.fillStyle = "#f0c14a";
      ctx.font = "bold 11px Trebuchet MS, sans-serif";
      ctx.fillText("GEM", x + 70, 40);
    }
    if (muted && index === 0) {
      ctx.fillStyle = "#ff8d8d";
      ctx.font = "12px Trebuchet MS, sans-serif";
      ctx.fillText("MUTE", x + 8, 64);
    }
  });
  ctx.fillStyle = "#f4efe6";
  ctx.textAlign = "center";
  ctx.font = "bold 13px Trebuchet MS, sans-serif";
  ctx.fillText(`ROUND ${match.round}  ·  FIRST TO ${match.roundsToWin}`, VIEW_W / 2, 70);
}

function dim(ctx) {
  ctx.fillStyle = "rgba(8, 5, 10, 0.72)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = "rgba(22, 16, 28, 0.94)";
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = "#e7c27a";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function menuLines(ctx, lines, selected, x, y) {
  lines.forEach((line, index) => {
    const here = index === selected;
    ctx.fillStyle = here ? "#e7c27a" : "#f4efe6";
    ctx.font = here ? "bold 22px Trebuchet MS, sans-serif" : "20px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(here ? `▸ ${line}` : line, x, y + index * 36);
  });
}

export function drawGame(ctx, view) {
  const { match } = view;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = "#100c12";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  if (view.shake > 0.4) {
    const mag = view.shake;
    const flip = match.tick % 2 === 0 ? 1 : -1;
    ctx.translate(flip * mag, -flip * mag * 0.5);
  }
  drawMap(ctx, match);
  for (const powerup of match.powerups) drawPowerup(ctx, powerup, match.tick);
  for (const charge of match.charges) drawCharge(ctx, charge, match.tick);
  drawTreasure(ctx, match);
  const ordered = match.players.slice().sort((a, b) => a.y - b.y);
  for (const player of ordered) {
    if (!player.active && player.alive) continue;
    if (!player.active) continue;
    drawDwarf(ctx, player, match.tick);
  }
  for (const particle of view.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawHud(ctx, match, view.pads, view.muted);

  if (match.phase === "countdown") {
    dim(ctx);
    const value = Math.max(1, Math.ceil(match.phaseTimer / 60));
    ctx.fillStyle = "#f4efe6";
    ctx.textAlign = "center";
    ctx.font = "bold 120px Trebuchet MS, sans-serif";
    ctx.fillText(String(value), VIEW_W / 2, VIEW_H / 2);
  } else if (view.goFlash) {
    ctx.fillStyle = "#f4efe6";
    ctx.textAlign = "center";
    ctx.font = "bold 96px Trebuchet MS, sans-serif";
    ctx.fillText("GO", VIEW_W / 2, VIEW_H / 2);
  }

  if (match.phase === "roundEnd" && match.roundWinner != null) {
    dim(ctx);
    panel(ctx, 160, 250, VIEW_W - 320, 160);
    ctx.fillStyle = DWARVES[match.roundWinner].color;
    ctx.textAlign = "center";
    ctx.font = "bold 36px Trebuchet MS, sans-serif";
    ctx.fillText(`${DWARVES[match.roundWinner].name} takes the round`, VIEW_W / 2, 330);
    ctx.fillStyle = "#f4efe6";
    ctx.font = "18px Trebuchet MS, sans-serif";
    ctx.fillText("Back to the tunnels…", VIEW_W / 2, 368);
  }

  if (match.phase === "matchEnd") {
    dim(ctx);
    panel(ctx, 150, 150, VIEW_W - 300, 420);
    ctx.fillStyle = "#e7c27a";
    ctx.textAlign = "center";
    ctx.font = "bold 40px Trebuchet MS, sans-serif";
    const winner = match.winner == null ? "Nobody" : DWARVES[match.winner].name;
    ctx.fillText(`${winner} wins the match`, VIEW_W / 2, 210);
    const ranked = match.players
      .map((player, index) => ({ player, index }))
      .filter((row) => row.player.active)
      .sort((a, b) => b.player.score - a.player.score || a.index - b.index);
    ranked.forEach((row, place) => {
      ctx.fillStyle = DWARVES[row.index].color;
      ctx.font = "22px Trebuchet MS, sans-serif";
      ctx.fillText(`${place + 1}. ${row.player.name}    ${row.player.score}`, VIEW_W / 2, 270 + place * 36);
    });
    menuLines(ctx, ["Rematch", "Title"], view.matchMenu, VIEW_W / 2, 450);
  }
}

export function drawTitle(ctx, images) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (images.cover && images.cover.complete && images.cover.naturalWidth) {
    const scale = Math.max(VIEW_W / images.cover.naturalWidth, VIEW_H / images.cover.naturalHeight);
    const w = images.cover.naturalWidth * scale;
    const h = images.cover.naturalHeight * scale;
    ctx.drawImage(images.cover, (VIEW_W - w) / 2, (VIEW_H - h) / 2, w, h);
  } else {
    ctx.fillStyle = "#1a120c";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  shade.addColorStop(0, "rgba(10, 6, 8, 0.15)");
  shade.addColorStop(0.55, "rgba(10, 6, 8, 0.25)");
  shade.addColorStop(1, "rgba(10, 6, 8, 0.82)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f6e7b2";
  ctx.font = "bold 84px Trebuchet MS, sans-serif";
  ctx.fillText("DIG WARS", VIEW_W / 2, 250);
  ctx.fillStyle = "#f4efe6";
  ctx.font = "22px Trebuchet MS, sans-serif";
  ctx.fillText("Four dwarves. One treasure. Cave in the rest.", VIEW_W / 2, 300);
  ctx.font = "bold 26px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#e7c27a";
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  ctx.globalAlpha = blink ? 1 : 0.45;
  ctx.fillText("Press Start / Enter", VIEW_W / 2, 560);
  ctx.globalAlpha = 1;
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#f4efe6";
  ctx.fillText("4 local players  ·  keyboard or gamepad  ·  M mutes", VIEW_W / 2, 610);
}

export function drawJoin(ctx, slots) {
  ctx.fillStyle = "#140e16";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#e7c27a";
  ctx.font = "bold 42px Trebuchet MS, sans-serif";
  ctx.fillText("Who's digging?", VIEW_W / 2, 90);
  ctx.fillStyle = "#f4efe6";
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillText("ACTION joins  ·  SECONDARY toggles bot / off  ·  Enter or Start begins", VIEW_W / 2, 126);
  slots.forEach((slot, index) => {
    const look = DWARVES[index];
    const x = 48 + index * 190;
    ctx.fillStyle = "#221a28";
    roundRect(ctx, x, 180, 170, 280, 14);
    ctx.fill();
    ctx.fillStyle = look.color;
    ctx.fillRect(x + 20, 200, 130, 12);
    ctx.fillStyle = "#f4efe6";
    ctx.font = "bold 24px Trebuchet MS, sans-serif";
    ctx.fillText(look.name, x + 85, 260);
    ctx.font = "bold 20px Trebuchet MS, sans-serif";
    ctx.fillStyle = slot.mode === "off" ? "#8d8794" : look.light;
    ctx.fillText(slot.mode === "human" ? "HUMAN" : slot.mode === "off" ? "OFF" : "BOT", x + 85, 310);
    ctx.font = "13px Trebuchet MS, sans-serif";
    ctx.fillStyle = "#b5adba";
    const hint = ["F", "/", ";", "Num 0"][index];
    ctx.fillText(`Action ${hint}`, x + 85, 360);
  });
  ctx.fillStyle = "#e7c27a";
  ctx.font = "18px Trebuchet MS, sans-serif";
  ctx.fillText("Empty slots can stay bots so one player can start.", VIEW_W / 2, 540);
}

export function drawPause(ctx, index) {
  dim(ctx);
  panel(ctx, 250, 180, VIEW_W - 500, 320);
  ctx.fillStyle = "#e7c27a";
  ctx.textAlign = "center";
  ctx.font = "bold 32px Trebuchet MS, sans-serif";
  ctx.fillText("Paused", VIEW_W / 2, 240);
  menuLines(ctx, ["Resume", "Settings", "Controls", "Quit to title"], index, VIEW_W / 2, 300);
}

export function drawSettings(ctx, view) {
  dim(ctx);
  panel(ctx, 200, 150, VIEW_W - 400, 400);
  ctx.fillStyle = "#e7c27a";
  ctx.textAlign = "center";
  ctx.font = "bold 32px Trebuchet MS, sans-serif";
  ctx.fillText("Settings", VIEW_W / 2, 210);
  const lines = [
    `Volume  ${Math.round(view.volume * 100)}%`,
    `First to  ${view.roundsToWin}`,
    view.muted ? "Sound  muted" : "Sound  on",
    "Back",
  ];
  menuLines(ctx, lines, view.settingsIndex, VIEW_W / 2, 280);
  ctx.font = "14px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#b5adba";
  ctx.fillText("Left / right change a value. Action toggles sound.", VIEW_W / 2, 500);
}

export function drawControls(ctx, view) {
  dim(ctx);
  panel(ctx, 140, 90, VIEW_W - 280, 540);
  const look = DWARVES[view.controlPlayer];
  ctx.textAlign = "center";
  ctx.fillStyle = look.color;
  ctx.font = "bold 28px Trebuchet MS, sans-serif";
  ctx.fillText(`${look.name} controls`, VIEW_W / 2, 140);
  ctx.font = "14px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#b5adba";
  ctx.fillText("Left / right switch dwarf. Action rebinds the highlighted key. Esc backs out.", VIEW_W / 2, 168);
  const binding = view.bindings[view.controlPlayer];
  CONTROL_FIELDS.forEach((field, index) => {
    const here = index === view.controlField;
    ctx.font = here ? "bold 22px Trebuchet MS, sans-serif" : "20px Trebuchet MS, sans-serif";
    ctx.fillStyle = here ? "#e7c27a" : "#f4efe6";
    const value = view.capturing && here ? "press a key…" : keyLabel(binding[field]);
    ctx.fillText(`${here ? "▸ " : ""}${field}    ${value}`, VIEW_W / 2, 230 + index * 42);
  });
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#f4efe6";
  ctx.fillText("Gamepad (fixed): stick / d-pad move, A action, B secondary, Start pause", VIEW_W / 2, 520);
  ctx.fillText("A connected pad overrides that dwarf's keyboard.", VIEW_W / 2, 548);
}

export function loadImages() {
  const cover = new Image();
  cover.src = "assets/cover.jpg";
  const icon = new Image();
  icon.src = "assets/icon.jpg";
  return { cover, icon };
}
