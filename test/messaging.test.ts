import { afterAll, expect, test } from 'bun:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createRequestHandlers, RequestError, type RequestDeps } from '../lib/requests';

const originalBrowser = Reflect.get(globalThis, 'browser');
Object.assign(globalThis, { browser: fakeBrowser });
const { listenForRequests, sendToBackground } = await import('../lib/messaging');

afterAll(() => {
  fakeBrowser.reset();
  Object.assign(globalThis, { browser: originalBrowser });
});

test('a page request reaches its handler in the background and keeps the error kind', async () => {
  const unused = () => {
    throw new Error('not used in this test');
  };
  listenForRequests(createRequestHandlers({
    qui: {
      getInstances: unused,
      searchTorrents: unused,
      getTorrentsByHash: unused,
      supportsPathAutocomplete: async (instanceId) => instanceId === '1',
      listDirectories: unused,
    },
    crossSeed: { prepare: unused, read: unused, pin: unused, check: unused, apply: unused },
    oneTimePath: {
      prepare: unused,
      read: async () => {
        throw new RequestError('stale', 'This window is out of date.');
      },
      apply: unused,
    },
    refresh: unused,
    saveConnection: unused,
    notify: unused,
  } satisfies RequestDeps));

  expect(await sendToBackground({ type: 'supports-path-autocomplete', instanceId: '1' })).toBe(true);

  const failed = sendToBackground({ type: 'read-one-time-path', pendingId: 'old' });
  await expect(failed).rejects.toThrow('This window is out of date.');
  await expect(failed).rejects.toMatchObject({ kind: 'stale' });
});
