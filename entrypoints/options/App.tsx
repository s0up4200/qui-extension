import { useState, useEffect, useMemo } from 'react';
import { browser } from 'wxt/browser';
import { Card, Heading, Text, TextField, Button, Flex, Box, IconButton, Switch, Grid, ScrollArea, Badge } from '@radix-ui/themes';
import { StarFilledIcon, StarIcon, ReloadIcon, CopyIcon, CheckIcon, ExternalLinkIcon, GitHubLogoIcon, ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { Coffee } from 'lucide-react';
import { serverUrl, apiKey, favorites, addPaused, skipRecheck, favoritesOnly, basicAuthUsername, basicAuthPassword } from '@/lib/storage';
import type { Favorite, CacheData } from '@/lib/storage';
import { urlToOrigin } from '@/lib/permissions';
import { sendToBackground } from '@/lib/messaging';


function BtcIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#F7931A">
      <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.546zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.7-.169-1.053-.25l.53-2.12-1.316-.33-.54 2.155c-.285-.065-.565-.13-.84-.2l.001-.005-1.815-.453-.35 1.407s.975.224.955.238c.535.136.63.494.614.778l-.614 2.465c.037.01.085.025.138.047l-.14-.036-.86 3.45c-.065.162-.23.404-.6.315.013.02-.956-.239-.956-.239l-.652 1.514 1.71.427c.318.08.63.164.938.242l-.545 2.19 1.315.328.54-2.164c.36.1.707.19 1.05.273l-.538 2.156 1.316.33.545-2.19c2.24.427 3.93.254 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.2 1.508-.76 1.68-1.93h.003z" />
    </svg>
  );
}

function EthIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#627EEA">
      <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
    </svg>
  );
}

function LtcIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#345D9D">
      <path d="M12 0a12 12 0 1012 12A12 12 0 0012 0zm-.262 3.617h2.83a.46.46 0 01.46.46v.09L13.354 12h3.51a.46.46 0 01.45.54l-.36 1.8a.46.46 0 01-.45.38h-4.2l-1.088 4.34h4.8a.46.46 0 01.45.54l-.36 1.8a.46.46 0 01-.45.37H8.454a.46.46 0 01-.45-.54l1.668-6.51-1.9.67-.08.01a.37.37 0 01-.36-.28l-.36-1.46a.46.46 0 01.28-.53l3.1-1.08L12.2 4.08a.46.46 0 01.44-.46z" />
    </svg>
  );
}

function XmrIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#FF6600">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 1.2c5.96 0 10.8 4.84 10.8 10.8 0 1.457-.29 2.848-.816 4.116h-3.084V7.883L12 14.783l-6.9-6.9v8.233H1.97A10.755 10.755 0 011.2 12C1.2 6.04 6.04 1.2 12 1.2zm-4.5 8.383l4.5 4.5 4.5-4.5v6.333h3.15v3.384A10.76 10.76 0 0112 22.8a10.76 10.76 0 01-7.65-3.183v-3.384H7.5V9.583z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

const CRYPTO_ADDRESSES = [
  { label: 'BTC', address: 'bc1qfe093kmhvsa436v4ksz0udfcggg3vtnm2tjgem', Icon: BtcIcon },
  { label: 'ETH', address: '0xD8f517c395a68FEa8d19832398d4dA7b45cbc38F', Icon: EthIcon },
  { label: 'LTC', address: 'ltc1q86nx64mu2j22psj378amm58ghvy4c9dw80z88h', Icon: LtcIcon },
  { label: 'XMR', address: '8AMPTPgjmLG9armLBvRA8NMZqPWuNT4US3kQoZrxDDVSU21kpYpFr1UCWmmtcBKGsvDCFA3KTphGXExWb3aHEu67JkcjAvC', Icon: XmrIcon },
];

type Status = 'idle' | 'saving' | 'testing' | 'refreshing' | 'success' | 'error';

export default function App() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [cachedData, setCachedData] = useState<CacheData | null>(null);
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [paused, setPaused] = useState(false);
  const [skipCheck, setSkipCheck] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(new Set());
  const [favsOnly, setFavsOnly] = useState(false);
  const [proxyAuthExpanded, setProxyAuthExpanded] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  useEffect(() => {
    async function load() {
      const [savedUrl, savedKey, savedFavs, savedPaused, savedSkip, savedFavsOnly, savedAuthUsername, savedAuthPassword] = await Promise.all([
        serverUrl.getValue(),
        apiKey.getValue(),
        favorites.getValue(),
        addPaused.getValue(),
        skipRecheck.getValue(),
        favoritesOnly.getValue(),
        basicAuthUsername.getValue(),
        basicAuthPassword.getValue(),
      ]);
      setUrl(savedUrl);
      setKey(savedKey);
      setFavs(savedFavs);
      setPaused(savedPaused);
      setSkipCheck(savedSkip);
      setFavsOnly(savedFavsOnly);
      setAuthUsername(savedAuthUsername);
      setAuthPassword(savedAuthPassword);
      if (savedAuthUsername || savedAuthPassword) {
        setProxyAuthExpanded(true);
      }

      try {
        const data = await sendToBackground<CacheData>({ type: 'get-cached-data' });
        setCachedData(data);
        // Expand all instances by default
        if (data?.instances) {
          setExpandedInstances(new Set(data.instances.map((i) => i.id)));
        }
      } catch {
        // Cache not available yet
      }

      setLoading(false);
    }
    load();
  }, []);

  const filteredInstances = useMemo(() => {
    if (!cachedData?.instances) return [];
    const q = filter.toLowerCase();
    if (!q) return cachedData.instances;

    return cachedData.instances.filter((instance) => {
      if (instance.name.toLowerCase().includes(q)) return true;
      const categories = cachedData.categoriesByInstance[instance.id] || [];
      return categories.some((cat) => cat.name.toLowerCase().includes(q));
    });
  }, [cachedData, filter]);

  function toggleExpanded(instanceId: string) {
    setExpandedInstances((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) {
        next.delete(instanceId);
      } else {
        next.add(instanceId);
      }
      return next;
    });
  }

  function filteredCategories(instanceId: string) {
    const categories = cachedData?.categoriesByInstance[instanceId] || [];
    const q = filter.toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => cat.name.toLowerCase().includes(q));
  }

  async function refreshAndUpdateCache(): Promise<void> {
    await sendToBackground({ type: 'refresh-cache' });
    const data = await sendToBackground<CacheData>({ type: 'get-cached-data' });
    setCachedData(data);
    if (data?.instances) {
      setExpandedInstances(new Set(data.instances.map((i) => i.id)));
    }
  }

  async function handleSave() {
    setStatus('saving');
    setMessage('');

    const origin = urlToOrigin(url);
    if (!origin) {
      setStatus('error');
      setMessage('Invalid URL format');
      return;
    }

    await serverUrl.setValue(url.replace(/\/+$/, ''));
    await apiKey.setValue(key);
    await basicAuthUsername.setValue(authUsername);
    await basicAuthPassword.setValue(authPassword);

    setStatus('refreshing');
    setMessage('Settings saved. Refreshing...');

    try {
      await refreshAndUpdateCache();
      setStatus('success');
      setMessage('Settings saved');
    } catch {
      setStatus('success');
      setMessage('Settings saved (refresh failed — try the Refresh button)');
    }
  }

  async function handleTest() {
    setStatus('testing');
    setMessage('Testing connection...');

    try {
      await sendToBackground({ type: 'test-connection' });
      setStatus('success');
      setMessage('Connected! Found qui server.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Connection failed');
    }
  }

  async function handleRefresh() {
    setStatus('refreshing');
    setMessage('Refreshing...');

    try {
      await refreshAndUpdateCache();
      setStatus('success');
      setMessage('Cache refreshed');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Refresh failed');
    }
  }

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

  async function handlePausedChange(checked: boolean) {
    setPaused(checked);
    await addPaused.setValue(checked);
  }

  async function handleSkipChange(checked: boolean) {
    setSkipCheck(checked);
    await skipRecheck.setValue(checked);
  }

  async function handleFavsOnlyChange(checked: boolean) {
    setFavsOnly(checked);
    await favoritesOnly.setValue(checked);
  }

  async function handleCopy(address: string) {
    await navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  }

  function statusColor(): 'green' | 'red' | 'gray' {
    if (status === 'success') return 'green';
    if (status === 'error') return 'red';
    return 'gray';
  }

  if (loading) {
    return (
      <Box p="6" style={{ maxWidth: 900, margin: '0 auto' }}>
        <Text color="gray">Loading...</Text>
      </Box>
    );
  }

  return (
    <Box p="6" style={{ maxWidth: 900, margin: '0 auto' }}>
      <Grid columns={{ initial: '1', md: '320px 1fr' }} gap="5">
        {/* Left Column - sticky config */}
        <Flex direction="column" gap="4" className="options-left-column">
          {/* Server */}
          <Card>
            <Flex direction="column" gap="4">
              <Heading size="3">Server</Heading>

              <Flex direction="column" gap="1">
                <Text size="2" color="gray">Server URL</Text>
                <TextField.Root
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://localhost:7476"
                />
              </Flex>

              <Flex direction="column" gap="1">
                <Text size="2" color="gray">API Key</Text>
                <TextField.Root
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="your-api-key"
                />
              </Flex>

              <Flex direction="column" gap="2">
                <Flex
                  align="center"
                  gap="2"
                  onClick={() => setProxyAuthExpanded(!proxyAuthExpanded)}
                  style={{ cursor: 'pointer' }}
                >
                  {proxyAuthExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                  <Text size="2" color="gray">Basic Auth</Text>
                </Flex>

                {proxyAuthExpanded && (
                  <Flex direction="column" gap="2" pl="4">
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">Username</Text>
                      <TextField.Root
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        placeholder="proxy username"
                      />
                    </Flex>
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">Password</Text>
                      <TextField.Root
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="proxy password"
                      />
                    </Flex>
                    <Text size="1" color="gray">
                      Optional. Sends Authorization header for HTTP Basic Auth.
                    </Text>
                  </Flex>
                )}
              </Flex>

              <Flex gap="3">
                <Button onClick={handleSave} disabled={status === 'saving'}>
                  Save
                </Button>
                <Button variant="soft" onClick={handleTest} disabled={status === 'saving'}>
                  Test Connection
                </Button>
              </Flex>

              {message && (
                <Text size="2" color={statusColor()}>
                  {message}
                </Text>
              )}
            </Flex>
          </Card>

          {/* Torrent Settings */}
          <Card>
            <Flex direction="column" gap="3">
              <Heading size="3">Torrent Settings</Heading>

              <Flex justify="between" align="center">
                <Text size="2">Add as paused</Text>
                <Switch checked={paused} onCheckedChange={handlePausedChange} />
              </Flex>

              <Flex justify="between" align="center">
                <Text size="2">Skip recheck</Text>
                <Switch checked={skipCheck} onCheckedChange={handleSkipChange} />
              </Flex>

            </Flex>
          </Card>

          {/* Support - demoted, no Card wrapper */}
          <Flex direction="column" gap="3" pt="2">
            <Heading size="2" color="gray">Support</Heading>

            <Flex direction="column" gap="2">
              <Flex asChild align="center" gap="2">
                <a href="https://github.com/sponsors/s0up4200" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <GitHubLogoIcon />
                  <Text size="2">GitHub Sponsors</Text>
                  <ExternalLinkIcon color="var(--gray-9)" />
                </a>
              </Flex>
              <Flex asChild align="center" gap="2">
                <a href="https://buymeacoffee.com/s0up4200" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <Coffee size={15} color="#FFDD00" />
                  <Text size="2">Buy Me a Coffee</Text>
                  <ExternalLinkIcon color="var(--gray-9)" />
                </a>
              </Flex>
            </Flex>

            <Flex direction="column" gap="2">
              {CRYPTO_ADDRESSES.map(({ label, address, Icon }) => (
                <Flex key={label} align="center" gap="2">
                  <Icon />
                  <Text size="1" weight="medium" style={{ minWidth: 28 }}>{label}</Text>
                  <Text size="1" color="gray" style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {address}
                  </Text>
                  <IconButton variant="ghost" size="1" onClick={() => handleCopy(address)}>
                    {copied === address ? <CheckIcon color="var(--green-9)" /> : <CopyIcon />}
                  </IconButton>
                </Flex>
              ))}
            </Flex>
          </Flex>

          {/* Community - demoted, no Card wrapper */}
          <Flex direction="column" gap="3" pt="2">
            <Heading size="2" color="gray">Community</Heading>

            <Flex direction="column" gap="2">
              <Flex asChild align="center" gap="2">
                <a href="https://discord.autobrr.com/qui" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <DiscordIcon />
                  <Text size="2">Discord</Text>
                  <ExternalLinkIcon color="var(--gray-9)" />
                </a>
              </Flex>
            </Flex>
          </Flex>
        </Flex>

        {/* Right Column - Favorites */}
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center" gap="3">
            <Heading size="3">Favorites</Heading>
            <Flex align="center" gap="2" style={{ flex: 1 }}>
              <TextField.Root
                size="2"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter..."
                style={{ flex: 1 }}
              >
                <TextField.Slot>
                  <MagnifyingGlassIcon height="14" width="14" />
                </TextField.Slot>
              </TextField.Root>
              <Button
                variant="soft"
                size="2"
                onClick={handleRefresh}
                disabled={status === 'refreshing'}
              >
                <ReloadIcon />
                Refresh
              </Button>
            </Flex>
          </Flex>

          <Flex align="center" gap="2" px="2">
            <Switch size="1" checked={favsOnly} onCheckedChange={handleFavsOnlyChange} />
            <Text size="1" color="gray">Only show favorites in context menu</Text>
          </Flex>

          <ScrollArea className="options-favorites-scroll">
            {!cachedData || cachedData.instances.length === 0 ? (
              <Text size="2" color="gray">
                No instances found. Configure server and click Refresh.
              </Text>
            ) : filteredInstances.length === 0 ? (
              <Text size="2" color="gray">
                No matches for "{filter}"
              </Text>
            ) : (
              <Flex direction="column" gap="2">
                {filteredInstances.map((instance) => {
                  const categories = filteredCategories(instance.id);
                  const allCategories = cachedData.categoriesByInstance[instance.id] || [];
                  const isExpanded = expandedInstances.has(instance.id);
                  const rows = categories.length > 0
                    ? categories.map((cat) => ({ category: cat.name }))
                    : [{ category: '' }];

                  return (
                    <Flex key={instance.id} direction="column">
                      {/* Instance header */}
                      <Flex
                        align="center"
                        gap="2"
                        py="2"
                        px="2"
                        onClick={() => toggleExpanded(instance.id)}
                        className="options-instance-header"
                      >
                        {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                        <Text size="2" weight="medium" style={{ flex: 1 }}>
                          {instance.name}
                        </Text>
                        <Badge size="1" variant="soft" color="gray">
                          {allCategories.length || 1}
                        </Badge>
                      </Flex>

                      {/* Category rows */}
                      {isExpanded && (
                        <Flex direction="column" pl="6">
                          {rows.map((row) => (
                            <Flex
                              key={`${instance.id}-${row.category}`}
                              align="center"
                              justify="between"
                              py="1"
                              px="2"
                              className="options-category-row"
                            >
                              <Text size="2" color="gray">
                                {row.category || '(No category)'}
                              </Text>
                              <IconButton
                                variant="ghost"
                                size="1"
                                onClick={() => toggleFavorite(instance.id, row.category)}
                              >
                                {isFavorite(instance.id, row.category)
                                  ? <StarFilledIcon color="var(--yellow-9)" />
                                  : <StarIcon />
                                }
                              </IconButton>
                            </Flex>
                          ))}
                        </Flex>
                      )}
                    </Flex>
                  );
                })}
              </Flex>
            )}
          </ScrollArea>
        </Flex>
      </Grid>
    </Box>
  );
}
