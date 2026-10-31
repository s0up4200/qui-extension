import { browser } from 'wxt/browser';
import {
  handleRequest,
  RequestError,
  type BackgroundRequest,
  type RequestHandlers,
  type RequestName,
  type RequestResponse,
  type RequestResult,
} from './requests';

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

/** Sends a background request from a page. The request name gives the result type. */
export async function sendToBackground<K extends RequestName>(request: BackgroundRequest<K>): Promise<RequestResult<K>> {
  const response = (await browser.runtime.sendMessage(request)) as RequestResponse<RequestResult<K>>;
  if (!response.success) {
    throw new RequestError(response.error.kind, response.error.message);
  }
  return response.data;
}

/** Answers each background request in the background. */
export function listenForRequests(handlers: RequestHandlers): void {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleRequest(handlers, message).then(sendResponse);
    return true;
  });
}
