import { storage } from 'wxt/utils/storage';
import type { Instance, Category, CrossSeedProposals } from '@/lib/api';
import type { TorrentFileData } from '@/lib/messaging';

export interface Favorite {
  instanceId: string;
  category: string;
}

export interface CacheData {
  instances: Instance[];
  categoriesByInstance: Record<string, Category[]>;
}

export function isFavorite(favs: Favorite[], instanceId: string, category: string): boolean {
  return favs.some((f) => f.instanceId === instanceId && f.category === category);
}

export function toggleFavorite(favs: Favorite[], instanceId: string, category: string): Favorite[] {
  return isFavorite(favs, instanceId, category)
    ? favs.filter((f) => !(f.instanceId === instanceId && f.category === category))
    : [...favs, { instanceId, category }];
}

/** `enabled` null means every instance. */
export function enabledInstanceList(instances: Instance[], enabled: string[] | null): Instance[] {
  return enabled === null ? instances : instances.filter((i) => enabled.includes(i.id));
}

export const serverUrl = storage.defineItem<string>('local:serverUrl', {
  fallback: '',
});

export const apiKey = storage.defineItem<string>('local:apiKey', {
  fallback: '',
});

export const favorites = storage.defineItem<Favorite[]>('local:favorites', {
  fallback: [],
});

export const enabledInstances = storage.defineItem<string[] | null>('local:enabledInstances', {
  fallback: null,
});

export const cachedData = storage.defineItem<CacheData>('local:cachedData', {
  fallback: { instances: [], categoriesByInstance: {} },
});

export const favoritesOnly = storage.defineItem<boolean>('local:favoritesOnly', {
  fallback: false,
});

export type MenuPosition = 'top' | 'bottom' | 'disabled';

export const crossSeedMenuPosition = storage.defineItem<MenuPosition>('local:crossSeedMenuPosition', {
  fallback: 'top',
});

// Off by default, so an update does not change the menu.
export const otherPathMenuPosition = storage.defineItem<MenuPosition>('local:otherPathMenuPosition', {
  fallback: 'disabled',
});

export const addPaused = storage.defineItem<boolean>('local:addPaused', {
  fallback: false,
});

export const skipRecheck = storage.defineItem<boolean>('local:skipRecheck', {
  fallback: false,
});

export const basicAuthUsername = storage.defineItem<string>('local:basicAuthUsername', {
  fallback: '',
});

export const basicAuthPassword = storage.defineItem<string>('local:basicAuthPassword', {
  fallback: '',
});

export const savePaths = storage.defineItem<string[]>('local:savePaths', {
  fallback: [],
});

export interface CrossSeedPending {
  // Ties an apply to the payload the picker was opened for.
  id: string;
  instanceId: string;
  instanceName: string;
  file: TorrentFileData;
  match: CrossSeedProposals;
}

// Session area: the torrent payload never touches disk and dies with the
// browser. ponytail: one pending slot, the newest right-click wins.
// Only lib/pending-cross-seed.ts reads or writes it.
export const crossSeedPending = storage.defineItem<CrossSeedPending | null>('session:crossSeedPending', {
  fallback: null,
});

export interface OneTimePathPending {
  // Ties an apply to the right-click the window was opened for.
  id: string;
  instanceId: string;
  instanceName: string;
  torrentName: string;
  /** The magnet link, or the bytes of the .torrent file. */
  torrent: string | TorrentFileData;
}

// Session area, as crossSeedPending. ponytail: one pending slot, the newest right-click wins.
// Only lib/pending-one-time-path.ts reads or writes it.
export const oneTimePathPending = storage.defineItem<OneTimePathPending | null>('session:oneTimePathPending', {
  fallback: null,
});
