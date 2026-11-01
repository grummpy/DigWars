import { defaultBindings, parseBindings } from "../core/input.js";

const KEY = "digwars.settings";
const ROUNDS = new Set([1, 3, 5]);

export function loadSettings() {
  const fallback = {
    volume: 0.8,
    muted: false,
    roundsToWin: 3,
    bindings: defaultBindings(),
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw);
    const bindings = parseBindings(data.bindings) || defaultBindings();
    const rounds = ROUNDS.has(data.roundsToWin) ? data.roundsToWin : 3;
    const volume = Number.isFinite(data.volume) ? Math.max(0, Math.min(1, data.volume)) : 0.8;
    return {
      volume,
      muted: !!data.muted,
      roundsToWin: rounds,
      bindings,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        volume: settings.volume,
        muted: settings.muted,
        roundsToWin: settings.roundsToWin,
        bindings: settings.bindings,
      }),
    );
  } catch {
    /* private mode and disabled storage still leave the match playable */
  }
}
