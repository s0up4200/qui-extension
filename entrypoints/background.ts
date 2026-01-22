import { getInstances, getCategories, addTorrent } from '@/lib/api';
import type { ApiMessage, ApiResponse } from '@/lib/messaging';
import { refreshCache, loadCachedData } from '@/lib/cache';
import { rebuildMenus, parseMenuId } from '@/lib/menus';
import { cachedData, addPaused, skipRecheck } from '@/lib/storage';

export default defineBackground(() => {
  const CACHE_ALARM = 'refresh-cache';
  const REFRESH_MINUTES = 15;

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

  // --- contextMenus.onClicked: add torrent and notify ---
  browser.contextMenus.onClicked.addListener(async (info) => {
    if (!info.linkUrl) return;

    const parsed = parseMenuId(info.menuItemId as string);
    if (!parsed) return;

    // Look up instance name for notification
    const cache = await loadCachedData();
    const instance = cache.instances.find((i) => String(i.id) === parsed.instanceId);
    const instanceName = instance?.name ?? parsed.instanceId;

    try {
      const [paused, skipCheck] = await Promise.all([
        addPaused.getValue(),
        skipRecheck.getValue(),
      ]);
      await addTorrent(parsed.instanceId, info.linkUrl, parsed.category, {
        paused,
        skipChecking: skipCheck,
      });
      browser.notifications.create(`success-${Date.now()}`, {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'Torrent Added',
        message: `Added to ${instanceName}${parsed.category ? ' / ' + parsed.category : ''}`,
      });
    } catch (err) {
      browser.notifications.create(`error-${Date.now()}`, {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon-128.png'),
        title: 'Failed to Add Torrent',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // --- onMessage: handle messages from options page ---
  browser.runtime.onMessage.addListener(
    (message: ApiMessage, _sender, sendResponse: (response: ApiResponse<unknown>) => void) => {
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
            case 'add-torrent': {
              const [p, s] = await Promise.all([
                addPaused.getValue(),
                skipRecheck.getValue(),
              ]);
              data = await addTorrent(message.instanceId, message.urls, message.category, {
                paused: p,
                skipChecking: s,
              });
              break;
            }
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
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      })();

      return true;
    },
  );

  // --- storage.onChanged: rebuild menus when favorites change ---
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes['favorites'] || changes['favoritesOnly'])) {
      rebuildMenus();
    }
  });
});
