import { COLS, ROWS, TILE } from "./constants.js";

export function treasureTile() {
  return { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };
}

export function spawnTiles() {
  return [
    { x: 1, y: 1 },
    { x: COLS - 2, y: 1 },
    { x: 1, y: ROWS - 2 },
    { x: COLS - 2, y: ROWS - 2 },
  ];
}

/** 2x2 pocket opening toward the center from a corner spawn. */
export function pocketCells(spawn) {
  const sx = spawn.x <= 2 ? 1 : -1;
  const sy = spawn.y <= 2 ? 1 : -1;
  const cells = [];
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      cells.push({ x: spawn.x + dx * sx, y: spawn.y + dy * sy });
    }
  }
  return cells;
}

export function isProtected(x, y) {
  for (const spawn of spawnTiles()) {
    for (const cell of pocketCells(spawn)) {
      if (cell.x === x && cell.y === y) return true;
    }
  }
  const treasure = treasureTile();
  return Math.abs(x - treasure.x) <= 1 && Math.abs(y - treasure.y) <= 1;
}

export function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < COLS && y < ROWS;
}

export function tileIndex(x, y) {
  return y * COLS + x;
}

export function generateMap(rng, mode = "generated") {
  const tiles = new Array(COLS * ROWS).fill(TILE.BEDROCK);
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      let tile = TILE.DIRT;
      if (mode === "empty") tile = TILE.EMPTY;
      else if (mode === "dirt") tile = TILE.DIRT;
      else tile = rng.next() < 0.22 ? TILE.ROCK : TILE.DIRT;
      tiles[tileIndex(x, y)] = tile;
    }
  }
  for (const spawn of spawnTiles()) {
    for (const cell of pocketCells(spawn)) {
      tiles[tileIndex(cell.x, cell.y)] = TILE.EMPTY;
    }
  }
  const treasure = treasureTile();
  for (let y = treasure.y - 1; y <= treasure.y + 1; y++) {
    for (let x = treasure.x - 1; x <= treasure.x + 1; x++) {
      tiles[tileIndex(x, y)] = TILE.EMPTY;
    }
  }
  return tiles;
}

export function tileAt(map, x, y) {
  if (!inBounds(x, y)) return TILE.BEDROCK;
  return map[tileIndex(x, y)];
}

export function isSolid(tile) {
  return tile !== TILE.EMPTY;
}
