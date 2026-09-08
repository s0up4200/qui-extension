import { loadCachedData } from '@/lib/cache';
import { favorites, favoritesOnly, enabledInstances, savePaths, type Favorite } from '@/lib/storage';
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

  browser.contextMenus.create({
    id: 'qui',
    title: 'qui',
    contexts: ['link'],
  });

  const singleInstance = selectedInstances.length === 1;

  for (const instance of selectedInstances) {
    const categories = cache.categoriesByInstance[instance.id] ?? [];
    const starred = categories.filter((c) => isStarred(favs, instance.id, c.name));
    const unstarred = categories.filter((c) => !isStarred(favs, instance.id, c.name));
    const hasNoCategoryFav = isStarred(favs, instance.id, '');

    const showNoCategory = !onlyFavs || hasNoCategoryFav;
    const shownCategories = onlyFavs ? starred : [...starred, ...unstarred];

    const instanceMenuId = `instance-${instance.id}`;
    const parentId = singleInstance ? 'qui' : instanceMenuId;
    if (!singleInstance) {
      browser.contextMenus.create({
        id: instanceMenuId,
        parentId: 'qui',
        title: instance.name,
        contexts: ['link'],
      });
    }

    browser.contextMenus.create({
      id: makeCrossSeedMenuId(instance.id),
      parentId,
      title: 'Cross-seed in qui',
      contexts: ['link'],
    });

    if (showNoCategory || shownCategories.length > 0) {
      browser.contextMenus.create({
        id: `categories-sep-${instance.id}`,
        parentId,
        type: 'separator',
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
