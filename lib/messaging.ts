import { browser } from 'wxt/browser';

export type ApiMessage =
  | { type: 'get-instances' }
  | { type: 'get-categories'; instanceId: string }
  | { type: 'add-torrent'; instanceId: string; urls: string; category: string }
  | { type: 'test-connection' }
  | { type: 'refresh-cache' }
  | { type: 'get-cached-data' };

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
