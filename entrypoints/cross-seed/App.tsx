import { useEffect, useState } from 'react';
import { Box, Button, Card, Flex, Heading, RadioCards, Text, TextField } from '@radix-ui/themes';
import { browser } from 'wxt/browser';
import { sendToBackground } from '@/lib/messaging';
import { cachedData, crossSeedPending, type CrossSeedPending } from '@/lib/storage';

function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export default function App() {
  const [pending, setPending] = useState<CrossSeedPending | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [targetHash, setTargetHash] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const [p, cache] = await Promise.all([crossSeedPending.getValue(), cachedData.getValue()]);
      if (p) {
        setCategories((cache.categoriesByInstance[p.instanceId] ?? []).map((c) => c.name));
        const top = p.match.proposals[0];
        if (top) {
          setTargetHash(top.hash);
          setCategory(top.category);
        }
        setTags(p.match.default_tags.join(', '));
      }
      setPending(p);
      setLoading(false);
    }
    load();
  }, []);

  async function apply() {
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      await sendToBackground({
        type: 'apply-cross-seed',
        pendingId: pending.id,
        targetHash,
        category: pending.match.pinned_category ? undefined : category,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      const tab = await browser.tabs.getCurrent();
      if (tab?.id) await browser.tabs.remove(tab.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setBusy(false);
    }
  }

  if (loading) {
    return <Text size="2" style={{ color: 'var(--color-muted)', padding: 24, display: 'block' }}>Loading...</Text>;
  }

  if (!pending) {
    return (
      <Box p="6">
        <Text size="2" style={{ color: 'var(--color-muted)' }}>
          Nothing to cross-seed. Right-click a .torrent link and pick Cross-seed in qui.
        </Text>
      </Box>
    );
  }

  const { proposals, pinned_category } = pending.match;
  // The selected proposal's category may be missing from the cache; offer it anyway.
  const categoryOptions = Array.from(new Set([...categories, category].filter(Boolean)));

  return (
    <Box p="6" style={{ maxWidth: 720, margin: '0 auto', color: 'var(--color-text)' }}>
      <Heading size="5" mb="1">Cross-seed in {pending.instanceName}</Heading>
      <Text size="2" style={{ color: 'var(--color-muted)' }}>
        {pending.match.source_name} · {formatBytes(pending.match.source_size)} · {pending.match.source_file_count} files
      </Text>

      {proposals.length === 0 ? (
        <Card mt="5">
          <Text size="2">No torrent on this instance shares files with this one.</Text>
        </Card>
      ) : (
        <>
          <Text as="p" size="2" weight="medium" mt="5" mb="2">Cross-seed of</Text>
          <RadioCards.Root
            value={targetHash}
            onValueChange={(hash) => {
              setTargetHash(hash);
              setCategory(proposals.find((p) => p.hash === hash)?.category ?? '');
            }}
            columns="1"
            gap="2"
          >
            {proposals.map((p) => (
              <RadioCards.Item key={p.hash} value={p.hash}>
                <Flex direction="column" width="100%" gap="1">
                  <Text size="2" weight="medium" style={{ wordBreak: 'break-all' }}>{p.name}</Text>
                  <Text size="1" style={{ color: 'var(--color-muted)' }}>
                    {Math.round(p.overlap_fraction * 100)}% overlap · {formatBytes(p.size)}{p.category ? ` · ${p.category}` : ''}
                  </Text>
                </Flex>
              </RadioCards.Item>
            ))}
          </RadioCards.Root>

          <Flex direction="column" gap="3" mt="5">
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Category</Text>
              {pinned_category ? (
                <Text size="2" style={{ color: 'var(--color-muted)' }}>{pinned_category} (pinned by qui)</Text>
              ) : (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <option value="">(No category)</option>
                  {categoryOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
            </label>
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Tags</Text>
              <TextField.Root
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="comma, separated"
              />
            </label>
          </Flex>

          {error && (
            <Text as="p" size="2" color="red" mt="3">{error}</Text>
          )}

          <Flex justify="end" mt="5">
            <Button onClick={apply} disabled={busy || !targetHash} loading={busy}>
              Add cross-seed
            </Button>
          </Flex>
        </>
      )}
    </Box>
  );
}
