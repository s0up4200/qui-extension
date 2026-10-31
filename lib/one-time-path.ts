// Pure helpers for the "Other path…" window. No wxt imports so tests can load this file directly.

/** A full path on a Linux host (`/`) or a Windows host (`D:\`, `D:/`, `\\server\`). */
export function isFullPath(text: string): boolean {
  return /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(text.trim());
}

function nameStart(path: string): number {
  return Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1;
}

/** The folder to list (up to and with the last separator) and the prefix the names must match. */
export function suggestStep(text: string): { dir: string; prefix: string } | null {
  const cut = nameStart(text);
  return cut === 0 ? null : { dir: text.slice(0, cut), prefix: text.slice(cut) };
}

/** The listed folders whose own name starts with prefix. Case is ignored, because Windows paths ignore it. */
export function matchingFolders(paths: string[], prefix: string): string[] {
  const want = prefix.toLowerCase();
  return paths.filter((p) => p.slice(nameStart(p)).toLowerCase().startsWith(want));
}
