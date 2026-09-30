import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import vm from 'node:vm';

const item = (title, source, id, published = 'Sun, 27 Sep 2026 12:00:00 GMT') => ({ title, source, id, published });
const credit = item('Ornstein reveals Manchester United transfer plan', 'Football365', 'credit');
const legacy = (entry, reporter = 'David Ornstein') => ({
  id: `${reporter}:${entry.id}`, reporter, reporterZh: '旧姓名', reporterOutlet: '旧媒体',
  tier: 1, title: entry.title, source: entry.source, url: `https://example.com/${entry.id}`,
  published: '2026-09-27T12:00:00.000Z', titleZh: '缓存译文'
});

// Run the production script unchanged in an isolated directory. Only network
// responses are replaced; its parsing, attribution, caching and writes are real.
async function runFeed(feeds, { previous = [], fail = [], repeat = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'journalist-feed-'));
  try {
    await mkdir(join(root, 'scripts')); await mkdir(join(root, 'data'));
    await cp(new URL('./update-journalists.mjs', import.meta.url), join(root, 'scripts/update-journalists.mjs'));
    await writeFile(join(root, 'data/dashboard.json'), JSON.stringify({ journalists: previous, journalistsUpdatedAt: 'old', sentinel: 'keep' }));
    await writeFile(join(root, 'mock.mjs'), `
const feeds = ${JSON.stringify(feeds)}, fail = ${JSON.stringify(fail)};
const xml = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const item = i => '<item><title>' + xml(i.title + (i.source ? ' - ' + i.source : '')) + '</title>' + (i.source ? '<source>' + xml(i.source) + '</source>' : '') + '<guid>' + i.id + '</guid><link>https://example.com/' + i.id + '</link><pubDate>' + i.published + '</pubDate></item>';
globalThis.fetch = async url => {
  if (url.includes('mymemory')) return { ok: true, json: async () => ({ responseData: { translatedText: '译文' } }) };
  const name = new URL(url).searchParams.get('q').match(/^"([^"]+)"/)[1];
  if (fail.includes('*') || fail.includes(name)) throw new Error('RSS unavailable');
  return { ok: true, text: async () => '<rss>' + (feeds[name] || []).map(item).join('') + '</rss>' };
};
`);
    const result = spawnSync(process.execPath, ['--import', join(root, 'mock.mjs'), join(root, 'scripts/update-journalists.mjs')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(await readFile(join(root, 'data/dashboard.json'), 'utf8'));
    assert.equal(data.sentinel, 'keep', 'Other dashboard data must survive');
    if (repeat) {
      const again = spawnSync(process.execPath, ['--import', join(root, 'mock.mjs'), join(root, 'scripts/update-journalists.mjs')], { encoding: 'utf8' });
      assert.equal(again.status, 0, again.stderr);
      assert.deepEqual(JSON.parse(await readFile(join(root, 'data/dashboard.json'), 'utf8')), data, 'Unchanged feeds must not rewrite data or update timestamps');
    }
    return data;
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('rejects the original LiveScore story and same-outlet name mentions', async () => {
  const data = await runFeed({ 'David Ornstein': [
    item('Man Utd legend David de Gea reacts to Man City FFP guilty verdict', 'LiveScore', 'mention'),
    item('David Ornstein profile: Manchester United fan reaction', 'The New York Times', 'profile'),
    item('Manchester United transfer update', 'The Athletic', 'no-credit')
  ] });
  assert.deepEqual(data.journalists, []);
});

test('keeps explicit reporting credits as headline references, not verified authorship', async () => {
  const data = await runFeed({ 'David Ornstein': [credit], 'Fabrizio Romano': [
    item('Man Utd target: Romano confirms talks', 'Football365', 'romano'),
    item('Fabrizio Romano at Manchester United event', 'LiveScore', 'romano-mention')
  ] });
  assert.equal(data.journalists.length, 2);
  for (const entry of data.journalists) {
    assert.equal(entry.attributionType, 'headline-credit');
    assert.ok(entry.reporterCredits.length);
  }
});

test('filters before limiting each RSS feed to four entries', async () => {
  const entries = Array.from({ length: 5 }, (_, i) => item('Manchester United news', 'The Athletic', `reject-${i}`));
  entries.push(...Array.from({ length: 5 }, (_, i) => item(`According to David Ornstein, Manchester United update ${i}`, 'Football365', `keep-${i}`)));
  const data = await runFeed({ 'David Ornstein': entries });
  assert.deepEqual(data.journalists.map(i => i.url).sort(), [0, 1, 2, 3].map(i => `https://example.com/keep-${i}`));
});

test('deduplicates shared URLs without replacing a credited reporter with the search name', async () => {
  const shared = item('Ornstein reveals Manchester United transfer plan', 'The New York Times', 'shared');
  const data = await runFeed({ 'David Ornstein': [shared], 'Laurie Whitwell': [shared], 'Carl Anka': [shared] });
  assert.equal(data.journalists.length, 1);
  assert.equal(data.journalists[0].reporter, 'David Ornstein');
  assert.deepEqual(data.journalists[0].reporterCredits.map(i => i.name), ['David Ornstein']);
});

test('preserves both explicitly credited reporters in a shared headline', async () => {
  const shared = item('David Ornstein reports Manchester United news; Laurie Whitwell confirms the update', 'The Athletic', 'joint');
  const data = await runFeed({ 'David Ornstein': [shared], 'Laurie Whitwell': [shared] });
  assert.equal(data.journalists.length, 1);
  assert.ok(data.journalists[0].reporterCredits, 'Missing explicit credit metadata');
  assert.deepEqual(data.journalists[0].reporterCredits.map(i => i.name), ['David Ornstein', 'Laurie Whitwell']);
  assert.equal(data.journalists[0].reporter, 'David Ornstein / Laurie Whitwell');
});

test('recognizes joint reporting credits with one shared verb or attribution phrase', async () => {
  for (const title of ['David Ornstein and Laurie Whitwell report Manchester United news', 'According to David Ornstein and Laurie Whitwell, Manchester United plan talks']) {
    const data = await runFeed({ 'David Ornstein': [item(title, 'The Athletic', 'joint-phrase')] });
    assert.deepEqual(data.journalists[0].reporterCredits.map(i => i.name), ['David Ornstein', 'Laurie Whitwell']);
  }
});

test('unchanged repeated runs preserve the data and list timestamp', async () => {
  await runFeed({ 'David Ornstein': [credit] }, { repeat: true });
});

test('clears legacy misattribution when successful searches yield no eligible items', async () => {
  const data = await runFeed({}, { previous: [legacy(item('Uncredited Manchester United news', 'The Athletic', 'old-bad'))] });
  assert.deepEqual(data.journalists, []);
});

test('all RSS failures retain only revalidated credits and their cached translation', async () => {
  const data = await runFeed({}, { fail: ['*'], previous: [legacy(credit), legacy(item('Manchester United news', 'LiveScore', 'bad'))] });
  assert.equal(data.journalists.length, 1);
  assert.equal(data.journalists[0].url, 'https://example.com/credit');
  assert.equal(data.journalists[0].attributionType, 'headline-credit');
  assert.equal(data.journalists[0].titleZh, '缓存译文');
});

test('partial RSS failures retain revalidated cache only for failed reporter searches', async () => {
  const data = await runFeed({}, { fail: ['David Ornstein'], previous: [
    legacy(credit), legacy(item('Romano confirms Manchester United news', 'Football365', 'old-romano'), 'Fabrizio Romano')
  ] });
  assert.deepEqual(data.journalists.map(i => i.url), ['https://example.com/credit']);
});

test('persists source and attribution corrections even when title and URL are unchanged', async () => {
  const old = legacy(credit); old.source = 'Old publisher';
  const data = await runFeed({ 'David Ornstein': [credit] }, { previous: [old] });
  assert.equal(data.journalists[0].source, 'Football365');
  assert.equal(data.journalists[0].attributionType, 'headline-credit');
  assert.notEqual(data.journalistsUpdatedAt, 'old');
});

test('ignores invalid publication dates without discarding other valid items', async () => {
  const data = await runFeed({ 'David Ornstein': [item(credit.title, credit.source, 'bad-date', 'not-a-date'), credit] });
  assert.deepEqual(data.journalists.map(i => i.url), ['https://example.com/credit']);
});

test('does not invent a publishing source when RSS source metadata is missing', async () => {
  const data = await runFeed({ 'David Ornstein': [item(credit.title, '', 'no-source')] });
  assert.equal(data.journalists[0].source, '来源未标注');
});

test('front end labels references and unverified legacy matches without implying authorship', async () => {
  const app = (await readFile(new URL('../app.js', import.meta.url), 'utf8')).replace(/\ninit\(\);\s*$/, '');
  const feed = { innerHTML: '' }, updated = { textContent: '' };
  const context = vm.createContext({ Intl, Date, URL, document: { querySelector: selector => selector === '#journalistFeed' ? feed : updated } });
  vm.runInContext(app, context);
  context.entries = [
    { ...legacy(credit), attributionType: 'headline-credit', reporterCredits: [{ name: 'David Ornstein', nameZh: '大卫·奥恩斯坦' }, { name: 'Laurie Whitwell', nameZh: '劳里·惠特韦尔' }] },
    legacy(item('Legacy headline', 'The Athletic', 'legacy'))
  ];
  vm.runInContext('state.data = { journalists: entries }; renderJournalists();', context);
  assert.ok(feed.innerHTML.includes('标题引用：大卫·奥恩斯坦 / 劳里·惠特韦尔'));
  assert.ok(feed.innerHTML.includes('未核实署名'));
  assert.ok(feed.innerHTML.includes('搜索匹配（未核实归因）'));
});
