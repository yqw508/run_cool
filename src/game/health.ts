export type HealthState = {
  current: number;
  max: number;
  invulnerableUntil: number;
};

export const DEFAULT_MAX_HEALTH = 3;
export const DAMAGE_INVULNERABLE_MS = 1000;

export function createHealthState(max = DEFAULT_MAX_HEALTH, current = max): HealthState {
  const safeMax = Math.max(1, max);
  return {
    current: Math.max(0, Math.min(current, safeMax)),
    max: safeMax,
    invulnerableUntil: 0
  };
}

export function isInvulnerable(state: HealthState, now: number): boolean {
  return now < state.invulnerableUntil;
}

export function applyDamage(state: HealthState, now: number): HealthState {
  if (isInvulnerable(state, now) || state.current <= 0) {
    return state;
  }

  return {
    ...state,
    current: Math.max(0, state.current - 1),
    invulnerableUntil: now + DAMAGE_INVULNERABLE_MS
  };
}

export function isDefeated(state: HealthState): boolean {
  return state.current <= 0;
}
