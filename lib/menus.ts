import { loadCachedData } from '@/lib/cache';
import { favorites, favoritesOnly, enabledInstances, type Favorite } from '@/lib/storage';

export function makeMenuId(instanceId: string, category: string): string {
  return `add|${instanceId}|${category}`;
}

export function parseMenuId(
  menuItemId: string,
): { instanceId: string; category: string } | null {
  if (typeof menuItemId !== 'string' || !menuItemId.startsWith('add|')) {
    return null;
  }
  const firstSep = menuItemId.indexOf('|');
  const secondSep = menuItemId.indexOf('|', firstSep + 1);
  if (secondSep === -1) {
    return null;
  }
  return {
    instanceId: menuItemId.slice(firstSep + 1, secondSep),
    category: menuItemId.slice(secondSep + 1),
  };
}

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
  const [favs, onlyFavs, enabled] = await Promise.all([
    favorites.getValue(),
    favoritesOnly.getValue(),
    enabledInstances.getValue(),
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
    }
  }
}
