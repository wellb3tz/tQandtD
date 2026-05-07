import { describe, expect, it } from 'vitest';
import { requiresWorldRebuild } from './configChange';

describe('requiresWorldRebuild', () => {
  it('returns true for generation and runtime world config patches', () => {
    expect(requiresWorldRebuild({ terrainConfig: {} })).toBe(true);
    expect(requiresWorldRebuild({ biomeConfig: {} })).toBe(true);
    expect(requiresWorldRebuild({ enhancedBiomeConfig: {} })).toBe(true);
    expect(requiresWorldRebuild({ resourceConfig: {} })).toBe(true);
    expect(requiresWorldRebuild({ structureConfig: {} })).toBe(true);
    expect(requiresWorldRebuild({ lakeConfig: {} })).toBe(true);
    expect(requiresWorldRebuild({ riverConfig: {} })).toBe(true);
    expect(requiresWorldRebuild({ noise3DConfig: {} })).toBe(true);
    expect(requiresWorldRebuild({ seed: 42 })).toBe(true);
    expect(requiresWorldRebuild({ chunkSize: 64 })).toBe(true);
    expect(requiresWorldRebuild({ maxCacheSize: 2000 })).toBe(true);
    expect(requiresWorldRebuild({ workerPoolConfig: undefined })).toBe(true);
  });

  it('returns false for patches that do not affect generated world data', () => {
    expect(requiresWorldRebuild({})).toBe(false);
  });
});

