import { useState, useEffect } from 'react';
import { Text, Flex, Box, IconButton, ScrollArea } from '@radix-ui/themes';
import { StarFilledIcon, StarIcon, GearIcon, HeartFilledIcon } from '@radix-ui/react-icons';
import { browser } from 'wxt/browser';
import {
  favorites,
  favoritesOnly,
  cachedData as cachedDataStorage,
  enabledInstances,
  enabledInstanceList,
  isFavorite,
  serverUrl,
  toggleFavorite,
} from '@/lib/storage';
import { hasHostPermission, MISSING_HOST_PERMISSION } from '@/lib/permissions';
import type { Favorite, CacheData } from '@/lib/storage';

function openOptions() {
  browser.runtime.openOptionsPage();
}

function Header() {
  return (
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
  );
}

function Empty({ children }: { children: string }) {
  return (
    <Box style={{ width: 320, padding: 20, background: 'var(--color-background)' }}>
      <Flex align="center" style={{ marginBottom: 8 }}>
        <Text size="4" weight="bold" style={{ color: 'var(--color-text)' }}>qui</Text>
      </Flex>
      <Header />
      <Box
        style={{
          background: 'var(--color-surface)',
          borderRadius: 12,
          border: '1px solid var(--color-border)',
          padding: '20px 16px',
        }}
      >
        <Text size="2" style={{ color: 'var(--color-muted)', lineHeight: 1.5 }}>{children}</Text>
      </Box>
    </Box>
  );
}

export default function App() {
  const [data, setData] = useState<CacheData | null>(null);
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [enabled, setEnabled] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    async function load() {
      const [savedFavs, cached, savedOnlyFavs, savedEnabled, savedUrl] = await Promise.all([
        favorites.getValue(),
        cachedDataStorage.getValue(),
        favoritesOnly.getValue(),
        enabledInstances.getValue(),
        serverUrl.getValue(),
      ]);
      setFavs(savedFavs);
      setOnlyFavs(savedOnlyFavs);
      setEnabled(savedEnabled);
      setNeedsPermission(Boolean(savedUrl) && !(await hasHostPermission(savedUrl)));
      if (cached.instances.length > 0) {
        setData(cached);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function toggle(instanceId: string, category: string) {
    const next = toggleFavorite(favs, instanceId, category);
    await favorites.setValue(next);
    setFavs(next);
  }

  async function toggleOnlyFavs() {
    const next = !onlyFavs;
    await favoritesOnly.setValue(next);
    setOnlyFavs(next);
  }

  if (loading) {
    return <Empty>Loading...</Empty>;
  }

  if (!data || data.instances.length === 0) {
    return <Empty>No instances found. Open settings to configure your server.</Empty>;
  }

  const instances = enabledInstanceList(data.instances, enabled);
  if (instances.length === 0) {
    return <Empty>No instances selected. Open settings to enable at least one instance.</Empty>;
  }

  return (
    <Box style={{ width: 320, background: 'var(--color-background)' }}>
      <Flex align="center" style={{ padding: '14px 20px 0' }}>
        <Text size="4" weight="bold" style={{ color: 'var(--color-text)' }}>qui</Text>
      </Flex>
      {needsPermission && (
        <Box style={{ padding: '12px 20px 0' }}>
          <Text size="2" color="red" style={{ lineHeight: 1.5 }}>
            {MISSING_HOST_PERMISSION}
          </Text>
        </Box>
      )}
      <Box style={{ padding: '16px 20px 0' }}>
        <Header />
      </Box>
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
          {instances.map((instance) => {
            const names = (data.categoriesByInstance[instance.id] ?? []).map((c) => c.name);
            return (
            <Box
              key={instance.id}
              style={{
                background: 'var(--color-surface)',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
              }}
            >
              <Box style={{ padding: '10px 14px 6px' }}>
                <Text size="2" weight="medium" style={{ color: 'var(--color-text)' }}>
                  {instance.name}
                </Text>
              </Box>
              <Flex direction="column" style={{ padding: '0 6px 6px' }}>
                {(names.length ? names : ['']).map((category) => {
                  const starred = isFavorite(favs, instance.id, category);
                  return (
                  <Flex
                    key={`${instance.id}-${category}`}
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
                      {category || '(No category)'}
                    </Text>
                    <button
                      className="star-btn"
                      onClick={() => toggle(instance.id, category)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        color: starred ? 'var(--color-star)' : 'var(--color-muted)',
                        opacity: starred ? 1 : 0.6,
                      }}
                    >
                      {starred
                        ? <StarFilledIcon width={15} height={15} />
                        : <StarIcon width={15} height={15} />
                      }
                    </button>
                  </Flex>
                  );
                })}
              </Flex>
            </Box>
            );
          })}
        </Flex>
      </ScrollArea>
    </Box>
  );
}
