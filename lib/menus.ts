import { loadCachedData } from '@/lib/cache';
import { favorites, favoritesOnly, type Favorite } from '@/lib/storage';

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
  const favs = await favorites.getValue();
  const onlyFavs = await favoritesOnly.getValue();

  if (!cache.instances.length) {
    browser.contextMenus.create({
      id: 'qui-no-instances',
      title: 'No instances (configure in settings)',
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

  browser.contextMenus.create({
    id: 'send-to-qui',
    title: 'Send to qui',
    contexts: ['link'],
  });

  for (const instance of cache.instances) {
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
      browser.contextMenus.create({
        id: instanceMenuId,
        parentId: 'send-to-qui',
        title: instance.name,
        contexts: ['link'],
      });

      if (hasNoCategoryFav) {
        browser.contextMenus.create({
          id: makeMenuId(instance.id, ''),
          parentId: instanceMenuId,
          title: '(No category)',
          contexts: ['link'],
        });
      }

      for (const cat of starredCategories) {
        browser.contextMenus.create({
          id: makeMenuId(instance.id, cat.name),
          parentId: instanceMenuId,
          title: cat.name,
          contexts: ['link'],
        });
      }
    } else {
      const instanceMenuId = `instance-${instance.id}`;
      browser.contextMenus.create({
        id: instanceMenuId,
        parentId: 'send-to-qui',
        title: instance.name,
        contexts: ['link'],
      });

      browser.contextMenus.create({
        id: makeMenuId(instance.id, ''),
        parentId: instanceMenuId,
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
          parentId: instanceMenuId,
          title: cat.name,
          contexts: ['link'],
        });
      }
    }
  }
}
