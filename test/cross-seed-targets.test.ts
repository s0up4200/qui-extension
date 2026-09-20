import { describe, expect, test } from 'bun:test';
import type { AssembleResult, CrossSeedProposals } from '../lib/api';
import { defaultTargets, targetRows } from '../lib/cross-seed-targets';

const proposal = (hash: string) => ({
  hash, name: hash, size: 1, category: 'tv', effective_save_path: '', overlap_bytes: 1, overlap_fraction: 1,
});

const match = (over: Partial<CrossSeedProposals>): CrossSeedProposals => ({
  pack_mode: false,
  assembly_unavailable_reason: '',
  source_name: 'pack',
  source_size: 1,
  source_file_count: 1,
  default_tags: [],
  pinned_category: '',
  proposals: [proposal('aa'), proposal('bb')],
  ...over,
});

const assemble: AssembleResult = {
  ready: false, applied: false, reason: '', message: '', matched_episodes: 2, total_episodes: 3,
  coverage: 0.66, missing_bytes: 1, default_category: 'tv',
  targets: [
    { hash: 'aa', name: 'aa', reason: '' },
    { hash: 'CC', name: 'cc', reason: '' },
    { hash: 'dd', name: 'dd', reason: 'incomplete' },
  ],
};

describe('defaultTargets', () => {
  test('preselects the unrejected suggestions for a pack', () => {
    expect(defaultTargets(match({ pack_mode: true }), assemble)).toEqual(['aa', 'cc']);
  });

  test('falls back to the top proposal when assembly is unavailable', () => {
    expect(defaultTargets(match({ pack_mode: true, assembly_unavailable_reason: 'no_link_mode' }), assemble)).toEqual(['aa']);
    expect(defaultTargets(match({}), null)).toEqual(['aa']);
    expect(defaultTargets(match({ proposals: [] }), null)).toEqual([]);
  });
});

describe('targetRows', () => {
  test('appends suggestions missing from the proposals, matching hashes case-insensitively', () => {
    const rows = targetRows(match({ proposals: [proposal('aa'), proposal('cc')] }), assemble);
    expect(rows.map((r) => r.hash)).toEqual(['aa', 'cc', 'dd']);
    expect(rows.map((r) => r.detail).at(-1)).toBe('suggested episode');
  });
});
