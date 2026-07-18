import { readFile, writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../data/dashboard.json', import.meta.url);
const REPORTERS = [
  { name: 'Fabrizio Romano', nameZh: '法布里齐奥·罗马诺', outlet: '国际转会记者', tier: 1 },
  { name: 'David Ornstein', nameZh: '大卫·奥恩斯坦', outlet: 'The Athletic', tier: 1 },
  { name: 'Laurie Whitwell', nameZh: '劳里·惠特韦尔', outlet: 'The Athletic 曼联跟队', tier: 1 },
  { name: 'Simon Stone', nameZh: '西蒙·斯通', outlet: 'BBC 体育', tier: 1 },
  { name: 'James Ducker', nameZh: '詹姆斯·达克', outlet: '每日电讯报', tier: 1 },
  { name: 'Rob Dawson', nameZh: '罗布·道森', outlet: 'ESPN 曼联跟队', tier: 1 },
  { name: 'Carl Anka', nameZh: '卡尔·安卡', outlet: 'The Athletic', tier: 2 },
  { name: 'Andy Mitten', nameZh: '安迪·米滕', outlet: '曼联资深记者', tier: 2 },
  { name: 'Chris Wheeler', nameZh: '克里斯·惠勒', outlet: '每日邮报曼联跟队', tier: 2 },
  { name: 'Samuel Luckhurst', nameZh: '塞缪尔·勒克赫斯特', outlet: '曼彻斯特晚报', tier: 2 }
];

const decodeXml = value => String(value || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function tag(block, name) {
  return decodeXml(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '').trim();
}

async function fetchReporter(reporter) {
  const query = `"${reporter.name}" "Manchester United" when:7d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`;
  const response = await fetch(url, { headers: { 'user-agent': 'United-26-27-dashboard/1.0' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${response.status} ${reporter.name}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 4).map(([, block]) => {
    const rawTitle = tag(block, 'title');
    const source = tag(block, 'source') || rawTitle.split(' - ').at(-1) || reporter.outlet;
    const title = rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)) : rawTitle;
    return {
      id: `${reporter.name}:${tag(block, 'guid') || tag(block, 'link') || title}`,
      reporter: reporter.name, reporterZh: reporter.nameZh, reporterOutlet: reporter.outlet,
      source, tier: reporter.tier, title, url: tag(block, 'link'), published: new Date(tag(block, 'pubDate')).toISOString()
    };
  }).filter(item => item.title && item.url && Number.isFinite(new Date(item.published).getTime()));
}

async function translate(title) {
  if (!title || /[\u3400-\u9fff]/.test(title)) return title;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(title)}&langpair=en|zh-CN`;
    const response = await fetch(url, { headers: { 'user-agent': 'United-26-27-dashboard/1.0' }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return title;
    const payload = await response.json();
    return payload?.responseData?.translatedText || title;
  } catch {
    return title;
  }
}

const data = JSON.parse(await readFile(OUTPUT, 'utf8'));
const previous = data.journalists || [];
const results = await Promise.allSettled(REPORTERS.map(fetchReporter));
const fetched = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
const unique = [...new Map(fetched.map(item => [item.url, item])).values()]
  .sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 24);

const journalists = await Promise.all(unique.map(async item => {
  const cached = previous.find(old => old.url === item.url || (old.reporter === item.reporter && old.title === item.title));
  return { ...item, titleZh: cached?.titleZh || await translate(item.title) };
}));

if (!journalists.length) {
  console.log('No reporter updates fetched; keeping existing data.');
  process.exit(0);
}

const signature = items => JSON.stringify(items.map(({ reporter, title, url, published }) => ({ reporter, title, url, published })));
if (signature(journalists) === signature(previous)) {
  console.log(`Reporter feed unchanged: ${journalists.length} items.`);
  process.exit(0);
}

data.journalists = journalists;
data.journalistsUpdatedAt = new Date().toISOString();
await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated reporter feed: ${journalists.length} items from ${new Set(journalists.map(item => item.reporter)).size} reporters.`);
