import { describe, expect, test } from 'bun:test';
import { makeMenuId, makePathMenuId, makeCrossSeedMenuId, parseMenuId } from '../lib/menu-id';

describe('parseMenuId', () => {
  test('round-trips a category target, keeping separators inside the category', () => {
    expect(parseMenuId(makeMenuId('1', 'tv|shows'))).toEqual({
      action: 'add',
      instanceId: '1',
      category: 'tv|shows',
    });
  });

  test('round-trips a save path target with | and backslashes', () => {
    for (const savePath of ['D:\\Downloads\\Movies', '/data/a|b', '/plain']) {
      expect(parseMenuId(makePathMenuId('42', savePath))).toEqual({
        action: 'add',
        instanceId: '42',
        category: '',
        savePath,
      });
    }
  });

  test('round-trips cross-seed ids', () => {
    expect(parseMenuId(makeCrossSeedMenuId('3'))).toEqual({
      action: 'cross-seed',
      instanceId: '3',
      category: '',
    });
  });

  test('returns null for unrelated ids', () => {
    expect(parseMenuId('send-to-qui')).toBeNull();
    expect(parseMenuId('instance-1')).toBeNull();
    expect(parseMenuId('path|1')).toBeNull();
  });
});
