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

    // ponytail: chunked to stay linear and under the fromCharCode arg limit —
    // an unchunked encode is what locks up on large files.
    const bytes = new Uint8Array(await response.arrayBuffer());
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 0x8000) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
    }

    return {
      success: true,
      data: {
        base64: btoa(chunks.join('')),
        contentType: response.headers.get('content-type') || 'application/x-bittorrent',
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Fetch failed' };
  }
}

export function blobFromTorrentFile(file: TorrentFileData): Blob {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: file.contentType });
}
