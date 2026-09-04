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

export function blobFromTorrentFile(file: TorrentFileData): Blob {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: file.contentType });
}
