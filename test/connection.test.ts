import { afterAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';

const originalBrowser = Reflect.get(globalThis, 'browser');
Object.assign(globalThis, { browser: fakeBrowser });
const { connectionState } = await import('../lib/connection');

// The fake browser does not implement permissions.
let granted = true;
const contains = spyOn(fakeBrowser.permissions, 'contains').mockImplementation(async () => granted);

beforeEach(() => {
  fakeBrowser.reset();
  granted = true;
});

afterAll(() => {
  contains.mockRestore();
  fakeBrowser.reset();
  Object.assign(globalThis, { browser: originalBrowser });
});

describe('connectionState', () => {
  test('is not configured on a fresh install', async () => {
    expect(await connectionState()).toBe('not-configured');
  });

  test('is not configured with an address but no API key', async () => {
    await fakeBrowser.storage.local.set({ serverUrl: 'https://qui.test' });
    expect(await connectionState()).toBe('not-configured');
  });

  test('is no access when the browser has no server access', async () => {
    await fakeBrowser.storage.local.set({ serverUrl: 'https://qui.test', apiKey: 'key' });
    granted = false;
    expect(await connectionState()).toBe('no-access');
  });

  test('is ready with an address, an API key, and server access', async () => {
    await fakeBrowser.storage.local.set({ serverUrl: 'https://qui.test', apiKey: 'key' });
    expect(await connectionState()).toBe('ready');
  });
});
