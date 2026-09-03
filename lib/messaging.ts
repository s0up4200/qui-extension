import { browser } from 'wxt/browser';

export type ApiMessage =
  | { type: 'get-instances' }
  | { type: 'get-categories'; instanceId: string }
  | { type: 'add-torrent'; instanceId: string; urls: string; category: string }
  | { type: 'test-connection' }
  | { type: 'refresh-cache' }
  | { type: 'get-cached-data' };

export type TorrentFileData = {
  // ponytail: base64, not ArrayBuffer — executeScript results are
  // JSON-serialized, so raw buffers arrive as {} in the background.
  base64: string;
  contentType: string;
};

/** Result of fetching a torrent file inside the clicked tab */
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
