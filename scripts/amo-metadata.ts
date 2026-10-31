// Writes the release notes for `wxt submit --firefox-amo-metadata-file`
// from the CHANGELOG.md section of the current package.json version.
import { version } from '../package.json';

const changelog = await Bun.file('CHANGELOG.md').text();
const section = changelog.split(/^## /m).find((s) => s.startsWith(`${version} `));
if (!section) throw new Error(`CHANGELOG.md has no section for ${version}`);

let notes = section
  .slice(section.indexOf('\n'))
  .replace(/^### (.*)$/gm, '$1:')
  .trim();
// AMO refuses release notes over 3000 characters. Then each item keeps only its first sentence.
if (notes.length > 3000) notes = notes.replace(/^(- .*?\.) .*$/gm, '$1');
if (notes.length > 3000) throw new Error(`Release notes are ${notes.length} characters, and AMO allows 3000`);

await Bun.write('.output/amo-metadata.json', JSON.stringify({ version: { release_notes: { 'en-US': notes } } }));
