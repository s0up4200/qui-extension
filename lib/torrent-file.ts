import type { FetchTorrentResponse, TorrentFileData } from './messaging';

const MISSING_RECEIVER_FRAGMENT = 'Receiving end does not exist';

export async function responseToTorrentFile(response: Response): Promise<FetchTorrentResponse> {
  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  return {
    success: true,
    data: {
      bytes: await response.arrayBuffer(),
      contentType: response.headers.get('content-type') || 'application/x-bittorrent',
    },
  };
}

export function blobFromTorrentFile(file: TorrentFileData): Blob {
  return new Blob([file.bytes], { type: file.contentType });
}

export function getTorrentFetchErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes(MISSING_RECEIVER_FRAGMENT)) {
    return 'Reload the page and try again. qui could not reach the torrent helper on this tab.';
  }
  return message;
}
