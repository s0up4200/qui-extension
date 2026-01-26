import type { FetchTorrentMessage, FetchTorrentResponse } from '@/lib/messaging';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read torrent data'));
    reader.readAsDataURL(blob);
  });
}

async function fetchTorrent(url: string): Promise<FetchTorrentResponse> {
  const response = await fetch(url, {
    headers: { Accept: 'application/x-bittorrent,application/octet-stream,*/*' },
    credentials: 'include',
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const blob = await response.blob();
  const data = await blobToDataUrl(blob);
  const contentType = response.headers.get('content-type') || 'application/x-bittorrent';

  return { success: true, data, contentType };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    browser.runtime.onMessage.addListener(
      (
        message: FetchTorrentMessage,
        _sender,
        sendResponse: (response: FetchTorrentResponse) => void,
      ) => {
        if (message.type !== 'fetch-torrent') return false;

        fetchTorrent(message.url)
          .then(sendResponse)
          .catch((e) =>
            sendResponse({
              success: false,
              error: e instanceof Error ? e.message : 'Fetch failed',
            }),
          );

        return true; // Keep message channel open for async response
      },
    );
  },
});
