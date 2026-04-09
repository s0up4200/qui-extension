import { browser } from 'wxt/browser';

export type ApiMessage =
  | { type: 'get-instances' }
  | { type: 'get-categories'; instanceId: string }
  | { type: 'add-torrent'; instanceId: string; urls: string; category: string }
  | { type: 'test-connection' }
  | { type: 'refresh-cache' }
  | { type: 'get-cached-data' };

/** Message sent to content script to fetch a torrent file */
export type FetchTorrentMessage = {
  type: 'fetch-torrent';
  url: string;
};

export type TorrentFileData = {
  bytes: ArrayBuffer;
  contentType: string;
};

/** Message sent from content script to toggle action state based on page links */
export type PageTorrentLinksMessage = {
  type: 'page-torrent-links';
  hasLinks: boolean;
};

/** Response from content script after fetching torrent */
export type FetchTorrentResponse =
  | { success: true; data: TorrentFileData }
  | { success: false; error: string };

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function sendToBackground<T>(message: ApiMessage): Promise<T> {
  const response = (await browser.runtime.sendMessage(message)) as ApiResponse<T>;
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.data;
}
