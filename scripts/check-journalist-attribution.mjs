import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = await mkdtemp(join(fileURLToPath(new URL('../', import.meta.url)), 'journalist-feed-'));
try {
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'data'));
  await cp(new URL('./update-journalists.mjs', import.meta.url), join(root, 'scripts/update-journalists.mjs'));
  await writeFile(join(root, 'data/dashboard.json'), '{"journalists":[]}');
  await writeFile(join(root, 'mock.mjs'), `
const item = (title, source, id) => '<item><title>' + title + ' - ' + source + '</title><source>' + source + '</source><guid>' + id + '</guid><link>https://example.com/' + id + '</link><pubDate>Sun, 27 Sep 2026 12:00:00 GMT</pubDate></item>';
globalThis.fetch = async url => {
  if (url.includes('mymemory')) return { ok: true, json: async () => ({ responseData: { translatedText: '译文' } }) };
  const name = new URL(url).searchParams.get('q');
  const items = name.includes('David Ornstein') ? [
    item('Man Utd legend David de Gea reacts to Man City FFP guilty verdict', 'LiveScore', 'mention'),
    item('Manchester United transfer update', 'The New York Times', 'original'),
    item('Ornstein reveals Manchester United transfer plan', 'Football365', 'credited'),
    item('David Ornstein profile: Manchester United fan reaction', 'Football365', 'profile'),
    item('Further Manchester United update', 'The Athletic', 'after-four')
  ] : name.includes('Fabrizio Romano') ? [
    item('Man Utd target: Romano confirms talks', 'Football365', 'romano-credit'),
    item('Fabrizio Romano at Manchester United event', 'LiveScore', 'romano-mention')
  ] : [];
  return { ok: true, text: async () => '<rss>' + items.join('') + '</rss>' };
};
`);
  const run = spawnSync(process.execPath, ['--import', join(root, 'mock.mjs'), join(root, 'scripts/update-journalists.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const { journalists } = JSON.parse(await readFile(join(root, 'data/dashboard.json'), 'utf8'));
  assert.deepEqual(journalists.map(({ id }) => id).sort(), [
    'David Ornstein:original', 'David Ornstein:credited', 'David Ornstein:after-four', 'Fabrizio Romano:romano-credit'
  ].sort());
  console.log('Journalist attribution check passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}
