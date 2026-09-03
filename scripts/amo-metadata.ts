// Writes the release notes for `wxt submit --firefox-amo-metadata-file`
// from the CHANGELOG.md section of the current package.json version.
import { version } from '../package.json';

const changelog = await Bun.file('CHANGELOG.md').text();
const section = changelog.split(/^## /m).find((s) => s.startsWith(`${version} `));
if (!section) throw new Error(`CHANGELOG.md has no section for ${version}`);

const notes = section
  .slice(section.indexOf('\n'))
  .replace(/^### (.*)$/gm, '$1:')
  .trim();

await Bun.write('.output/amo-metadata.json', JSON.stringify({ version: { release_notes: { 'en-US': notes } } }));
