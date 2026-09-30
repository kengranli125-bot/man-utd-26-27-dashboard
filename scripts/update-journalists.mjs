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

function reporterNamePattern(reporter) {
  const surname = reporter.name.split(' ').at(-1);
  return ['Romano', 'Ornstein'].includes(surname) ? `(?:${reporter.name}|${surname})` : reporter.name;
}

function headlineCreditsReporter(reporter, title) {
  // These patterns establish only a headline reference, never article authorship.
  const name = reporterNamePattern(reporter);
  const knownName = `(?:${REPORTERS.map(reporterNamePattern).join('|')})`;
  const separator = '(?:,\\s*(?:and\\s+)?|\\s+(?:and|&)\\s+)';
  const followingNames = `(?:${separator}${knownName})*`;
  const precedingNames = `(?:${knownName}${separator})*`;
  return new RegExp(`\\b${name}\\b${followingNames}(?:['’]s)?\\s+(?:reports?|reveals?|confirms?|claims?|says|writes?|understands?)\\b|\\b(?:according to|per|reported by)\\s+${precedingNames}${name}\\b`, 'i').test(title);
}

function attributeArticle(item) {
  if (!item?.title || !item.url || !Number.isFinite(new Date(item.published).getTime())) return null;
  // Derive every credited name from the headline, not from the search query,
  // publishing outlet, or legacy reporter fields. Reuse for cached entries too.
  const credits = REPORTERS.filter(reporter => headlineCreditsReporter(reporter, item.title));
  if (!credits.length) return null;
  return {
    id: `headline:${item.url}`,
    reporter: credits.map(reporter => reporter.name).join(' / '),
    reporterZh: credits.map(reporter => reporter.nameZh).join(' / '),
    reporterOutlet: [...new Set(credits.map(reporter => reporter.outlet))].join(' / '),
    reporterCredits: credits.map(({ name, nameZh, outlet, tier }) => ({ name, nameZh, outlet, tier })),
    attributionType: 'headline-credit', source: item.source || '来源未标注',
    tier: Math.max(...credits.map(reporter => reporter.tier)),
    title: item.title, url: item.url, published: new Date(item.published).toISOString(),
    ...(item.titleZh ? { titleZh: item.titleZh } : {})
  };
}

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
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, block]) => {
    const rawTitle = tag(block, 'title');
    const source = tag(block, 'source') || (rawTitle.includes(' - ') ? rawTitle.split(' - ').at(-1) : '') || '来源未标注';
    const title = rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)) : rawTitle;
    return attributeArticle({ title, source, url: tag(block, 'link'), published: tag(block, 'pubDate') });
  }).filter(Boolean).slice(0, 4);
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
const failed = new Set(REPORTERS.filter((_, index) => results[index].status === 'rejected').map(reporter => reporter.name));
const retained = previous.map(attributeArticle).filter(item => item && item.reporterCredits.some(reporter => failed.has(reporter.name)));
const byUrl = new Map();
// Fresh records take precedence over revalidated fallback records. A duplicate
// query never overwrites identity, which is already derived from all credits.
for (const entries of [fetched, retained]) {
  entries.sort((a, b) => new Date(b.published) - new Date(a.published) || a.title.localeCompare(b.title) || a.source.localeCompare(b.source));
  for (const item of entries) if (!byUrl.has(item.url)) byUrl.set(item.url, item);
}
const unique = [...byUrl.values()]
  .sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 24);

const journalists = await Promise.all(unique.map(async item => {
  const cached = previous.find(old => old.title === item.title && (old.url === item.url || old.reporter === item.reporter));
  return { ...item, titleZh: cached?.titleZh || await translate(item.title) };
}));

// Metadata and attribution corrections must persist even if the headline,
// reporter name, URL and publication date have not changed.
const signature = items => JSON.stringify(items);
if (signature(journalists) === signature(previous)) {
  console.log(`Reporter feed unchanged: ${journalists.length} items.`);
  process.exit(0);
}

data.journalists = journalists;
data.journalistsUpdatedAt = new Date().toISOString();
await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated reporter feed: ${journalists.length} items from ${new Set(journalists.map(item => item.reporter)).size} reporters.`);
