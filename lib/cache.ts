import type { Category, getCategories, getInstances } from './api';
import type { CacheData } from './storage';

export interface CacheStore {
  getValue(): Promise<CacheData>;
  setValue(value: CacheData): Promise<void>;
}

export interface QuiCache {
  instances: typeof getInstances;
  categories: typeof getCategories;
}

export type RefreshResult = {
  /** Names of the instances whose categories failed to load. */
  failedInstances: string[];
};

/**
 * Fetches instances and categories from qui into the cache. An instance
 * request failure throws and leaves the cache as it was. A category failure
 * keeps the previous categories of that instance and names it in the result.
 */
export async function refreshCache(store: CacheStore, qui: QuiCache): Promise<RefreshResult> {
  const instances = await qui.instances();
  const previous = await store.getValue();

  const categoriesByInstance: Record<string, Category[]> = {};
  const failedInstances: string[] = [];
  for (const instance of instances) {
    try {
      categoriesByInstance[instance.id] = await qui.categories(instance.id);
    } catch {
      categoriesByInstance[instance.id] = previous.categoriesByInstance[instance.id] ?? [];
      failedInstances.push(instance.name);
    }
  }

  await store.setValue({ instances, categoriesByInstance });
  return { failedInstances };
}
