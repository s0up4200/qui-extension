import { storage } from 'wxt/utils/storage';
import type { Instance, Category } from '@/lib/api';

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
