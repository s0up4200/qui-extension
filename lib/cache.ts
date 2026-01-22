import { getInstances, getCategories } from '@/lib/api';
import { cachedData } from '@/lib/storage';

export async function refreshCache(): Promise<boolean> {
  let instances;
  try {
    instances = await getInstances();
  } catch {
    return false;
  }

  const categoriesByInstance: Record<string, import('@/lib/api').Category[]> = {};
  for (const instance of instances) {
    try {
      categoriesByInstance[instance.id] = await getCategories(instance.id);
    } catch {
      categoriesByInstance[instance.id] = [];
    }
  }

  await cachedData.setValue({
    instances,
    categoriesByInstance,
    lastRefreshed: Date.now(),
  });

  return true;
}

export async function loadCachedData() {
  return cachedData.getValue();
}
