import { describe, expect, test } from 'bun:test';
import {
  blobFromTorrentFile,
  getTorrentFetchErrorMessage,
  responseToTorrentFile,
} from '../lib/torrent-file';

describe('responseToTorrentFile', () => {
  test('encodes bytes as a JSON-safe base64 string that round-trips', async () => {
    const bytes = Uint8Array.from([0x64, 0x38, 0x3a, 0x61, 0x62, 0x63, 0x64, 0x65]);
    const response = new Response(bytes, {
      status: 200,
      headers: { 'content-type': 'application/x-bittorrent' },
    });

    const result = await responseToTorrentFile(response);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected success');
    }
    expect(result.data.contentType).toBe('application/x-bittorrent');
    expect(typeof result.data.base64).toBe('string');

    // Chrome JSON-serializes extension messages — payload must survive that.
    const transferred = JSON.parse(JSON.stringify(result.data));
    const blob = blobFromTorrentFile(transferred);
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  test('returns HTTP error status for failed fetches', async () => {
    const response = new Response('forbidden', { status: 403 });

    const result = await responseToTorrentFile(response);

    expect(result).toEqual({ success: false, error: 'HTTP 403' });
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

describe('getTorrentFetchErrorMessage', () => {
  test('maps missing content script receiver to refresh guidance', () => {
    const message = getTorrentFetchErrorMessage(
      new Error('Could not establish connection. Receiving end does not exist.'),
    );

    expect(message).toBe(
      'Reload the page and try again. qui could not reach the torrent helper on this tab.',
    );
  });

  test('passes through other errors unchanged', () => {
    const message = getTorrentFetchErrorMessage(new Error('NetworkError when attempting to fetch resource.'));

    expect(message).toBe('NetworkError when attempting to fetch resource.');
  });
});
