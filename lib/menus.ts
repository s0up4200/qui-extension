import { loadCachedData } from '@/lib/cache';
import { favorites, favoritesOnly, enabledInstances, savePaths, type CacheData, type Favorite } from '@/lib/storage';
import type { Instance } from '@/lib/api';
import { makeMenuId, makePathMenuId, makeCrossSeedMenuId } from '@/lib/menu-id';

function isStarred(
  favs: Favorite[],
  instanceId: string,
  category: string,
): boolean {
  return favs.some(
    (f) => f.instanceId === instanceId && f.category === category,
  );
}

export async function rebuildMenus(): Promise<void> {
  await browser.contextMenus.removeAll();

  const cache = await loadCachedData();
  const [favs, onlyFavs, enabled, paths] = await Promise.all([
    favorites.getValue(),
    favoritesOnly.getValue(),
    enabledInstances.getValue(),
    savePaths.getValue(),
  ]);

  if (!cache.instances.length) {
    browser.contextMenus.create({
      id: 'qui-no-instances',
      title: 'No instances (configure in settings)',
      contexts: ['link'],
      enabled: false,
    });
    return;
  }

  const selectedInstanceIds =
    enabled === null ? cache.instances.map((instance) => instance.id) : enabled;
  const selectedInstances = cache.instances.filter((instance) =>
    selectedInstanceIds.includes(instance.id),
  );

  if (selectedInstances.length === 0) {
    browser.contextMenus.create({
      id: 'qui-no-selected-instances',
      title: 'No instances selected (configure in settings)',
      contexts: ['link'],
      enabled: false,
    });
    return;
  }

  buildSendMenu(cache, selectedInstances, favs, onlyFavs, paths);
  buildCrossSeedMenu(selectedInstances);
}

function buildCrossSeedMenu(selectedInstances: Instance[]): void {
  // Same collapse rule as "Send to qui": one instance means the top-level
  // item is the action itself.
  if (selectedInstances.length === 1) {
    browser.contextMenus.create({
      id: makeCrossSeedMenuId(selectedInstances[0].id),
      title: 'Cross-seed in qui',
      contexts: ['link'],
    });
    return;
  }

  browser.contextMenus.create({
    id: 'cross-seed-in-qui',
    title: 'Cross-seed in qui',
    contexts: ['link'],
  });
  for (const instance of selectedInstances) {
    browser.contextMenus.create({
      id: makeCrossSeedMenuId(instance.id),
      parentId: 'cross-seed-in-qui',
      title: instance.name,
      contexts: ['link'],
    });
  }
}

function buildSendMenu(
  cache: CacheData,
  selectedInstances: Instance[],
  favs: Favorite[],
  onlyFavs: boolean,
  paths: string[],
): void {
  if (onlyFavs && favs.length === 0) {
    browser.contextMenus.create({
      id: 'qui-no-favorites',
      title: 'No favorites (star items in popup)',
      contexts: ['link'],
      enabled: false,
    });
    return;
  }

  if (onlyFavs) {
    const hasAnyFavorites = selectedInstances.some((instance) => {
      const categories = cache.categoriesByInstance[instance.id] ?? [];
      if (isStarred(favs, instance.id, '')) return true;
      return categories.some((c) => isStarred(favs, instance.id, c.name));
    });

    if (!hasAnyFavorites) {
      browser.contextMenus.create({
        id: 'qui-no-selected-favorites',
        title: 'No favorites for selected instances',
        contexts: ['link'],
        enabled: false,
      });
      return;
    }
  }

  browser.contextMenus.create({
    id: 'send-to-qui',
    title: 'Send to qui',
    contexts: ['link'],
  });

  const singleInstance = selectedInstances.length === 1;

  for (const instance of selectedInstances) {
    const categories = cache.categoriesByInstance[instance.id] ?? [];

    if (onlyFavs) {
      const starredCategories = categories.filter((c) =>
        isStarred(favs, instance.id, c.name),
      );
      const hasNoCategoryFav = isStarred(favs, instance.id, '');

      if (starredCategories.length === 0 && !hasNoCategoryFav) {
        continue;
      }

      const instanceMenuId = `instance-${instance.id}`;
      const parentId = singleInstance ? 'send-to-qui' : instanceMenuId;
      if (!singleInstance) {
        browser.contextMenus.create({
          id: instanceMenuId,
          parentId: 'send-to-qui',
          title: instance.name,
          contexts: ['link'],
        });
      }

      if (hasNoCategoryFav) {
        browser.contextMenus.create({
          id: makeMenuId(instance.id, ''),
          parentId,
          title: '(No category)',
          contexts: ['link'],
        });
      }

      for (const cat of starredCategories) {
        browser.contextMenus.create({
          id: makeMenuId(instance.id, cat.name),
          parentId,
          title: cat.name,
          contexts: ['link'],
        });
      }
    } else {
      const instanceMenuId = `instance-${instance.id}`;
      const parentId = singleInstance ? 'send-to-qui' : instanceMenuId;
      if (!singleInstance) {
        browser.contextMenus.create({
          id: instanceMenuId,
          parentId: 'send-to-qui',
          title: instance.name,
          contexts: ['link'],
        });
      }

      browser.contextMenus.create({
        id: makeMenuId(instance.id, ''),
        parentId,
        title: '(No category)',
        contexts: ['link'],
      });

      const starred = categories.filter((c) =>
        isStarred(favs, instance.id, c.name),
      );
      const unstarred = categories.filter(
        (c) => !isStarred(favs, instance.id, c.name),
      );

      for (const cat of [...starred, ...unstarred]) {
        browser.contextMenus.create({
          id: makeMenuId(instance.id, cat.name),
          parentId,
          title: cat.name,
          contexts: ['link'],
        });
      }

      // Save paths are global and have no category, so favoritesOnly skips them.
      if (paths.length > 0) {
        browser.contextMenus.create({
          id: `paths-sep-${instance.id}`,
          parentId,
          type: 'separator',
          contexts: ['link'],
        });
        for (const savePath of paths) {
          browser.contextMenus.create({
            id: makePathMenuId(instance.id, savePath),
            parentId,
            title: savePath,
            contexts: ['link'],
          });
        }
      }
    }
  }
}
