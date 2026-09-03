import {
  cachedData,
  favorites,
  favoritesOnly,
  enabledInstances,
  enabledInstanceList,
  isFavorite,
  savePaths,
  type CacheData,
  type Favorite,
} from '@/lib/storage';
import type { Instance } from '@/lib/api';
import { makeMenuId, makePathMenuId, makeCrossSeedMenuId } from '@/lib/menu-id';

export async function rebuildMenus(): Promise<void> {
  await browser.contextMenus.removeAll();

  const [cache, favs, onlyFavs, enabled, paths] = await Promise.all([
    cachedData.getValue(),
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

  const selectedInstances = enabledInstanceList(cache.instances, enabled);

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
      id: makeCrossSeedMenuId(selectedInstances[0]!.id),
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
  // Save paths are global, so they show in every mode.
  const hasPaths = paths.length > 0;

  if (onlyFavs && favs.length === 0 && !hasPaths) {
    browser.contextMenus.create({
      id: 'qui-no-favorites',
      title: 'No favorites (star items in popup)',
      contexts: ['link'],
      enabled: false,
    });
    return;
  }

  if (onlyFavs && !hasPaths) {
    const hasAnyFavorites = selectedInstances.some((instance) => {
      const categories = cache.categoriesByInstance[instance.id] ?? [];
      if (isFavorite(favs, instance.id, '')) return true;
      return categories.some((c) => isFavorite(favs, instance.id, c.name));
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
    const starred = categories.filter((c) => isFavorite(favs, instance.id, c.name));
    const unstarred = categories.filter((c) => !isFavorite(favs, instance.id, c.name));
    const hasNoCategoryFav = isFavorite(favs, instance.id, '');

    const showNoCategory = !onlyFavs || hasNoCategoryFav;
    const shownCategories = onlyFavs ? starred : [...starred, ...unstarred];

    if (!showNoCategory && shownCategories.length === 0 && !hasPaths) {
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

    if (showNoCategory) {
      browser.contextMenus.create({
        id: makeMenuId(instance.id, ''),
        parentId,
        title: '(No category)',
        contexts: ['link'],
      });
    }

    for (const cat of shownCategories) {
      browser.contextMenus.create({
        id: makeMenuId(instance.id, cat.name),
        parentId,
        title: cat.name,
        contexts: ['link'],
      });
    }

    if (hasPaths) {
      if (showNoCategory || shownCategories.length > 0) {
        browser.contextMenus.create({
          id: `paths-sep-${instance.id}`,
          parentId,
          type: 'separator',
          contexts: ['link'],
        });
      }
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
