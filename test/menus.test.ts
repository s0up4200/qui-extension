import { afterAll, beforeEach, expect, spyOn, test } from 'bun:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';

const originalBrowser = Reflect.get(globalThis, 'browser');
Object.assign(globalThis, { browser: fakeBrowser });
const { rebuildMenus } = await import('../lib/menus');

type MenuItem = Parameters<typeof fakeBrowser.contextMenus.create>[0];
const items: MenuItem[] = [];
const create = spyOn(fakeBrowser.contextMenus, 'create').mockImplementation((item) => {
  items.push(item);
  return item.id!;
});
const removeAll = spyOn(fakeBrowser.contextMenus, 'removeAll').mockImplementation(async () => {
  items.length = 0;
});

beforeEach(async () => {
  fakeBrowser.reset();
  items.length = 0;
  await fakeBrowser.storage.local.set({
    cachedData: {
      instances: [
        { id: '1', name: 'First', host: 'https://first.test' },
        { id: '2', name: 'Second', host: 'https://second.test' },
      ],
      categoriesByInstance: {
        '1': [
          { name: 'movies', savePath: '/movies' },
          { name: 'tv|shows', savePath: '/tv' },
          { name: 'music', savePath: '/music' },
        ],
        '2': [{ name: 'books', savePath: '/books' }],
      },
      lastRefreshed: 1,
    },
    favorites: [{ instanceId: '1', category: 'tv|shows' }],
    savePaths: ['/z|downloads', 'D:\\Downloads'],
  });
});

afterAll(() => {
  create.mockRestore();
  removeAll.mockRestore();
  fakeBrowser.reset();
  Object.assign(globalThis, { browser: originalBrowser });
});

function menu(parentId?: string): string[] {
  return items.filter((item) => item.parentId === parentId).map((item) =>
    item.type === 'separator' ? '---' : `${item.id}: ${item.title}`,
  );
}

test('one selected instance puts all sections directly under qui', async () => {
  await fakeBrowser.storage.local.set({ enabledInstances: ['1'] });
  await rebuildMenus();

  expect(menu()).toEqual(['qui: qui']);
  expect(menu('qui')).toEqual([
    'cross-seed|1|: Cross-seed in qui',
    '---',
    'add|1|: (No category)',
    'add|1|tv|shows: tv|shows',
    'add|1|movies: movies',
    'add|1|music: music',
    '---',
    'path|1|/z|downloads: /z|downloads',
    'path|1|D:\\Downloads: D:\\Downloads',
  ]);
  expect(items.every((item) => item.contexts?.join() === 'link')).toBe(true);

  const initial = [...items];
  await rebuildMenus();
  expect(items).toEqual(initial);
});

test('multiple instances each retain cross-seed and paths in favorites only', async () => {
  await fakeBrowser.storage.local.set({ favoritesOnly: true });
  await rebuildMenus();

  expect(menu()).toEqual(['qui: qui']);
  expect(menu('qui')).toEqual(['instance-1: First', 'instance-2: Second']);
  expect(menu('instance-1')).toEqual([
    'cross-seed|1|: Cross-seed in qui',
    '---',
    'add|1|tv|shows: tv|shows',
    '---',
    'path|1|/z|downloads: /z|downloads',
    'path|1|D:\\Downloads: D:\\Downloads',
  ]);
  expect(menu('instance-2')).toEqual([
    'cross-seed|2|: Cross-seed in qui',
    '---',
    'path|2|/z|downloads: /z|downloads',
    'path|2|D:\\Downloads: D:\\Downloads',
  ]);
});

test.each([{ favorites: [] }, { favorites: [{ instanceId: '1', category: 'deleted' }] }])(
  'favorites only with no visible categories keeps cross-seed without a separator: %j',
  async ({ favorites }) => {
    await fakeBrowser.storage.local.set({
      enabledInstances: ['1'], favoritesOnly: true, favorites, savePaths: [],
    });
    await rebuildMenus();

    expect(menu()).toEqual(['qui: qui']);
    expect(menu('qui')).toEqual(['cross-seed|1|: Cross-seed in qui']);
  },
);

test('favorites only shows no-category when starred, without a trailing separator', async () => {
  await fakeBrowser.storage.local.set({
    enabledInstances: ['2'],
    favoritesOnly: true,
    favorites: [{ instanceId: '2', category: '' }],
    savePaths: [],
  });
  await rebuildMenus();

  expect(menu()).toEqual(['qui: qui']);
  expect(menu('qui')).toEqual([
    'cross-seed|2|: Cross-seed in qui',
    '---',
    'add|2|: (No category)',
  ]);
});

test('no cached instances keeps the settings message', async () => {
  await fakeBrowser.storage.local.remove('cachedData');
  await rebuildMenus();

  expect(menu()).toEqual(['qui-no-instances: No instances (configure in settings)']);
  expect(items[0]?.enabled).toBe(false);
});

test.each([{ enabledInstances: [] }, { enabledInstances: ['deleted'] }])('no selected instances keeps the settings message: %j', async (settings) => {
  await fakeBrowser.storage.local.set({ enabledInstances: settings.enabledInstances });
  await rebuildMenus();

  expect(menu()).toEqual(['qui-no-selected-instances: No instances selected (configure in settings)']);
  expect(items[0]?.enabled).toBe(false);
});
