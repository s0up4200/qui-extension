import type { FetchTorrentResponse, TorrentFileData } from './messaging';

/**
 * Fetches a .torrent URL with the page's cookies and returns it as base64.
 *
 * Runs inside the clicked tab via `browser.scripting.executeScript`, so it
 * must be self-contained: no imports, no closures over module scope.
 * The result is JSON-serialized on the way back, so bytes travel as base64,
 * never as an ArrayBuffer.
 */
export async function fetchTorrentInPage(url: string): Promise<FetchTorrentResponse> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/x-bittorrent,application/octet-stream,*/*' },
      credentials: 'include',
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    // FileReader does the base64 encode natively. Firefox hands the
    // response bytes across a realm boundary, and typed-array methods on
    // them fail with "Permission denied to access property constructor".
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      response.blob().then((blob) => reader.readAsDataURL(blob), reject);
    });

    return {
      success: true,
      data: {
        base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
        contentType: response.headers.get('content-type') || 'application/x-bittorrent',
      },
    };
  } catch (e) {
    // Firefox hands the page's TypeError across a realm boundary, so
    // `instanceof Error` is false there. String(e) keeps the real message.
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function bytesOf(file: TorrentFileData): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
}

export function blobFromTorrentFile(file: TorrentFileData): Blob {
  return new Blob([bytesOf(file)], { type: file.contentType });
}

/** The `dn` of a magnet link, or `info.name` of a .torrent file. Empty text when it has none or the file is broken. */
export function torrentName(torrent: string | TorrentFileData): string {
  if (typeof torrent === 'string') {
    return new URL(torrent).searchParams.get('dn') ?? '';
  }
  // A bencode walk to info.name. Each step moves i forward or throws, so a broken file cannot loop.
  const bytes = bytesOf(torrent);
  const utf8 = new TextDecoder();
  let i = 0;
  const readString = () => {
    const colon = bytes.indexOf(0x3a, i);
    if (colon < 0) throw new Error('not a string');
    const digits = String.fromCharCode(...bytes.subarray(i, colon));
    if (!/^\d+$/.test(digits)) throw new Error('not a string');
    const end = colon + 1 + Number(digits);
    if (end > bytes.length) throw new Error('short string');
    i = end;
    return bytes.subarray(colon + 1, end);
  };
  const skip = (): void => {
    const c = bytes[i];
    if (c === 0x69) { // i<digits>e
      const e = bytes.indexOf(0x65, i);
      if (e < 0) throw new Error('open integer');
      i = e + 1;
    } else if (c === 0x6c || c === 0x64) { // l...e and d...e
      i++;
      while (bytes[i] !== 0x65) skip();
      i++;
    } else {
      readString();
    }
  };
  // Moves i to the value of key in the dict at i.
  const enter = (key: string): boolean => {
    if (bytes[i] !== 0x64) return false;
    i++;
    while (i < bytes.length && bytes[i] !== 0x65) {
      if (utf8.decode(readString()) === key) return true;
      skip();
    }
    return false;
  };
  try {
    return enter('info') && enter('name') ? utf8.decode(readString()) : '';
  } catch {
    return '';
  }
}
