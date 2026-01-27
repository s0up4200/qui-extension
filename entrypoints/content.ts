import { browser } from 'wxt/browser';
import type { FetchTorrentMessage, FetchTorrentResponse } from '@/lib/messaging';

const TORRENT_LINK_RE = /(^magnet:)|(\.torrent(\?|#|$))/i;
const TORRENT_MIME_RE = /application\/x-bittorrent|application\/octet-stream/i;

function isTorrentLink(link: HTMLAnchorElement): boolean {
  const href = link.href;
  if (!href) return false;
  if (TORRENT_LINK_RE.test(href)) return true;

  const typeAttr = link.getAttribute('type');
  if (typeAttr && TORRENT_MIME_RE.test(typeAttr)) return true;

  const downloadAttr = link.getAttribute('download');
  if (downloadAttr && /\.torrent$/i.test(downloadAttr)) return true;

  try {
    const url = new URL(href, document.baseURI);
    const path = url.pathname.toLowerCase();
    const params = url.searchParams;

    const actionDownload = params.get('action') === 'download';
    const hasDownloadParam =
      params.has('download') ||
      params.has('dl') ||
      params.get('download') === '1';
    const hasTorrentTokens =
      path.includes('torrent') ||
      Array.from(params.keys()).some((key) => key.includes('torrent')) ||
      params.has('torrent_pass') ||
      params.has('authkey') ||
      params.has('passkey');

    if ((actionDownload && hasTorrentTokens) || (hasDownloadParam && hasTorrentTokens)) {
      return true;
    }

    if (path.includes('torrents/download') || path.includes('torrent/download')) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

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
    let lastHasLinks: boolean | null = null;
    let pendingCheck: number | null = null;

    const scanForTorrentLinks = () => {
      for (const link of Array.from(document.links)) {
        if (isTorrentLink(link)) {
          return true;
        }
      }
      return false;
    };

    const notifyIfChanged = () => {
      const hasLinks = scanForTorrentLinks();
      if (hasLinks !== lastHasLinks) {
        lastHasLinks = hasLinks;
        browser.runtime.sendMessage({ type: 'page-torrent-links', hasLinks });
      }
    };

    const scheduleCheck = () => {
      if (pendingCheck !== null) return;
      pendingCheck = window.setTimeout(() => {
        pendingCheck = null;
        notifyIfChanged();
      }, 200);
    };

    notifyIfChanged();

    if (document.body) {
      const observer = new MutationObserver(scheduleCheck);
      observer.observe(document.body, { childList: true, subtree: true });
    }

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
