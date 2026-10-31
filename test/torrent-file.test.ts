import { afterEach, describe, expect, test } from 'bun:test';
import { blobFromTorrentFile, fetchTorrentInPage, torrentName } from '../lib/torrent-file';

const realFetch = globalThis.fetch;

// Bun has no FileReader. The shim covers readAsDataURL only.
class FileReaderShim {
  result: string | null = null;
  onload: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onload?.();
    });
  }
}
(globalThis as { FileReader?: unknown }).FileReader ??= FileReaderShim;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(response: Response) {
  globalThis.fetch = (async () => response) as unknown as typeof fetch;
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
    }) as unknown as typeof fetch;

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

describe('torrentName', () => {
  const file = (text: string) => ({ base64: Buffer.from(text, 'latin1').toString('base64'), contentType: '' });
  // A bencode string, with its length in UTF-8 bytes.
  const str = (text: string) => `${Buffer.byteLength(text)}:${Buffer.from(text, 'utf8').toString('latin1')}`;

  test('reads info.name past other keys, lists, and integers', () => {
    const torrent = `d${str('announce')}${str('http://t.test/a?k=v')}${str('name')}${str('fake')}${str('info')}d${str('files')}ld${str('length')}i5e${str('path')}l${str('a.mkv')}eee${str('named')}${str('wrong')}${str('name')}${str('Fïlm')}${str('piece length')}i16384eee`;
    expect(torrentName(file(torrent))).toBe('Fïlm');
  });

  test('reads the dn of a magnet link', () => {
    expect(torrentName('magnet:?xt=urn:btih:abc&dn=Some+Show%20S01')).toBe('Some Show S01');
    expect(torrentName('magnet:?xt=urn:btih:abc')).toBe('');
  });

  test.each(['', 'not bencode', 'd4:infod4:name', 'd4:infod4:name99:x', 'd4:infod4:namei1eee', 'l', 'd4:info', 'd4:infod3:abc'])(
    'returns empty text for a broken file %p',
    (text) => {
      expect(torrentName(file(text))).toBe('');
    },
  );
});
