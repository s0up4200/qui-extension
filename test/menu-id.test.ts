import { describe, expect, test } from 'bun:test';
import { makeMenuId, makePathMenuId, parseMenuId } from '../lib/menu-id';

describe('parseMenuId', () => {
  test('round-trips a category target', () => {
    expect(parseMenuId(makeMenuId('1', 'tv|shows'))).toEqual({
      instanceId: '1',
      category: 'tv|shows',
    });
  });

  test('round-trips a save path target with | and backslashes', () => {
    for (const savePath of ['D:\\Downloads\\Movies', '/data/a|b', '/plain']) {
      expect(parseMenuId(makePathMenuId('42', savePath))).toEqual({
        instanceId: '42',
        category: '',
        savePath,
      });
    }
  });

  test('returns null for unrelated ids', () => {
    expect(parseMenuId('send-to-qui')).toBeNull();
    expect(parseMenuId('instance-1')).toBeNull();
    expect(parseMenuId('path|1')).toBeNull();
  });
});
