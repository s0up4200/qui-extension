import { useState, useEffect } from 'react';
import { Text, Flex, Box, IconButton, ScrollArea } from '@radix-ui/themes';
import { StarFilledIcon, StarIcon, GearIcon, HeartFilledIcon } from '@radix-ui/react-icons';
import { browser } from 'wxt/browser';
import { favorites, favoritesOnly, cachedData as cachedDataStorage } from '@/lib/storage';
import type { Favorite, CacheData } from '@/lib/storage';

export default function App() {
  const [data, setData] = useState<CacheData | null>(null);
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [savedFavs, cached, savedOnlyFavs] = await Promise.all([
        favorites.getValue(),
        cachedDataStorage.getValue(),
        favoritesOnly.getValue(),
      ]);
      setFavs(savedFavs);
      setOnlyFavs(savedOnlyFavs);
      if (cached.instances.length > 0) {
        setData(cached);
      }
      setLoading(false);
    }
    load();
  }, []);

  function isFavorite(instanceId: string, category: string): boolean {
    return favs.some((f) => f.instanceId === instanceId && f.category === category);
  }

  async function toggleFavorite(instanceId: string, category: string) {
    let updatedFavs: Favorite[];
    if (isFavorite(instanceId, category)) {
      updatedFavs = favs.filter((f) => !(f.instanceId === instanceId && f.category === category));
    } else {
      updatedFavs = [...favs, { instanceId, category }];
    }
    await favorites.setValue(updatedFavs);
    setFavs(updatedFavs);
  }

  async function toggleOnlyFavs() {
    const next = !onlyFavs;
    await favoritesOnly.setValue(next);
    setOnlyFavs(next);
  }

  function openOptions() {
    browser.runtime.openOptionsPage();
  }

  if (loading) {
    return (
      <Box style={{ width: 320, padding: 20, background: 'var(--color-background)' }}>
        <Text size="2" style={{ color: 'var(--color-muted)' }}>Loading...</Text>
      </Box>
    );
  }

  if (!data || data.instances.length === 0) {
    return (
      <Box style={{ width: 320, padding: 20, background: 'var(--color-background)' }}>
        <Flex align="center" style={{ marginBottom: 8 }}>
          <Text size="4" weight="bold" style={{ color: 'var(--color-text)' }}>qui</Text>
        </Flex>
        <Flex justify="between" align="center" mb="4">
          <Text size="3" weight="medium" style={{ color: 'var(--color-text)' }}>Favorites</Text>
          <Flex align="center" gap="1">
            <IconButton
              variant="ghost"
              size="1"
              onClick={openOptions}
              title="Support"
              style={{ color: 'var(--red-9, #e5484d)' }}
            >
              <HeartFilledIcon width={15} height={15} />
            </IconButton>
            <IconButton
              variant="ghost"
              size="1"
              onClick={openOptions}
              title="Settings"
              style={{ color: 'var(--color-muted)' }}
            >
              <GearIcon width={15} height={15} />
            </IconButton>
          </Flex>
        </Flex>
        <Box
          style={{
            background: 'var(--color-surface)',
            borderRadius: 12,
            border: '1px solid var(--color-border)',
            padding: '20px 16px',
          }}
        >
          <Text size="2" style={{ color: 'var(--color-muted)', lineHeight: 1.5 }}>
            No instances found. Open settings to configure your server.
          </Text>
        </Box>
      </Box>
    );
  }

  // Group rows by instance
  const grouped = data.instances.map((instance) => {
    const categories = data.categoriesByInstance[instance.id] || [];
    const items = categories.length > 0
      ? categories.map((cat) => ({ category: cat.name }))
      : [{ category: '' }];
    return { instanceId: instance.id, instanceName: instance.name, items };
  });

  return (
    <Box style={{ width: 320, background: 'var(--color-background)' }}>
      <Flex align="center" style={{ padding: '14px 20px 0' }}>
        <Text size="4" weight="bold" style={{ color: 'var(--color-text)' }}>qui</Text>
      </Flex>
      <Flex justify="between" align="center" style={{ padding: '16px 20px 12px' }}>
        <Text size="3" weight="medium" style={{ color: 'var(--color-text)' }}>Favorites</Text>
        <Flex align="center" gap="1">
          <IconButton
            variant="ghost"
            size="1"
            onClick={openOptions}
            title="Support"
            style={{ color: 'var(--red-9, #e5484d)' }}
          >
            <HeartFilledIcon width={15} height={15} />
          </IconButton>
          <IconButton
            variant="ghost"
            size="1"
            onClick={openOptions}
            title="Settings"
            style={{ color: 'var(--color-muted)' }}
          >
            <GearIcon width={15} height={15} />
          </IconButton>
        </Flex>
      </Flex>
      <Flex
        align="center"
        justify="between"
        style={{ padding: '0 20px 10px' }}
      >
        <Text size="1" style={{ color: 'var(--color-muted)' }}>
          Only show favorites in menu
        </Text>
        <button
          onClick={toggleOnlyFavs}
          role="switch"
          aria-checked={onlyFavs}
          className="toggle-track"
          style={{
            width: 34,
            height: 18,
            borderRadius: 9,
            border: 'none',
            padding: 2,
            cursor: 'pointer',
            background: onlyFavs ? 'var(--color-primary)' : 'var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: onlyFavs ? 'flex-end' : 'flex-start',
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'var(--color-text)',
              display: 'block',
            }}
          />
        </button>
      </Flex>
      <ScrollArea style={{ maxHeight: 420 }}>
        <Flex direction="column" gap="3" style={{ padding: '0 16px 16px' }}>
          {grouped.map((group) => (
            <Box
              key={group.instanceId}
              style={{
                background: 'var(--color-surface)',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
              }}
            >
              <Box style={{ padding: '10px 14px 6px' }}>
                <Text size="2" weight="medium" style={{ color: 'var(--color-text)' }}>
                  {group.instanceName}
                </Text>
              </Box>
              <Flex direction="column" style={{ padding: '0 6px 6px' }}>
                {group.items.map((item) => (
                  <Flex
                    key={`${group.instanceId}-${item.category}`}
                    align="center"
                    justify="between"
                    className="popup-row"
                    style={{
                      padding: '7px 8px',
                      borderRadius: 8,
                      cursor: 'default',
                    }}
                  >
                    <Text size="2" truncate style={{ color: 'var(--color-muted)', flex: 1, minWidth: 0 }}>
                      {item.category || '(No category)'}
                    </Text>
                    <button
                      className="star-btn"
                      onClick={() => toggleFavorite(group.instanceId, item.category)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        color: isFavorite(group.instanceId, item.category)
                          ? 'var(--color-star)'
                          : 'var(--color-muted)',
                        opacity: isFavorite(group.instanceId, item.category) ? 1 : 0.6,
                      }}
                    >
                      {isFavorite(group.instanceId, item.category)
                        ? <StarFilledIcon width={15} height={15} />
                        : <StarIcon width={15} height={15} />
                      }
                    </button>
                  </Flex>
                ))}
              </Flex>
            </Box>
          ))}
        </Flex>
      </ScrollArea>
    </Box>
  );
}
