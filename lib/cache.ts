import { getInstances, getCategories, type Category } from '@/lib/api';
import { cachedData } from '@/lib/storage';

export async function refreshCache(): Promise<void> {
  let instances;
  try {
    instances = await getInstances();
  } catch {
    return;
  }

  const categoriesByInstance: Record<string, Category[]> = {};
  for (const instance of instances) {
    try {
      categoriesByInstance[instance.id] = await getCategories(instance.id);
    } catch {
      categoriesByInstance[instance.id] = [];
    }
  }

  await cachedData.setValue({ instances, categoriesByInstance });
}
