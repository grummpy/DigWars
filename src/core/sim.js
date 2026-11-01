import { decideBot } from "./bot.js";
import {
  BURY_TICKS,
  CARRY_SPEED,
  CAVEIN_COOLDOWN,
  CAVEIN_FUSE,
  CAVEIN_RADIUS,
  COLS,
  COUNTDOWN_TICKS,
  DEFAULT_ROUNDS_TO_WIN,
  DIG_CONTACT,
  DIRT_DIG_TICKS,
  DT,
  DWARVES,
  HASTE_DIG_MULT,
  HASTE_MULT,
  HASTE_TICKS,
  INVULN_TICKS,
  MOVE_SPEED,
  PLAYER_COUNT,
  PLAYER_RADIUS,
  POWER_SWING_COOLDOWN,
  POWERUP_INTERVAL,
  POWERUP_MAX,
  ROCK_DIG_TICKS,
  ROCK_SWING_TICKS,
  ROUND_END_TICKS,
  STUN_TICKS,
  TILE,
} from "./constants.js";
import { isProtected, generateMap, spawnTiles, tileAt, tileIndex, treasureTile } from "./map.js";
import { makeRng } from "./rng.js";

const ZERO = { x: 0, y: 0, action: false, secondary: false, pause: false };

export function idleActions() {
  return Array.from({ length: PLAYER_COUNT }, () => ({ ...ZERO }));
}

function clampAxis(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-1, Math.min(1, number));
}

function normalizeActions(actions) {
  const list = Array.isArray(actions) ? actions : [];
  return Array.from({ length: PLAYER_COUNT }, (_, index) => {
    const action = list[index] || ZERO;
    return {
      x: clampAxis(action.x),
      y: clampAxis(action.y),
      action: !!action.action,
      secondary: !!action.secondary,
      pause: !!action.pause,
    };
  });
}

function normalizeMove(x, y) {
  const mag = Math.hypot(x, y);
  if (mag === 0) return { x: 0, y: 0 };
  if (mag <= 1) return { x, y };
  return { x: x / mag, y: y / mag };
}

export function createPlayer(id, active, bot) {
  const home = spawnTiles()[id];
  return {
    id,
    name: DWARVES[id].name,
    active,
    bot,
    x: home.x + 0.5,
    y: home.y + 0.5,
    facingX: id % 2 === 0 ? 1 : -1,
    facingY: 0,
    alive: active,
    stun: 0,
    respawnIn: 0,
    invuln: 0,
    haste: 0,
    shield: false,
    blastReady: false,
    carrying: false,
    score: 0,
    eliminations: 0,
    digX: -1,
    digY: -1,
    digProgress: 0,
    caveCooldown: 0,
    swingCooldown: 0,
    prevAction: false,
    prevSecondary: false,
  };
}

function resetBody(player) {
  const home = spawnTiles()[player.id];
  player.x = home.x + 0.5;
  player.y = home.y + 0.5;
  player.facingX = player.id % 2 === 0 ? 1 : -1;
  player.facingY = 0;
  player.alive = player.active;
  player.stun = 0;
  player.respawnIn = 0;
  player.invuln = 0;
  player.haste = 0;
  player.shield = false;
  player.blastReady = false;
  player.carrying = false;
  player.digX = -1;
  player.digY = -1;
  player.digProgress = 0;
  player.caveCooldown = 0;
  player.swingCooldown = 0;
}

export function beginRound(match, advance = false) {
  if (advance) match.round += 1;
  match.map = generateMap(match.rng, match.mapMode);
  match.charges = [];
  match.powerups = [];
  const center = treasureTile();
  match.treasure = { x: center.x, y: center.y, carriedBy: null };
  for (const player of match.players) resetBody(player);
  match.phase = "countdown";
  match.phaseTimer = COUNTDOWN_TICKS;
  match.roundWinner = null;
}

export function createMatch(options = {}) {
  const seed = options.seed ?? 1;
  const active = options.active ?? [true, true, true, true];
  const bots = options.bots ?? [false, false, false, false];
  const match = {
    seed,
    rng: makeRng(seed),
    mapMode: options.map ?? "generated",
    roundsToWin: options.roundsToWin ?? DEFAULT_ROUNDS_TO_WIN,
    round: 1,
    tick: 0,
    phase: "countdown",
    phaseTimer: COUNTDOWN_TICKS,
    roundWinner: null,
    winner: null,
    map: [],
    charges: [],
    powerups: [],
    treasure: { x: 0, y: 0, carriedBy: null },
    players: Array.from({ length: PLAYER_COUNT }, (_, id) => createPlayer(id, !!active[id], !!bots[id] && !!active[id])),
  };
  beginRound(match, false);
  if (options.skipCountdown) {
    match.phase = "playing";
    match.phaseTimer = 0;
  }
  return match;
}

function overlappingSolid(match, x, y) {
  const radius = PLAYER_RADIUS;
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.floor(y + radius);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (tileAt(match.map, tx, ty) === TILE.EMPTY) continue;
      const nearestX = Math.max(tx, Math.min(x, tx + 1));
      const nearestY = Math.max(ty, Math.min(y, ty + 1));
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < radius * radius - 1e-9) return { tx, ty };
    }
  }
  return null;
}

function moveAxis(match, player, axis, delta) {
  if (!delta) return false;
  const previous = player[axis];
  player[axis] = previous + delta;
  if (overlappingSolid(match, player.x, player.y)) {
    player[axis] = previous;
    return true;
  }
  return false;
}

function frontTile(player) {
  return {
    x: Math.floor(player.x) + player.facingX,
    y: Math.floor(player.y) + player.facingY,
  };
}

function inContact(player, tx, ty) {
  if (player.facingX === 0 && player.facingY === 0) return false;
  const nearestX = Math.max(tx, Math.min(player.x, tx + 1));
  const nearestY = Math.max(ty, Math.min(player.y, ty + 1));
  return Math.hypot(player.x - nearestX, player.y - nearestY) <= DIG_CONTACT;
}

function digTile(match, player, tx, ty, amount, events) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= match.map.length / COLS) return false;
  const index = tileIndex(tx, ty);
  const tile = match.map[index];
  if (tile !== TILE.DIRT && tile !== TILE.ROCK) return false;
  if (player.digX !== tx || player.digY !== ty) {
    player.digX = tx;
    player.digY = ty;
    player.digProgress = 0;
  }
  const need = tile === TILE.DIRT ? DIRT_DIG_TICKS : ROCK_DIG_TICKS;
  const before = player.digProgress;
  player.digProgress += amount;
  if (Math.floor(before / 10) !== Math.floor(player.digProgress / 10)) {
    events.push({ type: "dig", player: player.id, x: tx, y: ty });
  }
  if (player.digProgress >= need) {
    match.map[index] = TILE.EMPTY;
    player.digProgress = 0;
    player.digX = -1;
    player.digY = -1;
    events.push({ type: "break", player: player.id, x: tx, y: ty, tile });
  }
  return true;
}

function updateMovement(match, player, action, events) {
  const move = normalizeMove(action.x, action.y);
  if (move.x !== 0 || move.y !== 0) {
    if (Math.abs(move.x) > Math.abs(move.y)) {
      player.facingX = Math.sign(move.x);
      player.facingY = 0;
    } else if (Math.abs(move.y) > 0) {
      player.facingX = 0;
      player.facingY = Math.sign(move.y);
    }
  }
  const speed = (player.carrying ? CARRY_SPEED : MOVE_SPEED) * (player.haste > 0 ? HASTE_MULT : 1);
  moveAxis(match, player, "x", move.x * speed * DT);
  moveAxis(match, player, "y", move.y * speed * DT);

  const pressing = move.x !== 0 || move.y !== 0;
  if (!pressing) return;
  const front = frontTile(player);
  const aligned =
    (player.facingX !== 0 && Math.sign(move.x) === player.facingX) ||
    (player.facingY !== 0 && Math.sign(move.y) === player.facingY);
  if (!aligned || !inContact(player, front.x, front.y)) {
    const tile = tileAt(match.map, front.x, front.y);
    if (tile !== TILE.DIRT && tile !== TILE.ROCK) {
      player.digProgress = 0;
      player.digX = -1;
      player.digY = -1;
    }
    return;
  }
  const amount = player.haste > 0 ? HASTE_DIG_MULT : 1;
  digTile(match, player, front.x, front.y, amount, events);
}

function trySwing(match, player, events) {
  if (player.swingCooldown > 0) return;
  const front = frontTile(player);
  if (!inContact(player, front.x, front.y)) return;
  const tile = tileAt(match.map, front.x, front.y);
  if (tile !== TILE.DIRT && tile !== TILE.ROCK) return;
  player.swingCooldown = POWER_SWING_COOLDOWN;
  const amount = tile === TILE.DIRT ? DIRT_DIG_TICKS : ROCK_SWING_TICKS;
  digTile(match, player, front.x, front.y, amount, events);
  events.push({ type: "swing", player: player.id, x: front.x, y: front.y });
}

function tryPlant(match, player, events) {
  if (player.caveCooldown > 0) return;
  const tx = Math.floor(player.x);
  const ty = Math.floor(player.y);
  if (tileAt(match.map, tx, ty) !== TILE.EMPTY) return;
  if (match.charges.some((charge) => charge.x === tx && charge.y === ty)) return;
  const radius = CAVEIN_RADIUS + (player.blastReady ? 1 : 0);
  player.blastReady = false;
  player.caveCooldown = CAVEIN_COOLDOWN;
  match.charges.push({
    owner: player.id,
    x: tx,
    y: ty,
    fuse: CAVEIN_FUSE,
    radius,
    live: false,
  });
  events.push({ type: "plant", player: player.id, x: tx, y: ty, radius });
}

function separatePlayers(match) {
  const min = PLAYER_RADIUS * 2;
  for (let i = 0; i < PLAYER_COUNT; i++) {
    for (let j = i + 1; j < PLAYER_COUNT; j++) {
      const a = match.players[i];
      const b = match.players[j];
      if (!a.active || !b.active || !a.alive || !b.alive) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distSq = dx * dx + dy * dy;
      if (distSq === 0) {
        dx = 0.01;
        dy = 0;
        distSq = dx * dx;
      }
      if (distSq >= min * min) continue;
      const dist = Math.sqrt(distSq);
      const push = (min - dist) / dist;
      const nextX = b.x + dx * push;
      const nextY = b.y + dy * push;
      if (!overlappingSolid(match, nextX, b.y)) b.x = nextX;
      if (!overlappingSolid(match, b.x, nextY)) b.y = nextY;
    }
  }
}

function sendTreasureHome(match) {
  const center = treasureTile();
  match.treasure.x = center.x;
  match.treasure.y = center.y;
  match.treasure.carriedBy = null;
}

function dropTreasure(match, player, events, buried) {
  if (match.treasure.carriedBy !== player.id && !player.carrying) return;
  player.carrying = false;
  if (match.treasure.carriedBy !== player.id) return;
  match.treasure.carriedBy = null;
  const tx = Math.floor(player.x);
  const ty = Math.floor(player.y);
  if (buried || tileAt(match.map, tx, ty) !== TILE.EMPTY) sendTreasureHome(match);
  else {
    match.treasure.x = tx;
    match.treasure.y = ty;
  }
  events.push({ type: "drop", player: player.id, x: match.treasure.x, y: match.treasure.y });
}

function eliminate(match, player, events) {
  player.eliminations += 1;
  player.alive = false;
  player.respawnIn = BURY_TICKS;
  player.stun = 0;
  player.digProgress = 0;
  player.digX = -1;
  player.digY = -1;
  dropTreasure(match, player, events, true);
  events.push({ type: "elimination", player: player.id });
}

function stun(match, player, events) {
  player.stun = STUN_TICKS;
  player.digProgress = 0;
  player.digX = -1;
  player.digY = -1;
  dropTreasure(match, player, events, false);
  events.push({ type: "stun", player: player.id });
}

function detonate(match, charge, events) {
  const planned = [];
  for (let y = charge.y - charge.radius; y <= charge.y + charge.radius; y++) {
    for (let x = charge.x - charge.radius; x <= charge.x + charge.radius; x++) {
      if (!Number.isFinite(x) || x < 0 || y < 0 || x >= COLS || y >= match.map.length / COLS) continue;
      if (Math.max(Math.abs(x - charge.x), Math.abs(y - charge.y)) > charge.radius) continue;
      if (tileAt(match.map, x, y) === TILE.EMPTY && !isProtected(x, y)) planned.push({ x, y });
    }
  }
  const spared = new Set();
  const victims = [];
  for (const player of match.players) {
    if (!player.active || !player.alive || player.invuln > 0) continue;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const dist = Math.max(Math.abs(px - charge.x), Math.abs(py - charge.y));
    if (dist > charge.radius) continue;
    const willBury = planned.some((tile) => tile.x === px && tile.y === py);
    if (player.shield) {
      player.shield = false;
      if (willBury) spared.add(`${px},${py}`);
      events.push({ type: "shield", player: player.id });
      continue;
    }
    victims.push({ player, willBury });
  }
  for (const tile of planned) {
    if (spared.has(`${tile.x},${tile.y}`)) continue;
    match.map[tileIndex(tile.x, tile.y)] = TILE.DIRT;
  }
  for (const victim of victims) {
    if (victim.willBury && tileAt(match.map, Math.floor(victim.player.x), Math.floor(victim.player.y)) !== TILE.EMPTY) {
      eliminate(match, victim.player, events);
    } else {
      stun(match, victim.player, events);
    }
  }
  events.push({ type: "cavein", x: charge.x, y: charge.y, radius: charge.radius, owner: charge.owner });
}

function tickCharges(match, events) {
  const ordered = match.charges.slice().sort((a, b) => a.owner - b.owner || a.x - b.x || a.y - b.y);
  const ripe = [];
  const alive = [];
  for (const charge of ordered) {
    if (!charge.live) {
      charge.live = true;
      alive.push(charge);
      continue;
    }
    charge.fuse -= 1;
    if (charge.fuse <= 0) ripe.push(charge);
    else alive.push(charge);
  }
  match.charges = alive;
  for (const charge of ripe) detonate(match, charge, events);
}

function tryPickupTreasure(match, player, events) {
  if (!player.alive || player.stun > 0 || player.carrying) return;
  if (match.treasure.carriedBy != null) return;
  const cx = match.treasure.x + 0.5;
  const cy = match.treasure.y + 0.5;
  if (Math.abs(player.x - cx) < 0.5 && Math.abs(player.y - cy) < 0.5) {
    match.treasure.carriedBy = player.id;
    player.carrying = true;
    events.push({ type: "treasure", player: player.id });
  }
}

function applyPowerup(player, kind, events) {
  if (kind === "haste") player.haste = HASTE_TICKS;
  else if (kind === "shield") player.shield = true;
  else if (kind === "blast") player.blastReady = true;
  events.push({ type: "powerup", player: player.id, kind });
}

function tryPickupPowerups(match, player, events) {
  if (!player.alive || player.stun > 0) return;
  const kept = [];
  for (const powerup of match.powerups) {
    const cx = powerup.x + 0.5;
    const cy = powerup.y + 0.5;
    if (Math.abs(player.x - cx) < 0.45 && Math.abs(player.y - cy) < 0.45) {
      applyPowerup(player, powerup.kind, events);
    } else kept.push(powerup);
  }
  match.powerups = kept;
}

function tryDeliver(match, player, events) {
  if (!player.carrying || !player.alive || player.stun > 0) return false;
  const home = spawnTiles()[player.id];
  if (Math.abs(player.x - (home.x + 0.5)) >= 0.5 || Math.abs(player.y - (home.y + 0.5)) >= 0.5) return false;
  player.score += 1;
  player.carrying = false;
  match.treasure.carriedBy = null;
  sendTreasureHome(match);
  match.roundWinner = player.id;
  events.push({ type: "score", player: player.id, score: player.score });
  if (player.score >= match.roundsToWin) {
    match.phase = "matchEnd";
    match.winner = player.id;
    match.phaseTimer = 0;
    events.push({ type: "matchWin", player: player.id });
  } else {
    match.phase = "roundEnd";
    match.phaseTimer = ROUND_END_TICKS;
    events.push({ type: "roundWin", player: player.id });
  }
  return true;
}

function maybeSpawnPowerup(match) {
  if (match.tick <= 0 || match.tick % POWERUP_INTERVAL !== 0) return;
  if (match.powerups.length >= POWERUP_MAX) return;
  const occupied = new Set();
  occupied.add(`${match.treasure.x},${match.treasure.y}`);
  for (const charge of match.charges) occupied.add(`${charge.x},${charge.y}`);
  for (const powerup of match.powerups) occupied.add(`${powerup.x},${powerup.y}`);
  for (const player of match.players) {
    if (!player.active || !player.alive) continue;
    occupied.add(`${Math.floor(player.x)},${Math.floor(player.y)}`);
  }
  const spots = [];
  const rows = match.map.length / COLS;
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (tileAt(match.map, x, y) !== TILE.EMPTY) continue;
      if (isProtected(x, y)) continue;
      if (occupied.has(`${x},${y}`)) continue;
      spots.push({ x, y });
    }
  }
  if (spots.length === 0) return;
  const spot = spots[match.rng.int(spots.length)];
  const roll = match.rng.next();
  const kind = roll < 1 / 3 ? "haste" : roll < 2 / 3 ? "shield" : "blast";
  match.powerups.push({ x: spot.x, y: spot.y, kind });
}

function respawn(player) {
  const home = spawnTiles()[player.id];
  player.alive = true;
  player.x = home.x + 0.5;
  player.y = home.y + 0.5;
  player.respawnIn = 0;
  player.stun = 0;
  player.invuln = INVULN_TICKS;
  player.carrying = false;
  player.digProgress = 0;
  player.digX = -1;
  player.digY = -1;
}

function tickCountdown(match, events) {
  const before = match.phaseTimer;
  match.phaseTimer -= 1;
  if (before === COUNTDOWN_TICKS) events.push({ type: "countdown", value: 3 });
  else if (before === Math.round((COUNTDOWN_TICKS * 2) / 3)) events.push({ type: "countdown", value: 2 });
  else if (before === Math.round(COUNTDOWN_TICKS / 3)) events.push({ type: "countdown", value: 1 });
  if (match.phaseTimer <= 0) {
    match.phase = "playing";
    match.phaseTimer = 0;
    events.push({ type: "countdown", value: 0 });
  }
}

export function step(match, actions) {
  const events = [];
  const resolved = normalizeActions(actions);
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const player = match.players[i];
    if (player.active && player.bot) resolved[i] = decideBot(match, player);
  }
  const edges = resolved.map((action, index) => {
    const player = match.players[index];
    const actionEdge = action.action && !player.prevAction;
    const secondaryEdge = action.secondary && !player.prevSecondary;
    player.prevAction = action.action;
    player.prevSecondary = action.secondary;
    return { ...action, actionEdge, secondaryEdge };
  });

  match.tick += 1;

  if (match.phase === "countdown") {
    tickCountdown(match, events);
    return events;
  }
  if (match.phase === "roundEnd") {
    match.phaseTimer -= 1;
    if (match.phaseTimer <= 0) beginRound(match, true);
    return events;
  }
  if (match.phase === "matchEnd") return events;

  for (const player of match.players) {
    if (!player.active) continue;
    if (player.caveCooldown > 0) player.caveCooldown -= 1;
    if (player.swingCooldown > 0) player.swingCooldown -= 1;
    if (player.haste > 0) player.haste -= 1;
    if (player.invuln > 0) player.invuln -= 1;
    if (player.stun > 0) player.stun -= 1;
    if (!player.alive) {
      player.respawnIn -= 1;
      if (player.respawnIn <= 0) {
        respawn(player);
        events.push({ type: "respawn", player: player.id });
      }
    }
  }

  for (const player of match.players) {
    if (!player.active || !player.alive || player.stun > 0) continue;
    const action = edges[player.id];
    updateMovement(match, player, action, events);
    if (action.secondaryEdge) trySwing(match, player, events);
    if (action.actionEdge) tryPlant(match, player, events);
  }

  separatePlayers(match);
  tickCharges(match, events);

  if (match.phase !== "playing") return events;

  for (const player of match.players) {
    if (!player.active || !player.alive || player.stun > 0) continue;
    tryPickupTreasure(match, player, events);
    tryPickupPowerups(match, player, events);
    if (tryDeliver(match, player, events)) break;
  }

  if (match.phase === "playing") maybeSpawnPowerup(match);
  return events;
}

export function visibleState(match) {
  return {
    map: match.map.slice(),
    players: match.players.map((player) => ({ ...player })),
    treasure: { ...match.treasure },
    charges: match.charges.map((charge) => ({ ...charge })),
    powerups: match.powerups.map((powerup) => ({ ...powerup })),
    phase: match.phase,
    phaseTimer: match.phaseTimer,
    round: match.round,
    tick: match.tick,
    winner: match.winner,
    roundWinner: match.roundWinner,
    roundsToWin: match.roundsToWin,
  };
}
