import {
  getInstances,
  getCategories,
  addTorrent,
  addTorrentFile,
  getCrossSeedProposals,
  applyCrossSeed,
  checkAssemble,
  applyAssemble,
  searchTorrents,
  type AddTorrentOptions,
} from '@/lib/api';
import type { ApiMessage, ApiResponse, FetchTorrentResponse, TorrentFileData } from '@/lib/messaging';
import { refreshCache, type RefreshResult } from '@/lib/cache';
import { rebuildMenus } from '@/lib/menus';
import { parseMenuId } from '@/lib/menu-id';
import { fetchTorrentInPage } from '@/lib/torrent-file';
import { cachedData, addPaused, skipRecheck, crossSeedPending } from '@/lib/storage';
import { createPendingCrossSeed, STALE_PICKER, type CrossSeedSelection } from '@/lib/pending-cross-seed';

const CACHE_ALARM = 'refresh-cache';
const REFRESH_MINUTES = 15;

const pendingCrossSeed = createPendingCrossSeed(crossSeedPending, {
  proposals: getCrossSeedProposals,
  apply: applyCrossSeed,
  check: checkAssemble,
  assemble: applyAssemble,
});

// Rebuild also after a failed refresh: an extension update clears the menus,
// and they must come back from the last good data.
async function refreshAndRebuild(): Promise<RefreshResult> {
  try {
    return await refreshCache(cachedData, { instances: getInstances, categories: getCategories });
  } finally {
    await rebuildMenus();
  }
}

// No page waits on the install and alarm refreshes, so a failure stays quiet.
function refreshQuietly(): void {
  refreshAndRebuild().catch(() => {});
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
  savePath?: string,
): Promise<void> {
  const url = info.linkUrl!;
  const target = savePath ?? category;
  try {
    const [paused, skipChecking] = await Promise.all([addPaused.getValue(), skipRecheck.getValue()]);
    const options: AddTorrentOptions = { paused, skipChecking, savePath };
    if (url.startsWith('magnet:')) {
      await addTorrent(instanceId, url, category, options);
    } else {
      await addTorrentFile(instanceId, await fetchTorrentFromTab(info, tab), category, options);
    }
    notify('Torrent Added', `Added to ${instanceName}${target ? ' / ' + target : ''}`);
  } catch (err) {
    notify('Failed to Add Torrent', errorMessage(err));
  }
}

async function instanceNameOf(instanceId: string): Promise<string> {
  const cache = await cachedData.getValue();
  return cache.instances.find((i) => String(i.id) === instanceId)?.name ?? instanceId;
}

async function openCrossSeedPicker(
  info: Browser.contextMenus.OnClickData,
  tab: Browser.tabs.Tab | undefined,
  instanceId: string,
): Promise<void> {
  // A magnet link is no cross-seed request, so it leaves the open picker alone.
  if (info.linkUrl!.startsWith('magnet:')) {
    notify('Failed to Add Cross-seed', 'Cross-seed needs a .torrent file, magnet links have no file list');
    return;
  }
  try {
    // prepare claims the slot before its first await, so call it before any other lookup.
    const pending = await pendingCrossSeed.prepare(async () => {
      const [file, instanceName] = await Promise.all([fetchTorrentFromTab(info, tab), instanceNameOf(instanceId)]);
      return { instanceId, instanceName, file };
    });
    if (!pending) return;
    await browser.windows.create({
      url: `${browser.runtime.getURL('/cross-seed.html')}?id=${pending.id}`,
      type: 'popup',
      width: 600,
      height: 680,
    });
  } catch (err) {
    notify('Failed to Add Cross-seed', errorMessage(err));
  }
}

async function handleApplyCrossSeed(pendingId: string, selection: CrossSeedSelection): Promise<void> {
  try {
    const { summary } = await pendingCrossSeed.apply(pendingId, selection);
    notify('Cross-seed Added', summary);
  } catch (err) {
    if (errorMessage(err) !== STALE_PICKER) notify('Failed to Add Cross-seed', errorMessage(err));
    throw err;
  }
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
    refreshQuietly();
  });

  // --- onStartup: rebuild menus from cached storage ---
  browser.runtime.onStartup.addListener(() => {
    rebuildMenus();
  });

  // --- onAlarm: periodic cache refresh ---
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CACHE_ALARM) {
      refreshQuietly();
    }
  });

  // --- contextMenus.onClicked: add torrent or open the cross-seed picker ---
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info.linkUrl) return;

    const parsed = parseMenuId(info.menuItemId as string);
    if (!parsed) return;

    if (parsed.action === 'cross-seed') {
      await openCrossSeedPicker(info, tab, parsed.instanceId);
    } else {
      const instanceName = await instanceNameOf(parsed.instanceId);
      await handleAdd(info, tab, parsed.instanceId, instanceName, parsed.category, parsed.savePath);
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
            case 'search-torrents':
              data = await searchTorrents(message.instanceId, message.query);
              break;
            case 'read-cross-seed':
              data = await pendingCrossSeed.read(message.pendingId);
              break;
            case 'pin-cross-seed-target':
              data = await pendingCrossSeed.pin(message.pendingId, message.targetHash);
              break;
            case 'check-cross-seed-assemble':
              data = await pendingCrossSeed.check(message.pendingId, message.targetHashes);
              break;
            case 'apply-cross-seed':
              await handleApplyCrossSeed(message.pendingId, message);
              data = true;
              break;
            case 'test-connection':
              data = await getInstances();
              break;
            case 'refresh-cache':
              data = await refreshAndRebuild();
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
      && (
        changes['favorites']
        || changes['favoritesOnly']
        || changes['enabledInstances']
        || changes['savePaths']
        || changes['crossSeedMenuPosition']
      )
    ) {
      rebuildMenus();
    }
  });
});
