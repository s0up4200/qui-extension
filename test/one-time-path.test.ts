import { describe, expect, test } from 'bun:test';
import { isFullPath, matchingFolders, suggestStep } from '../lib/one-time-path';

describe('isFullPath', () => {
  test.each(['/data', 'D:\\Torrents', 'D:/Torrents', '\\\\server\\share', '  /data  '])('accepts %p', (text) => {
    expect(isFullPath(text)).toBe(true);
  });

  test.each(['old-films', '', '   ', 'D:', 'D:Torrents', '\\single'])('rejects %p', (text) => {
    expect(isFullPath(text)).toBe(false);
  });
});

describe('suggestStep', () => {
  test.each([
    ['/mnt/ar', { dir: '/mnt/', prefix: 'ar' }],
    ['/mnt/', { dir: '/mnt/', prefix: '' }],
    ['D:\\Tor', { dir: 'D:\\', prefix: 'Tor' }],
    ['D:/Torrents/mo', { dir: 'D:/Torrents/', prefix: 'mo' }],
  ])('splits %p', (text, expected) => {
    expect(suggestStep(text)).toEqual(expected);
  });

  test('text with no separator has no folder to list', () => {
    expect(suggestStep('old-films')).toBeNull();
  });
});

describe('matchingFolders', () => {
  test('matches the own name of each folder, not the parent path', () => {
    expect(matchingFolders(['/mnt/archive', '/mnt/Media', '/mnt/old/archive2', 'D:\\Archive'], 'ar'))
      .toEqual(['/mnt/archive', '/mnt/old/archive2', 'D:\\Archive']);
    expect(matchingFolders(['/mnt/media', '/mnt/archive'], '')).toEqual(['/mnt/media', '/mnt/archive']);
    expect(matchingFolders(['/arch/media'], 'ar')).toEqual([]);
  });
});
