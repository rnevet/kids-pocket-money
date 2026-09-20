import { describe, expect, it } from 'vitest';
import { goalProgress, topActiveGoal } from './goals';
import type { Goal } from './schema';

const g = (id: string, status: Goal['status'], createdAt: string, kidId = 'k'): Goal => ({
  id,
  kidId,
  name: id,
  price: 100,
  status,
  createdAt,
  updatedAt: createdAt,
});

describe('goals', () => {
  it('progress is capped', () => {
    expect(goalProgress(50, 100)).toBe(0.5);
    expect(goalProgress(150, 100)).toBe(1);
    expect(goalProgress(-5, 100)).toBe(0);
    expect(goalProgress(0, 0)).toBe(1);
  });
  it('top active goal is the oldest active one', () => {
    const goals = [
      g('new', 'active', '2026-09-02T00:00:00.000Z'),
      g('done', 'done', '2026-09-01T00:00:00.000Z'),
      g('old', 'active', '2026-09-01T00:00:00.000Z'),
      g('other', 'active', '2026-08-01T00:00:00.000Z', 'x'),
    ];
    expect(topActiveGoal(goals, 'k')?.id).toBe('old');
    expect(topActiveGoal(goals, 'none')).toBeUndefined();
  });
});
