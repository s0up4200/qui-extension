import type { FetchTorrentResponse, TorrentFileData } from './messaging';

const MISSING_RECEIVER_FRAGMENT = 'Receiving end does not exist';

export async function responseToTorrentFile(response: Response): Promise<FetchTorrentResponse> {
  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  return {
    success: true,
    data: {
      base64: bytesToBase64(new Uint8Array(await response.arrayBuffer())),
      contentType: response.headers.get('content-type') || 'application/x-bittorrent',
    },
  };
}

// ponytail: chunked to stay linear and under the fromCharCode arg limit —
// an unchunked encode is what locks up on large files.
function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
  }
  return btoa(chunks.join(''));
}

export function blobFromTorrentFile(file: TorrentFileData): Blob {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: file.contentType });
}

export function getTorrentFetchErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes(MISSING_RECEIVER_FRAGMENT)) {
    return 'Reload the page and try again. qui could not reach the torrent helper on this tab.';
  }
  return message;
}
