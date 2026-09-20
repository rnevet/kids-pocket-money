import type { Minor } from './money';
import type { Goal } from './schema';

/** Progress toward a goal in [0, 1]. */
export function goalProgress(balance: Minor, price: Minor): number {
  if (price <= 0) return 1;
  if (balance <= 0) return 0;
  return Math.min(1, balance / price);
}

/** The goal shown on the kid's home card: oldest active goal. */
export function topActiveGoal(goals: readonly Goal[], kidId: string): Goal | undefined {
  return goals
    .filter((g) => g.kidId === kidId && g.status === 'active')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))[0];
}
