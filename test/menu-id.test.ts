import { describe, expect, test } from 'bun:test';
import { makeMenuId, makeCrossSeedMenuId, parseMenuId } from '../lib/menu-id';

describe('parseMenuId', () => {
  test('round-trips add ids, keeping separators inside the category', () => {
    expect(parseMenuId(makeMenuId('3', 'tv|shows'))).toEqual({
      action: 'add',
      instanceId: '3',
      category: 'tv|shows',
    });
  });

  test('round-trips cross-seed ids', () => {
    expect(parseMenuId(makeCrossSeedMenuId('3'))).toEqual({
      action: 'cross-seed',
      instanceId: '3',
      category: '',
    });
  });

  test('rejects unrelated ids', () => {
    expect(parseMenuId('send-to-qui')).toBeNull();
    expect(parseMenuId('instance-3')).toBeNull();
  });
});
