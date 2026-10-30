import { describe, expect, test } from 'bun:test';
import type { AssembleResult, CrossSeedProposals } from '../lib/api';
import { defaultTargets, searchDetail, targetRows, trackerHost } from '../lib/cross-seed-targets';

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

  test('shows the save path and the tracker host of each row', () => {
    const locations = new Map([
      ['aa', { save_path: '/data/links/tl', tracker: 'https://tl.example.org/a/SECRETPASSKEY/announce' }],
      ['dd', { save_path: '/data/tv', tracker: 'udp://tracker.example.net:1337/announce' }],
    ]);
    const rows = targetRows(match({ proposals: [proposal('AA'), proposal('cc')] }), assemble, locations);
    expect(rows.map((r) => r.detail)).toEqual([
      '100% overlap · 1 B · tv · /data/links/tl · tl.example.org',
      '100% overlap · 1 B · tv',
      'suggested episode · /data/tv · tracker.example.net',
    ]);
    expect(rows.some((r) => r.detail.includes('SECRETPASSKEY'))).toBe(false);
  });

  test('leaves out an empty save path or tracker with no empty separator', () => {
    const locations = new Map([
      ['aa', { save_path: '', tracker: 'https://tl.example.org/announce' }],
      ['bb', { save_path: '/data/tv', tracker: '' }],
      ['cc', { save_path: '', tracker: '' }],
    ]);
    const rows = targetRows(match({ proposals: [proposal('aa'), proposal('bb'), proposal('cc')] }), null, locations);
    expect(rows.map((r) => r.detail)).toEqual([
      '100% overlap · 1 B · tv · tl.example.org',
      '100% overlap · 1 B · tv · /data/tv',
      '100% overlap · 1 B · tv',
    ]);
  });
});

describe('trackerHost', () => {
  test('returns only the host name, and nothing for a value that is no URL', () => {
    expect(trackerHost('https://tl.example.org:443/a/KEY/announce?passkey=KEY')).toBe('tl.example.org');
    expect(trackerHost('')).toBe('');
    expect(trackerHost('not a url')).toBe('');
  });
});

describe('searchDetail', () => {
  test('shows the size, the save path, and the tracker host', () => {
    expect(searchDetail({ hash: 'aa', name: 'aa', size: 2048, category: '', save_path: '/data', tracker: 'https://t.example.org/KEY/announce' }))
      .toBe('2.00 KiB · /data · t.example.org');
    expect(searchDetail({ hash: 'aa', name: 'aa', size: 1, category: '', save_path: '', tracker: '' })).toBe('1 B');
  });
});
