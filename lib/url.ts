export function isMagnetUrl(url: string): boolean {
  return url.startsWith('magnet:');
}
