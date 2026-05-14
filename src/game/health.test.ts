import { describe, expect, it } from 'vitest';
import { applyDamage, createHealthState, isDefeated, isInvulnerable } from './health';

describe('health state', () => {
  it('starts with three health points and no invulnerability', () => {
    expect(createHealthState()).toEqual({ current: 3, max: 3, invulnerableUntil: 0 });
  });

  it('can start with configured current and max health', () => {
    expect(createHealthState(5, 4)).toEqual({ current: 4, max: 5, invulnerableUntil: 0 });
  });

  it('clamps configured current health into range', () => {
    expect(createHealthState(2, 5)).toEqual({ current: 2, max: 2, invulnerableUntil: 0 });
  });

  it('reduces health by one on valid damage', () => {
    expect(applyDamage(createHealthState(), 1000)).toEqual({
      current: 2,
      max: 3,
      invulnerableUntil: 2000
    });
  });

  it('ignores damage during invulnerability', () => {
    const damaged = applyDamage(createHealthState(), 1000);
    expect(applyDamage(damaged, 1500)).toBe(damaged);
  });

  it('clamps health at zero', () => {
    const first = applyDamage(createHealthState(), 1000);
    const second = applyDamage(first, 2100);
    const third = applyDamage(second, 3200);
    const fourth = applyDamage(third, 4300);
    expect(fourth.current).toBe(0);
  });

  it('reports invulnerability and defeated state', () => {
    const damaged = applyDamage(createHealthState(), 1000);
    expect(isInvulnerable(damaged, 1500)).toBe(true);
    expect(isInvulnerable(damaged, 2000)).toBe(false);

    const defeated = applyDamage(applyDamage(damaged, 2100), 3200);
    expect(isDefeated(defeated)).toBe(true);
  });
});
