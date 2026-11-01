/** Tunables shared by the simulation, tests, and renderer. */

export const COLS = 17;
export const ROWS = 13;
export const PLAYER_COUNT = 4;
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const TILE = {
  BEDROCK: 0,
  DIRT: 1,
  ROCK: 2,
  EMPTY: 3,
};

export const PLAYER_RADIUS = 0.28;
export const MOVE_SPEED = 3.15;
export const CARRY_SPEED = 2.25;
export const HASTE_MULT = 1.45;

export const DIRT_DIG_TICKS = 36;
export const ROCK_DIG_TICKS = 108;
export const HASTE_DIG_MULT = 2;
export const DIG_CONTACT = PLAYER_RADIUS + 0.12;

export const CAVEIN_FUSE = 75;
export const CAVEIN_RADIUS = 2;
export const CAVEIN_COOLDOWN = 180;
export const STUN_TICKS = 75;
export const BURY_TICKS = 150;
export const INVULN_TICKS = 40;

export const POWER_SWING_COOLDOWN = 45;
export const ROCK_SWING_TICKS = 36;

export const COUNTDOWN_TICKS = 180;
export const ROUND_END_TICKS = 150;
export const DEFAULT_ROUNDS_TO_WIN = 3;

export const POWERUP_INTERVAL = 480;
export const POWERUP_MAX = 2;
export const HASTE_TICKS = 300;

export const DWARVES = [
  { id: 0, name: "Ruby", color: "#e23b3b", dark: "#7d1c1c", light: "#ffb4b4" },
  { id: 1, name: "Teal", color: "#1aa89a", dark: "#0d5850", light: "#b6fff4" },
  { id: 2, name: "Amber", color: "#e0922f", dark: "#8a5410", light: "#ffe0b0" },
  { id: 3, name: "Violet", color: "#9b6ad6", dark: "#59348a", light: "#e4d0ff" },
];
