import {
  getInstances,
  getCategories,
  addTorrent,
  addTorrentFile,
  getCrossSeedProposals,
  applyCrossSeed,
  searchTorrents,
  type AddTorrentOptions,
} from '@/lib/api';
import type { ApiMessage, ApiResponse, FetchTorrentResponse, TorrentFileData } from '@/lib/messaging';
import { refreshCache, loadCachedData } from '@/lib/cache';
import { rebuildMenus } from '@/lib/menus';
import { parseMenuId } from '@/lib/menu-id';
import { fetchTorrentInPage } from '@/lib/torrent-file';
import { cachedData, addPaused, skipRecheck, crossSeedPending } from '@/lib/storage';
import { isMagnetUrl } from '@/lib/url';

const CACHE_ALARM = 'refresh-cache';
const REFRESH_MINUTES = 15;

async function getTorrentOptions(): Promise<AddTorrentOptions> {
  const [paused, skipChecking] = await Promise.all([
    addPaused.getValue(),
    skipRecheck.getValue(),
  ]);
  return { paused, skipChecking };
}

function notify(title: string, message: string): void {
  browser.notifications.create(`${title}-${Date.now()}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon-128.png'),
    title,
    message,
  });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

/**
 * Fetch a .torrent URL inside the clicked tab to use the page's
 * cookies/session. The context-menu click grants activeTab.
 */
async function fetchTorrentFromTab(
  info: Browser.contextMenus.OnClickData,
  tab: Browser.tabs.Tab | undefined,
): Promise<TorrentFileData> {
  const tabId = tab?.id;
  if (!tabId || !info.linkUrl) {
    throw new Error('No tab context for fetching torrent');
  }

  let response: FetchTorrentResponse | undefined;
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId, frameIds: [info.frameId ?? 0] },
      func: fetchTorrentInPage,
      args: [info.linkUrl],
    });
    response = injection?.result as FetchTorrentResponse | undefined;
  } catch (error) {
    // Restricted pages (chrome://, the Web Store, PDF viewer) refuse injection.
    throw new Error(`Cannot read this page to fetch the torrent file: ${error}`);
  }
  if (!response?.success) {
    throw new Error(response?.error ?? 'Could not fetch the torrent file from this tab');
  }
  return response.data;
}

async function handleAdd(
  info: Browser.contextMenus.OnClickData,
  tab: Browser.tabs.Tab | undefined,
  instanceId: string,
  instanceName: string,
  category: string,
): Promise<void> {
  const url = info.linkUrl!;
  try {
    const options = await getTorrentOptions();
    if (isMagnetUrl(url)) {
      await addTorrent(instanceId, url, category, options);
    } else {
      await addTorrentFile(instanceId, await fetchTorrentFromTab(info, tab), category, options);
    }
    notify('Torrent Added', `Added to ${instanceName}${category ? ' / ' + category : ''}`);
  } catch (err) {
    notify('Failed to Add Torrent', errorMessage(err));
  }
}

async function openCrossSeedPicker(
  info: Browser.contextMenus.OnClickData,
  tab: Browser.tabs.Tab | undefined,
  instanceId: string,
  instanceName: string,
): Promise<void> {
  try {
    if (isMagnetUrl(info.linkUrl!)) {
      throw new Error('Cross-seed needs a .torrent file, magnet links have no file list');
    }
    const file = await fetchTorrentFromTab(info, tab);
    const match = await getCrossSeedProposals(instanceId, file);
    await crossSeedPending.setValue({ id: crypto.randomUUID(), instanceId, instanceName, file, match });
    await browser.windows.create({
      url: browser.runtime.getURL('/cross-seed.html'),
      type: 'popup',
      width: 600,
      height: 680,
    });
  } catch (err) {
    notify('Failed to Add Cross-seed', errorMessage(err));
  }
}

async function loadPending(pendingId: string) {
  const pending = await crossSeedPending.getValue();
  if (pending?.id !== pendingId) {
    throw new Error('This picker is stale. Right-click the torrent link again.');
  }
  return pending;
}

/** Re-rank proposals with targetHash forced into the list, and remember the result. */
async function pinCrossSeedTarget(pendingId: string, targetHash: string) {
  const pending = await loadPending(pendingId);
  const match = await getCrossSeedProposals(pending.instanceId, pending.file, targetHash);
  await crossSeedPending.setValue({ ...pending, match });
  return match;
}

async function handleApplyCrossSeed(
  pendingId: string,
  targetHash: string,
  category: string | undefined,
  tags: string[],
): Promise<void> {
  const pending = await loadPending(pendingId);
  const target = pending.match.proposals.find((p) => p.hash === targetHash);
  try {
    await applyCrossSeed(pending.instanceId, pending.file, targetHash, category, tags);
  } catch (err) {
    notify('Failed to Add Cross-seed', errorMessage(err));
    throw err;
  }
  await crossSeedPending.removeValue();
  notify(
    'Cross-seed Added',
    `Added to ${pending.instanceName} as cross-seed of ${target?.name ?? targetHash}`,
  );
}

export default defineBackground(() => {

  // --- onInstalled: set up alarm and populate initial cache ---
  browser.runtime.onInstalled.addListener(() => {
    browser.alarms.clear(CACHE_ALARM).then(() => {
      browser.alarms.create(CACHE_ALARM, {
        delayInMinutes: 1,
        periodInMinutes: REFRESH_MINUTES,
      });
    });
    refreshCache().then(rebuildMenus);
  });

  // --- onStartup: rebuild menus from cached storage ---
  browser.runtime.onStartup.addListener(() => {
    rebuildMenus();
  });

  // --- onAlarm: periodic cache refresh ---
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CACHE_ALARM) {
      refreshCache().then(rebuildMenus);
    }
  });

  // --- contextMenus.onClicked: add torrent or open the cross-seed picker ---
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info.linkUrl) return;

    const parsed = parseMenuId(info.menuItemId as string);
    if (!parsed) return;

    // Look up instance name for notification
    const cache = await loadCachedData();
    const instance = cache.instances.find((i) => String(i.id) === parsed.instanceId);
    const instanceName = instance?.name ?? parsed.instanceId;

    if (parsed.action === 'cross-seed') {
      await openCrossSeedPicker(info, tab, parsed.instanceId, instanceName);
    } else {
      await handleAdd(info, tab, parsed.instanceId, instanceName, parsed.category);
    }
  });

  // --- onMessage: handle messages from extension pages ---
  browser.runtime.onMessage.addListener(
    (
      message: ApiMessage,
      _sender,
      sendResponse: (response: ApiResponse<unknown>) => void,
    ) => {
      (async () => {
        try {
          let data: unknown;
          switch (message.type) {
            case 'get-instances':
              data = await getInstances();
              break;
            case 'get-categories':
              data = await getCategories(message.instanceId);
              break;
            case 'add-torrent':
              data = await addTorrent(
                message.instanceId,
                message.urls,
                message.category,
                await getTorrentOptions(),
              );
              break;
            case 'search-torrents':
              data = await searchTorrents(message.instanceId, message.query);
              break;
            case 'pin-cross-seed-target':
              data = await pinCrossSeedTarget(message.pendingId, message.targetHash);
              break;
            case 'apply-cross-seed':
              await handleApplyCrossSeed(message.pendingId, message.targetHash, message.category, message.tags);
              data = true;
              break;
            case 'test-connection':
              data = await getInstances();
              break;
            case 'refresh-cache':
              await refreshCache().then(rebuildMenus);
              data = true;
              break;
            case 'get-cached-data':
              data = await cachedData.getValue();
              break;
            default:
              sendResponse({ success: false, error: 'Unknown message type' });
              return;
          }
          sendResponse({ success: true, data });
        } catch (err) {
          sendResponse({ success: false, error: errorMessage(err) });
        }
      })();

      return true;
    },
  );

  // --- storage.onChanged: rebuild menus when menu settings change ---
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === 'local'
      && (changes['favorites'] || changes['favoritesOnly'] || changes['enabledInstances'])
    ) {
      rebuildMenus();
    }
  });
});
