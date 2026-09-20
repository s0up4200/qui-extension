import { useEffect, useState } from 'react';
import { Box, Button, Card, CheckboxCards, Flex, Heading, RadioCards, Text, TextField } from '@radix-ui/themes';
import type { AssembleResult, CrossSeedProposals, TorrentSummary } from '@/lib/api';
import { browser } from 'wxt/browser';
import { sendToBackground } from '@/lib/messaging';
import { cachedData, crossSeedPending, type CrossSeedPending } from '@/lib/storage';
import { assembleReason, canAssemble, defaultTargets, targetRows, type TargetRow } from '@/lib/cross-seed-targets';

function proposalCategory(match: CrossSeedProposals, hash: string | undefined): string {
  return match.proposals.find((p) => p.hash.toLowerCase() === hash)?.category ?? '';
}

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
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TorrentSummary[]>([]);
  const [preview, setPreview] = useState<AssembleResult | null>(null);
  // qui's suggested episodes for a season pack, fetched once the picker opens.
  const [suggest, setSuggest] = useState<AssembleResult | null>(null);
  // A category the user picked stays ahead of any default from a preview.
  const [categoryEdited, setCategoryEdited] = useState(false);

  const packMode = pending ? canAssemble(pending.match) : false;
  const assembling = packMode && selected.length > 1;

  useEffect(() => {
    async function load() {
      const [p, cache] = await Promise.all([crossSeedPending.getValue(), cachedData.getValue()]);
      if (p) {
        setCategories((cache.categoriesByInstance[p.instanceId] ?? []).map((c) => c.name));
        setTags(p.match.default_tags.join(', '));
        let suggested: AssembleResult | null = null;
        if (canAssemble(p.match)) {
          try {
            suggested = await sendToBackground<AssembleResult>({
              type: 'check-cross-seed-assemble',
              pendingId: p.id,
              targetHashes: [],
            });
            setSuggest(suggested);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        }
        const targets = defaultTargets(p.match, suggested);
        setSelected(targets);
        setCategory(
          targets.length > 1
            ? suggested?.default_category ?? ''
            : proposalCategory(p.match, targets[0]),
        );
      }
      setPending(p);
      setLoading(false);
    }
    load();
  }, []);

  // Debounced name search on the instance, for targets the ranking did not surface.
  useEffect(() => {
    if (!pending || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const found = await sendToBackground<TorrentSummary[]>({
          type: 'search-torrents',
          instanceId: pending.instanceId,
          query: query.trim(),
        });
        if (!stale) setResults(found);
      } catch (err) {
        if (!stale) setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, pending]);

  // Debounced pack preview whenever the multi-selection changes.
  const selectedKey = [...selected].sort().join(',');
  useEffect(() => {
    if (!pending || !assembling) {
      setPreview(null);
      return;
    }
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const result = await sendToBackground<AssembleResult>({
          type: 'check-cross-seed-assemble',
          pendingId: pending.id,
          targetHashes: selected,
        });
        if (stale) return;
        setPreview(result);
        if (!categoryEdited && result.default_category) setCategory(result.default_category);
      } catch (err) {
        if (stale) return;
        setPreview(null);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [selectedKey, assembling, pending]);

  function selectSingle(hash: string) {
    setSelected([hash]);
    if (pending && !categoryEdited) setCategory(proposalCategory(pending.match, hash));
  }

  async function pinTarget(torrent: TorrentSummary) {
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      const match = await sendToBackground<CrossSeedProposals>({
        type: 'pin-cross-seed-target',
        pendingId: pending.id,
        targetHash: torrent.hash,
      });
      setPending({ ...pending, match });
      const hash = torrent.hash.toLowerCase();
      if (packMode) {
        setSelected((prev) => (prev.includes(hash) ? prev : [...prev, hash]));
      } else {
        setSelected([hash]);
        if (!categoryEdited) setCategory(torrent.category);
      }
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      await sendToBackground({
        type: 'apply-cross-seed',
        pendingId: pending.id,
        targetHashes: selected,
        category: pending.match.pinned_category && !assembling ? undefined : category,
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

  const { pinned_category, assembly_unavailable_reason } = pending.match;
  const rows = targetRows(pending.match, suggest);
  // The selected proposal's category may be missing from the cache; offer it anyway.
  const categoryOptions = Array.from(new Set([...categories, category].filter(Boolean)));
  const canApply = selected.length > 0 && (!assembling || preview?.ready);

  const rowBody = (row: TargetRow) => (
    <Flex direction="column" width="100%" gap="1">
      <Text size="2" weight="medium" style={{ wordBreak: 'break-all' }}>{row.name}</Text>
      <Text size="1" style={{ color: 'var(--color-muted)' }}>{row.detail}</Text>
    </Flex>
  );

  return (
    <Box p="6" style={{ color: 'var(--color-text)' }}>
      <Heading size="5" mb="1">Cross-seed in {pending.instanceName}</Heading>
      <Text size="2" style={{ color: 'var(--color-muted)' }}>
        {pending.match.source_name} · {formatBytes(pending.match.source_size)} · {pending.match.source_file_count} files
      </Text>

      {assembly_unavailable_reason && (
        <Card mt="3">
          <Text size="2">{assembleReason(assembly_unavailable_reason)}</Text>
        </Card>
      )}

      {rows.length === 0 && (
        <Card mt="5">
          <Text size="2">No torrent on this instance shares files with this one.</Text>
        </Card>
      )}

      <Text as="p" size="2" weight="medium" mt="6" mb="2">Pick another torrent by name</Text>
      <TextField.Root
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search torrents on this instance"
      />
      {results.length > 0 && (
        <Flex direction="column" gap="1" mt="2">
          {results.map((t) => (
            <Button key={t.hash} variant="soft" color="gray" disabled={busy} onClick={() => pinTarget(t)} style={{ justifyContent: 'flex-start', height: 'auto', padding: '6px 10px' }}>
              <Text size="2" style={{ wordBreak: 'break-all', textAlign: 'left' }}>{t.name}</Text>
              <Text size="1" style={{ color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{formatBytes(t.size)}</Text>
            </Button>
          ))}
        </Flex>
      )}

      {rows.length > 0 && (
        <>
          <Text as="p" size="2" weight="medium" mt="6" mb="2">
            {packMode ? 'Assemble from these episodes (or pick one torrent)' : 'Cross-seed of'}
          </Text>
          {packMode ? (
            <CheckboxCards.Root value={selected} onValueChange={setSelected} columns="1" gap="2">
              {rows.map((row) => (
                <CheckboxCards.Item key={row.hash} value={row.hash}>{rowBody(row)}</CheckboxCards.Item>
              ))}
            </CheckboxCards.Root>
          ) : (
            <RadioCards.Root value={selected[0] ?? ''} onValueChange={selectSingle} columns="1" gap="2">
              {rows.map((row) => (
                <RadioCards.Item key={row.hash} value={row.hash}>{rowBody(row)}</RadioCards.Item>
              ))}
            </RadioCards.Root>
          )}

          {assembling && preview && (
            <Card mt="3">
              <Flex direction="column" gap="1">
                <Text size="2">
                  {preview.matched_episodes} of {preview.total_episodes} episodes · {Math.round(preview.coverage * 100)}% coverage · {formatBytes(preview.missing_bytes)} missing
                </Text>
                {preview.reason && <Text size="2" color="red">{preview.message || assembleReason(preview.reason)}</Text>}
                {preview.targets.filter((t) => t.reason).map((t) => (
                  <Text key={t.hash} size="2" color="red">{t.name || t.hash}: {assembleReason(t.reason)}</Text>
                ))}
                <Text size="1" style={{ color: 'var(--color-muted)' }}>
                  The pack is added paused and rechecked. It resumes when verification reaches the linked byte fraction.
                </Text>
              </Flex>
            </Card>
          )}

          <Flex direction="column" gap="4" mt="6">
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Category</Text>
              {pinned_category && !assembling ? (
                <Text size="2" style={{ color: 'var(--color-muted)' }}>{pinned_category} (pinned by qui)</Text>
              ) : (
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setCategoryEdited(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
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

          <Flex justify="end" mt="6">
            <Button onClick={apply} disabled={busy || !canApply} loading={busy}>
              {assembling ? 'Assemble season pack' : 'Add cross-seed'}
            </Button>
          </Flex>
        </>
      )}

      {error && (
        <Text as="p" size="2" color="red" mt="3">{error}</Text>
      )}
    </Box>
  );
}
