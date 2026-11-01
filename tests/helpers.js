import { idleActions, step } from "../src/core/sim.js";

export function hold(player, patch) {
  const actions = idleActions();
  actions[player] = { ...actions[player], ...patch };
  return actions;
}

export function run(match, count, makeActions = () => idleActions()) {
  const events = [];
  for (let i = 0; i < count; i++) events.push(step(match, makeActions(i)));
  return events;
}

export function untilPhase(match, phase) {
  let guard = 0;
  while (match.phase !== phase) {
    step(match, idleActions());
    if (++guard > 5000) throw new Error(`stuck in ${match.phase}, waiting for ${phase}`);
  }
}
