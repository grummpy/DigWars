import { CAVEIN_RADIUS, TILE } from "./constants.js";
import { isProtected, spawnTiles, tileAt } from "./map.js";

function zeroAction() {
  return { x: 0, y: 0, action: false, secondary: false, pause: false };
}

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function threatened(match, x, y) {
  if (isProtected(x, y)) return false;
  for (const charge of match.charges) {
    if (chebyshev(charge.x, charge.y, x, y) <= charge.radius && charge.fuse <= 90) return true;
  }
  return false;
}

function goalFor(match, player) {
  const home = spawnTiles()[player.id];
  const here = { x: Math.floor(player.x), y: Math.floor(player.y) };
  if (threatened(match, here.x, here.y) && !player.carrying) return home;
  if (player.carrying) return home;
  if (match.treasure.carriedBy == null) return { x: match.treasure.x, y: match.treasure.y };
  const carrier = match.players[match.treasure.carriedBy];
  if (!carrier || carrier.id === player.id) return home;
  return { x: Math.floor(carrier.x), y: Math.floor(carrier.y) };
}

function tileKind(match, x, y) {
  return tileAt(match.map, x, y);
}

function stepIsUsable(match, player, sx, sy) {
  if (sx === 0 && sy === 0) return true;
  const tx = Math.floor(player.x) + sx;
  const ty = Math.floor(player.y) + sy;
  const tile = tileKind(match, tx, ty);
  if (tile === TILE.BEDROCK) return false;
  if (sx !== 0 && sy !== 0) {
    const sideA = tileKind(match, Math.floor(player.x) + sx, Math.floor(player.y));
    const sideB = tileKind(match, Math.floor(player.x), Math.floor(player.y) + sy);
    if (sideA === TILE.BEDROCK || sideB === TILE.BEDROCK) return false;
  }
  if (tile === TILE.EMPTY && threatened(match, tx, ty)) return false;
  return true;
}

function directionToward(match, player, goal) {
  const dx = goal.x + 0.5 - player.x;
  const dy = goal.y + 0.5 - player.y;
  const sx = Math.abs(dx) < 0.12 ? 0 : Math.sign(dx);
  const sy = Math.abs(dy) < 0.12 ? 0 : Math.sign(dy);
  const options = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (sx) options.push([sx, 0]);
    if (sy) options.push([0, sy]);
  } else {
    if (sy) options.push([0, sy]);
    if (sx) options.push([sx, 0]);
  }
  if (sx && sy) options.push([sx, sy]);
  for (const [ox, oy] of options) {
    if (stepIsUsable(match, player, ox, oy)) return { x: ox, y: oy };
  }
  const flee = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [ox, oy] of flee) {
    const tile = tileKind(match, Math.floor(player.x) + ox, Math.floor(player.y) + oy);
    if (tile === TILE.EMPTY && !threatened(match, Math.floor(player.x) + ox, Math.floor(player.y) + oy)) {
      return { x: ox, y: oy };
    }
  }
  return { x: sx, y: sy };
}

function wantsCaveIn(match, player) {
  if (player.caveCooldown > 0 || player.carrying) return false;
  const tx = Math.floor(player.x);
  const ty = Math.floor(player.y);
  if (tileKind(match, tx, ty) !== TILE.EMPTY) return false;
  if (match.charges.some((charge) => charge.x === tx && charge.y === ty)) return false;
  for (const other of match.players) {
    if (other.id === player.id || !other.active || !other.alive || !other.carrying) continue;
    const dist = chebyshev(tx, ty, Math.floor(other.x), Math.floor(other.y));
    if (dist <= CAVEIN_RADIUS) return true;
  }
  return false;
}

export function decideBot(match, player) {
  if (!player.active || !player.alive || player.stun > 0) return zeroAction();
  const goal = goalFor(match, player);
  const dir = directionToward(match, player, goal);
  const wantPlant = wantsCaveIn(match, player);
  const facingX = dir.x !== 0 ? Math.sign(dir.x) : player.facingX;
  const facingY = dir.x !== 0 ? 0 : dir.y !== 0 ? Math.sign(dir.y) : player.facingY;
  const front = tileKind(match, Math.floor(player.x) + (facingX || 0), Math.floor(player.y) + (facingY || 0));
  const facingSolid = front === TILE.DIRT || front === TILE.ROCK;
  return {
    x: dir.x,
    y: dir.y,
    action: wantPlant && !player.prevAction,
    secondary: facingSolid && player.swingCooldown === 0 && !player.prevSecondary,
    pause: false,
  };
}
