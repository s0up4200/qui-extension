import {
  cachedData,
  favorites,
  favoritesOnly,
  enabledInstances,
  enabledInstanceList,
  isFavorite,
  savePaths,
  crossSeedMenuPosition,
  otherPathMenuPosition,
  type MenuPosition,
} from '@/lib/storage';
import { makeMenuId, makePathMenuId, makeCrossSeedMenuId, makeOtherPathMenuId } from '@/lib/menu-id';

export async function rebuildMenus(): Promise<void> {
  await browser.contextMenus.removeAll();

  const [cache, favs, onlyFavs, enabled, paths, crossSeedPosition, otherPathPosition] = await Promise.all([
    cachedData.getValue(),
    favorites.getValue(),
    favoritesOnly.getValue(),
    enabledInstances.getValue(),
    savePaths.getValue(),
    crossSeedMenuPosition.getValue(),
    otherPathMenuPosition.getValue(),
  ]);

  // The items at each end of an instance submenu. Cross-seed comes first when both share an end.
  const actionsAt = (end: MenuPosition) => [
    ...(crossSeedPosition === end ? [{ makeId: makeCrossSeedMenuId, title: 'Cross-seed in qui' }] : []),
    ...(otherPathPosition === end ? [{ makeId: makeOtherPathMenuId, title: 'Other path…' }] : []),
  ];
  const topActions = actionsAt('top');
  const bottomActions = actionsAt('bottom');

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

  browser.contextMenus.create({
    id: 'qui',
    title: 'qui',
    contexts: ['link'],
  });

  const instanceMenus = selectedInstances.map((instance) => {
    const categories = cache.categoriesByInstance[instance.id] ?? [];
    const starred = categories.filter((c) => isFavorite(favs, instance.id, c.name));
    const unstarred = categories.filter((c) => !isFavorite(favs, instance.id, c.name));
    const hasNoCategoryFav = isFavorite(favs, instance.id, '');

    const showNoCategory = !onlyFavs || hasNoCategoryFav;
    const shownCategories = onlyFavs ? starred : [...starred, ...unstarred];
    const hasCategories = showNoCategory || shownCategories.length > 0;

    return { instance, showNoCategory, shownCategories, hasCategories };
  }).filter(({ hasCategories }) =>
    topActions.length > 0 || bottomActions.length > 0 || hasCategories || paths.length > 0,
  );

  const singleInstance = instanceMenus.length === 1;

  for (const { instance, showNoCategory, shownCategories, hasCategories } of instanceMenus) {
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

    function createActions(actions: typeof topActions) {
      for (const { makeId, title } of actions) {
        browser.contextMenus.create({ id: makeId(instance.id), parentId, title, contexts: ['link'] });
      }
    }

    createActions(topActions);

    if (topActions.length > 0 && hasCategories) {
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
      if (hasCategories || topActions.length > 0) {
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

    if (bottomActions.length > 0) {
      if (hasCategories || paths.length > 0) {
        browser.contextMenus.create({
          id: `actions-sep-${instance.id}`,
          parentId,
          type: 'separator',
          contexts: ['link'],
        });
      }
      createActions(bottomActions);
    }
  }

  if (instanceMenus.length === 0) {
    browser.contextMenus.create({
      id: 'qui-no-actions',
      parentId: 'qui',
      title: 'No actions available (configure in settings)',
      contexts: ['link'],
      enabled: false,
    });
  }
}
