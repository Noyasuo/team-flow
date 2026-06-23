import { describe, expect, it } from 'vitest';
import { LOGIN, TASKS } from '../lib/graphql';

describe('graphql documents', () => {
  it('exports login and tasks operations', () => {
    expect(LOGIN.definitions.length).toBeGreaterThan(0);
    expect(TASKS.definitions.length).toBeGreaterThan(0);
  });
});
