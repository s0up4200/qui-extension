import { afterEach, describe, expect, test } from 'bun:test';
import { blobFromTorrentFile, fetchTorrentInPage } from '../lib/torrent-file';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(response: Response) {
  globalThis.fetch = (async () => response) as typeof fetch;
}

describe('fetchTorrentInPage', () => {
  test('encodes bytes as a JSON-safe base64 string that round-trips', async () => {
    const bytes = Uint8Array.from([0x64, 0x38, 0x3a, 0x61, 0x62, 0x63, 0x64, 0x65]);
    stubFetch(new Response(bytes, {
      status: 200,
      headers: { 'content-type': 'application/x-bittorrent' },
    }));

    const result = await fetchTorrentInPage('http://example.invalid/a.torrent');

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected success');
    }
    expect(result.data.contentType).toBe('application/x-bittorrent');

    // executeScript JSON-serializes results — payload must survive that.
    const transferred = JSON.parse(JSON.stringify(result.data));
    const blob = blobFromTorrentFile(transferred);
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  test('returns HTTP error status for failed fetches', async () => {
    stubFetch(new Response('forbidden', { status: 403 }));

    expect(await fetchTorrentInPage('http://example.invalid/a.torrent')).toEqual({
      success: false,
      error: 'HTTP 403',
    });
  });

  test('returns the error message when fetch throws', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    expect(await fetchTorrentInPage('http://example.invalid/a.torrent')).toEqual({
      success: false,
      error: 'Failed to fetch',
    });
  });
});

describe('blobFromTorrentFile', () => {
  test('rebuilds a blob from transferred base64', async () => {
    const blob = blobFromTorrentFile({
      base64: btoa(String.fromCharCode(1, 2, 3, 4)),
      contentType: 'application/x-bittorrent',
    });

    expect(blob.type).toBe('application/x-bittorrent');
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([1, 2, 3, 4]);
  });
});
