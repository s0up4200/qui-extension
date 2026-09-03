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
  lastRefreshed: number;
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
  fallback: { instances: [], categoriesByInstance: {}, lastRefreshed: 0 },
});

export const favoritesOnly = storage.defineItem<boolean>('local:favoritesOnly', {
  fallback: false,
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
export const crossSeedPending = storage.defineItem<CrossSeedPending | null>('session:crossSeedPending', {
  fallback: null,
});
