import { describe, expect, test } from 'bun:test';
import type { Category, Instance } from '../lib/api';
import type { CacheData } from '../lib/storage';
import { refreshCache, type QuiCache } from '../lib/cache';

const instances: Instance[] = [
  { id: '1', name: 'alpha' },
  { id: '2', name: 'beta' },
];

/** Local storage stand-in that counts writes. */
function fakeStore(initial: CacheData = { instances: [], categoriesByInstance: {} }) {
  let value = initial;
  let writes = 0;
  return {
    getValue: async () => value,
    setValue: async (next: CacheData) => {
      value = next;
      writes++;
    },
    get value() { return value; },
    get writes() { return writes; },
  };
}

/** qui stand-in. Each category entry is a list, or an error to throw. */
function fakeQui(
  categories: Record<string, Category[] | Error>,
  instanceError?: Error,
): QuiCache {
  return {
    instances: async () => {
      if (instanceError) throw instanceError;
      return instances;
    },
    categories: async (id) => {
      const result = categories[id] ?? [];
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

describe('refreshCache', () => {
  test('throws the qui error and keeps the cache when the instance request fails', async () => {
    const old: CacheData = { instances: [{ id: '1', name: 'alpha' }], categoriesByInstance: { 1: [{ name: 'tv' }] } };
    const store = fakeStore(old);

    await expect(refreshCache(store, fakeQui({}, new Error('HTTP 401: unauthorized')))).rejects.toThrow('HTTP 401: unauthorized');
    expect(store.writes).toBe(0);
    expect(store.value).toEqual(old);
  });

  test('keeps the previous categories of an instance whose category request fails', async () => {
    const store = fakeStore({ instances, categoriesByInstance: { 1: [{ name: 'tv' }], 2: [{ name: 'old' }] } });

    const result = await refreshCache(store, fakeQui({ 1: [{ name: 'movies' }], 2: new Error('HTTP 500') }));

    expect(result).toEqual({ failedInstances: ['beta'] });
    expect(store.value).toEqual({ instances, categoriesByInstance: { 1: [{ name: 'movies' }], 2: [{ name: 'old' }] } });
  });

  test('saves an empty list when a failed instance has no cached categories', async () => {
    const store = fakeStore();

    const result = await refreshCache(store, fakeQui({ 1: new Error('HTTP 500'), 2: [{ name: 'tv' }] }));

    expect(result).toEqual({ failedInstances: ['alpha'] });
    expect(store.value).toEqual({ instances, categoriesByInstance: { 1: [], 2: [{ name: 'tv' }] } });
  });

  test('saves all data and reports no failures when every request succeeds', async () => {
    const store = fakeStore({ instances: [], categoriesByInstance: { 9: [{ name: 'gone' }] } });

    const result = await refreshCache(store, fakeQui({ 1: [{ name: 'tv' }], 2: [{ name: 'movies' }] }));

    expect(result).toEqual({ failedInstances: [] });
    expect(store.value).toEqual({ instances, categoriesByInstance: { 1: [{ name: 'tv' }], 2: [{ name: 'movies' }] } });
  });
});
