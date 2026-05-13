export type HealthState = {
  current: number;
  max: number;
  invulnerableUntil: number;
};

export const DEFAULT_MAX_HEALTH = 3;
export const DAMAGE_INVULNERABLE_MS = 1000;

export function createHealthState(max = DEFAULT_MAX_HEALTH): HealthState {
  return {
    current: max,
    max,
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
