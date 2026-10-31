import { afterAll, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';

const originalBrowser = Reflect.get(globalThis, 'browser');
const originalFetch = globalThis.fetch;
Object.assign(globalThis, { browser: fakeBrowser });
const { addTorrent, getInstances } = await import('../lib/api');

// The fake browser does not implement permissions.
const contains = spyOn(fakeBrowser.permissions, 'contains').mockImplementation(async () => true);

/** Stands in for the network: no request leaves the test. */
function stubFetch(answer: (request: Request) => Promise<Response>) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => answer(new Request(input, init))) as typeof fetch;
}

function reply(status: number, body: unknown) {
  return async () => Response.json(body, { status });
}

beforeEach(async () => {
  fakeBrowser.reset();
  await fakeBrowser.storage.local.set({ serverUrl: 'https://qui.test', apiKey: 'key' });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  contains.mockRestore();
  fakeBrowser.reset();
  Object.assign(globalThis, { browser: originalBrowser });
});

describe('qui errors', () => {
  test('a 401 asks to check the API key', async () => {
    stubFetch(reply(401, { error: 'unauthorized' }));
    await expect(getInstances()).rejects.toThrow('Unauthorized (401). Check the API key and Basic Auth credentials.');
  });

  test('a 403 asks to check the access rules and the proxy', async () => {
    stubFetch(reply(403, 'Forbidden'));
    await expect(getInstances()).rejects.toThrow('Forbidden (403). Check API access rules and any proxy restrictions.');
  });

  test('a network failure says that qui did not answer', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    // A POST, so ky does not retry.
    await expect(addTorrent('1', 'magnet:?xt=urn:btih:aa', '')).rejects.toThrow(
      'Could not reach qui. Check the server URL, DNS, TLS certificate, or proxy settings.',
    );
  });

  test('a timeout says that qui did not answer in time', async () => {
    jest.useFakeTimers();
    try {
      const { promise: sent, resolve: markSent } = Promise.withResolvers<void>();
      // qui never answers; the request only ends when ky aborts it.
      stubFetch((request) => new Promise((_, reject) => {
        request.signal.addEventListener('abort', () => reject(request.signal.reason));
        markSent();
      }));
      const add = addTorrent('1', 'magnet:?xt=urn:btih:aa', '');
      await sent;
      jest.advanceTimersByTime(10_001);
      await expect(add).rejects.toThrow('Request timed out. Check that the qui server is reachable and responding.');
    } finally {
      jest.useRealTimers();
    }
  });

  test('another error keeps the text of qui', async () => {
    stubFetch(reply(400, { error: 'save path is not absolute' }));
    await expect(addTorrent('1', 'magnet:?xt=urn:btih:aa', '')).rejects.toThrow('HTTP 400: save path is not absolute');
  });
});
