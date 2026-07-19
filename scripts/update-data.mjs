import { readFile, writeFile } from 'node:fs/promises';
import { applyMatchDetails, matchSummaryUrl } from './match-details.mjs';

const OUTPUT = new URL('../data/dashboard.json', import.meta.url);
const TEAM_ID = '360';
const SEASON = '2026';
const base = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1';
const COMPETITIONS = [
  { key: 'eng.1', name: '英超', group: 'league' },
  { key: 'uefa.champions', name: '欧冠', group: 'europe' },
  { key: 'eng.fa', name: '足总杯', group: 'cup' },
  { key: 'eng.league_cup', name: '联赛杯', group: 'cup' },
  { key: 'club.friendly', name: '季前赛', group: 'friendly' }
];
const endpoints = {
  standings: `${base}/standings?season=${SEASON}`,
  championsStandings: 'https://site.api.espn.com/apis/v2/sports/soccer/uefa.champions/standings?season=2026',
  news: `${base}/news?team=${TEAM_ID}&limit=12`,
  roster: `${base}/teams/${TEAM_ID}/roster?season=${SEASON}`,
  playerStats: `${base}/teams/${TEAM_ID}/statistics?season=${SEASON}`
};

async function get(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'united-26-27-dashboard/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

const logo = id => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;
const TEAM_NAMES_ZH = {
  'Manchester United':'曼联', 'Manchester City':'曼城', Arsenal:'阿森纳', Chelsea:'切尔西', Liverpool:'利物浦',
  'Tottenham Hotspur':'托特纳姆热刺', 'Newcastle United':'纽卡斯尔联', 'Aston Villa':'阿斯顿维拉', Everton:'埃弗顿',
  Fulham:'富勒姆', 'Crystal Palace':'水晶宫', 'Nottingham Forest':'诺丁汉森林', Brentford:'布伦特福德',
  'Brighton & Hove Albion':'布莱顿', 'AFC Bournemouth':'伯恩茅斯', 'Leeds United':'利兹联', Sunderland:'桑德兰',
  'Hull City':'赫尔城', 'Ipswich Town':'伊普斯维奇', 'Coventry City':'考文垂', Wrexham:'雷克瑟姆',
  Rosenborg:'罗森博格', 'Atlético Madrid':'马德里竞技', 'Paris Saint-Germain':'巴黎圣日耳曼', 'AC Milan':'AC米兰'
};
const PLAYER_NAMES_ZH = {
  'Marcus Rashford':['马库斯·拉什福德','拉什福德'], 'Ethan Wheatley':['伊桑·惠特利','惠特利'], 'Enzo Kana-Biyik':['恩佐·卡纳-比伊克','卡纳-比伊克'],
  'André Onana':['安德烈·奥纳纳','奥纳纳'], 'Altay Bayindir':['阿尔泰·巴因德尔','巴因德尔'], 'Senne Lammens':['森内·拉门斯','拉门斯'],
  'Harry Maguire':['哈里·马奎尔','马奎尔'], 'Luke Shaw':['卢克·肖','卢克·肖'], 'Lisandro Martínez':['利桑德罗·马丁内斯','利马'],
  'Diogo Dalot':['迪奥戈·达洛特','达洛特'], 'Matthijs de Ligt':['马泰斯·德利赫特','德利赫特'], 'Noussair Mazraoui':['努赛尔·马兹拉维','马兹拉维'],
  'Leny Yoro':['莱尼·约罗','约罗'], 'Tyler Fredricson':['泰勒·弗雷德里克森','弗雷德里克森'], 'Ayden Heaven':['艾登·赫文','赫文'],
  'Harry Amass':['哈里·阿马斯','阿马斯'], 'Patrick Dorgu':['帕特里克·多尔古','多尔古'], 'Diego León':['迭戈·莱昂','莱昂'],
  'Bruno Fernandes':['布鲁诺·费尔南德斯','B费'], 'Jack Fletcher':['杰克·弗莱彻','杰克·弗莱彻'], 'Mason Mount':['梅森·芒特','芒特'],
  'Manuel Ugarte':['曼努埃尔·乌加特','乌加特'], 'Amad Diallo':['阿马德·迪亚洛','阿马德'], 'Toby Collyer':['托比·科利尔','科利尔'],
  'Kobbie Mainoo':['科比·梅努','梅努'], 'Tyler Fletcher':['泰勒·弗莱彻','泰勒·弗莱彻'], 'Matheus Cunha':['马特乌斯·库尼亚','库尼亚'],
  'Bryan Mbeumo':['布莱恩·姆伯莫','姆伯莫'], 'Joshua Zirkzee':['约书亚·齐尔克泽','齐尔克泽'], 'Benjamin Sesko':['本杰明·谢什科','谢什科'],
  'Chido Obi':['奇多·奥比','奥比'], 'Youri Tielemans':['尤里·蒂勒曼斯','蒂勒曼斯'],
  'Andrey Santos':['安德烈·桑托斯','桑托斯'], 'Karl Darlow':['卡尔·达洛','达洛']
};
const FOTMOB_IDS = {
  'André Onana':'611491', 'Altay Bayindir':'866967', 'Senne Lammens':'1178602', 'Diogo Dalot':'751550',
  'Matthijs de Ligt':'769895', 'Harry Maguire':'255610', 'Lisandro Martínez':'847983', 'Leny Yoro':'1358581',
  'Luke Shaw':'362694', 'Ayden Heaven':'1559639', 'Tyler Fredricson':'1403351', 'Noussair Mazraoui':'775539',
  'Patrick Dorgu':'1526560', 'Toby Collyer':'1421810', 'Manuel Ugarte':'1035614', 'Kobbie Mainoo':'1292810',
  'Harry Amass':'1430832', 'Mason Mount':'750032', 'Bruno Fernandes':'422685', 'Bryan Mbeumo':'923312',
  'Amad Diallo':'1070052', 'Marcus Rashford':'696365', 'Enzo Kana-Biyik':'1714514', 'Ethan Wheatley':'1398915',
  'Matheus Cunha':'863098', 'Joshua Zirkzee':'950830', 'Benjamin Sesko':'1073977', 'Chido Obi':'1557220',
  'Youri Tielemans':'465960', 'Andrey Santos':'1372921', 'Karl Darlow':'163604'
};
const NATIONALITY_ZH = {
  England:'英格兰', Belgium:'比利时', Cameroon:'喀麦隆', Türkiye:'土耳其', Turkey:'土耳其', Argentina:'阿根廷',
  Portugal:'葡萄牙', Netherlands:'荷兰', Morocco:'摩洛哥', France:'法国', Denmark:'丹麦', Uruguay:'乌拉圭',
  Brazil:'巴西', Slovenia:'斯洛文尼亚', 'Ivory Coast':'科特迪瓦', Wales:'威尔士', Paraguay:'巴拉圭',
  Spain:'西班牙', 'Northern Ireland':'北爱尔兰'
};
const SUPPLEMENTAL_PLAYERS = [
  { id:'fotmob-465960', name:'Youri Tielemans', jersey:'', position:'Midfielder', age:29, nationality:'Belgium', countryCode:'bel', statusType:'watch', statusLabel:'伤情观察', availabilityScore:68 },
  { id:'fotmob-1372921', name:'Andrey Santos', jersey:'', position:'Midfielder', age:22, nationality:'Brazil', countryCode:'bra', statusType:'available', statusLabel:'新援可用', availabilityScore:88 },
  { id:'fotmob-163604', name:'Karl Darlow', jersey:'', position:'Goalkeeper', age:35, nationality:'Wales', countryCode:'wal', statusType:'available', statusLabel:'新援可用', availabilityScore:88 }
];
function parseFixtures(payload, competition) {
  return (payload.events || []).filter(event => event.competitions?.[0]?.competitors?.some(item => String(item.team?.id) === TEAM_ID)).map(event => {
    const comp = event.competitions?.[0] || {};
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    if (!home || !away) return null;
    const status = comp.status?.type?.completed ? 'completed' : 'upcoming';
    const team = c => { const name = c.team?.displayName || c.team?.name || '待定'; return { id: String(c.team?.id || ''), name, nameZh: TEAM_NAMES_ZH[name] || name, logo: c.team?.logo || logo(c.team?.id), score: status === 'completed' ? Number(c.score?.value ?? c.score ?? 0) : null }; };
    return { id: event.id, date: event.date, status, venue: comp.venue?.fullName || '', competition: competition.name, competitionKey: competition.key, competitionGroup: competition.group, home: team(home), away: team(away) };
  }).filter(Boolean).sort((a,b) => new Date(a.date) - new Date(b.date));
}

function statValue(stats, name) { const item = stats?.find(s => s.name === name || s.abbreviation === name); return Number(item?.value ?? item?.displayValue ?? 0); }
function parseStandings(payload) {
  const entries = payload.children?.flatMap(child => child.standings?.entries || []) || payload.standings?.entries || [];
  return entries.map(entry => ({
    id: String(entry.team?.id || ''), name: entry.team?.displayName || entry.team?.name || '', nameZh: TEAM_NAMES_ZH[entry.team?.displayName || entry.team?.name] || entry.team?.displayName || entry.team?.name || '', logo: entry.team?.logos?.[0]?.href || logo(entry.team?.id),
    position: statValue(entry.stats, 'rank'), played: statValue(entry.stats, 'gamesPlayed'), wins: statValue(entry.stats, 'wins'), draws: statValue(entry.stats, 'ties'), losses: statValue(entry.stats, 'losses'), goalDifference: statValue(entry.stats, 'pointDifferential'), points: statValue(entry.stats, 'points')
  })).filter(t => t.name).sort((a,b) => a.position - b.position);
}

function parseScorers(payload) {
  const candidates = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const athlete = node.athlete || node.player;
    const stats = node.stats || node.statistics;
    if (athlete && stats) candidates.push({ athlete, stats });
    Object.values(node).forEach(visit);
  };
  visit(payload.results || payload);
  const get = (stats, names) => {
    if (Array.isArray(stats)) { const item = stats.find(stat => names.includes(stat.name) || names.includes(stat.abbreviation)); return Number(item?.value ?? item?.displayValue ?? 0); }
    for (const name of names) if (stats?.[name] != null) return Number(stats[name]?.value ?? stats[name] ?? 0);
    return 0;
  };
  const byId = new Map();
  for (const { athlete, stats } of candidates) {
    const id = String(athlete.id || athlete.uid || athlete.displayName || athlete.name);
    const name = athlete.displayName || athlete.fullName || athlete.name || '';
    const row = { id, name, nameZh:PLAYER_NAMES_ZH[name]?.[0] || name, headshot:FOTMOB_IDS[name] ? `https://images.fotmob.com/image_resources/playerimages/${FOTMOB_IDS[name]}.png` : athlete.headshot?.href || '',
      goals:get(stats,['totalGoals','goals','G']), assists:get(stats,['goalAssists','assists','A']), appearances:get(stats,['appearances','gamesPlayed','APP']) };
    if (name && (row.goals || row.assists || row.appearances)) byId.set(id,row);
  }
  return [...byId.values()].sort((a,b) => b.goals-a.goals || b.assists-a.assists || a.appearances-b.appearances).slice(0,10);
}

async function attachMatchDetails(fixtures, previousFixtures = []) {
  const previousById = new Map(previousFixtures.map(fixture => [fixture.id, fixture]));
  return Promise.all(fixtures.map(async fixture => {
    const previous = previousById.get(fixture.id);
    const matchAgeHours = (Date.now() - new Date(fixture.date)) / 3_600_000;
    if (previous?.recap && matchAgeHours > 72) return { ...fixture, recap:previous.recap, lineups:previous.lineups || previous.recap.lineups || [] };
    if (matchAgeHours < -36 || matchAgeHours > 72) return { ...fixture, lineups:previous?.lineups || [] };
    try {
      const payload = await get(matchSummaryUrl(fixture));
      return applyMatchDetails(fixture, payload, PLAYER_NAMES_ZH);
    } catch {
      return { ...fixture, lineups:previous?.lineups || [], ...(previous?.recap ? { recap:previous.recap } : {}) };
    }
  }));
}

async function translateTitle(title) {
  if (!title || /[\u3400-\u9fff]/.test(title)) return title;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(title)}&langpair=en|zh-CN`;
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'united-26-27-dashboard/1.0' } });
    if (!response.ok) {
      console.warn(`Translation failed (${response.status}): ${title}`);
      return title;
    }
    const payload = await response.json();
    return payload?.responseData?.translatedText || title;
  } catch (error) {
    console.warn(`Translation unavailable: ${error.message}`);
    return title;
  }
}

async function parseNews(payload, existing = []) {
  const articles = (payload.articles || []).map(article => ({ title: article.headline, published: article.published, url: article.links?.web?.href || '', image: article.images?.[0]?.url || '' })).filter(a => a.title);
  return Promise.all(articles.map(async article => {
    const cached = existing.find(item => item.url && item.url === article.url && /[\u3400-\u9fff]/.test(item.titleZh || ''));
    return { ...article, titleZh: cached?.titleZh || await translateTitle(article.title) };
  }));
}

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function parseRoster(payload, articles = []) {
  const newsText = normalize(articles.map(article => article.title || article.headline).join(' '));
  const negativeNews = /(surgery|injur(?:y|ed)|ruled out|operation|setback)/;
  const order = { Goalkeeper: 0, Defender: 1, Midfielder: 2, Forward: 3 };
  const roster = (payload.athletes || []).map(athlete => {
    const surname = normalize(athlete.lastName);
    const newsWindow = surname ? newsText.slice(Math.max(0, newsText.indexOf(surname) - 80), newsText.indexOf(surname) + surname.length + 100) : '';
    const newsConcern = surname && newsText.includes(surname) && negativeNews.test(newsWindow);
    const hasInjury = (athlete.injuries || []).length > 0;
    const inactive = athlete.status?.type && athlete.status.type !== 'active';
    const statusType = inactive || hasInjury || newsConcern ? 'out' : 'available';
    const namesZh = PLAYER_NAMES_ZH[athlete.displayName] || [athlete.displayName, athlete.lastName || athlete.displayName];
    return {
      id: String(athlete.id), name: athlete.displayName, nameZh: namesZh[0], shortName: athlete.shortName || athlete.lastName, shortNameZh: namesZh[1],
      jersey: athlete.jersey || '', position: athlete.position?.name || 'Unknown', age: athlete.age || null,
      nationality: athlete.citizenship || '', nationalityZh: NATIONALITY_ZH[athlete.citizenship] || athlete.citizenship || '待确认', flag: athlete.flag?.href || '',
      headshot: FOTMOB_IDS[athlete.displayName] ? `https://images.fotmob.com/image_resources/playerimages/${FOTMOB_IDS[athlete.displayName]}.png` : (athlete.headshot?.href || ''), statusType, statusLabel: statusType === 'out' ? '伤缺/观察' : '可用',
      availabilityScore: statusType === 'out' ? 38 : 90
    };
  }).filter(player => player.name && order[player.position] !== undefined);
  for (const addition of SUPPLEMENTAL_PLAYERS) {
    const surname = normalize(addition.name.split(' ').at(-1));
    const index = newsText.indexOf(surname);
    const context = index >= 0 ? newsText.slice(Math.max(0,index-100), index+surname.length+120) : '';
    if (index >= 0 && /(sign|announce|complete)/.test(context) && !roster.some(player => normalize(player.name) === normalize(addition.name))) {
      const namesZh = PLAYER_NAMES_ZH[addition.name];
      roster.push({ ...addition, nameZh:namesZh[0], shortName:addition.name.split(' ').at(-1), shortNameZh:namesZh[1],
        nationalityZh:NATIONALITY_ZH[addition.nationality], flag:`https://a.espncdn.com/i/teamlogos/countries/500/${addition.countryCode}.png`,
        headshot:`https://images.fotmob.com/image_resources/playerimages/${FOTMOB_IDS[addition.name]}.png`, source:'confirmed-transfer' });
    }
  }
  return roster.sort((a,b) => order[a.position] - order[b.position] || Number(a.jersey || 999) - Number(b.jersey || 999));
}

function buildTransfers(news) {
  const candidates = news.filter(article => /(man united|manchester united)/i.test(article.title) && /(sign|transfer|talks|deal|loan)/i.test(article.title) && !/^(why|would)|inside /i.test(article.title));
  const completedNames = new Set(candidates.filter(article => /(sign|announce|complete)/i.test(article.title) && !/(sources|talks)/i.test(article.title)).flatMap(article => SUPPLEMENTAL_PLAYERS.filter(player => normalize(article.title).includes(normalize(player.name.split(' ').at(-1)))).map(player => player.name)));
  const seen = new Set();
  return candidates.map(article => {
    const player = SUPPLEMENTAL_PLAYERS.find(item => normalize(article.title).includes(normalize(item.name.split(' ').at(-1))));
    const completed = /(sign|announce|complete)/i.test(article.title) && !/(sources|talks)/i.test(article.title);
    const loan = /loan/i.test(article.title);
    return { ...article, player: player ? PLAYER_NAMES_ZH[player.name][0] : '', status: completed ? '已完成' : loan ? '租借' : '推进中', statusType: completed ? 'done' : loan ? 'loan' : 'progress', key: player?.name || article.url };
  }).filter(item => !(item.statusType === 'progress' && completedNames.has(SUPPLEMENTAL_PLAYERS.find(player => player.nameZh === item.player)?.name)))
    .filter(item => !seen.has(item.key) && seen.add(item.key)).slice(0,6).map(({ key, ...item }) => item);
}

function buildLineup(roster, config) {
  const used = new Set();
  const players = config.slots.map(slot => {
    const preferred = slot.names.map(name => roster.find(player => player.name === name && player.statusType !== 'out' && !used.has(player.id))).find(Boolean);
    const fallback = roster.find(player => player.position === slot.position && player.statusType !== 'out' && !used.has(player.id));
    const player = preferred || fallback;
    if (!player) return null;
    used.add(player.id);
    return { ...player, line: slot.line, role: slot.role };
  }).filter(Boolean);
  const avgAvailability = players.length ? Math.round(players.reduce((sum, player) => sum + player.availabilityScore, 0) / players.length) : 0;
  const avgAge = players.length ? players.reduce((sum, player) => sum + (player.age || 24), 0) / players.length : 24;
  const experience = Math.max(65, Math.min(92, Math.round(68 + (avgAge - 22) * 3)));
  return { formation: '4-2-3-1', title: config.title, summary: config.summary, players, metrics: [
    { label: '完整度', value: avgAvailability }, { label: '经验值', value: experience }, { label: '攻守平衡', value: config.balance }
  ] };
}

function buildPredictions(roster, fixtures = []) {
  const baseSlots = {
    goalkeeper: { line: 'GK', position: 'Goalkeeper', role: '门将' },
    rightBack: { line: 'D', position: 'Defender', role: '右后卫' }, centerBack: { line: 'D', position: 'Defender', role: '中后卫' },
    leftBack: { line: 'D', position: 'Defender', role: '左后卫' }, midfield: { line: 'DM', position: 'Midfielder', role: '中场' },
    rightWing: { line: 'AM', position: 'Midfielder', role: '右翼' }, ten: { line: 'AM', position: 'Midfielder', role: '前腰' },
    leftWing: { line: 'AM', position: 'Forward', role: '左翼' }, striker: { line: 'F', position: 'Forward', role: '中锋' }
  };
  const slot = (baseSlot, names, role) => ({ ...baseSlot, names, ...(role ? { role } : {}) });
  const nextFriendly = fixtures.find(fixture => fixture.competitionGroup === 'friendly' && fixture.status === 'upcoming') || fixtures.find(fixture => fixture.competitionGroup === 'friendly');
  const friendlyOpponent = nextFriendly ? (nextFriendly.home.id === TEAM_ID ? nextFriendly.away : nextFriendly.home) : null;
  return {
    league: buildLineup(roster, { title: '英超预测首发', balance: 85, summary: '强调联赛连续性和前场压迫，边路保持速度，中场优先选择当前可用球员。', slots: [
      slot(baseSlots.striker, ['Benjamin Sesko','Joshua Zirkzee']),
      slot(baseSlots.leftWing, ['Matheus Cunha','Marcus Rashford']), slot(baseSlots.ten, ['Bruno Fernandes']), slot(baseSlots.rightWing, ['Bryan Mbeumo','Amad Diallo','Mason Mount']),
      slot(baseSlots.midfield, ['Kobbie Mainoo']), slot(baseSlots.midfield, ['Manuel Ugarte','Mason Mount']),
      slot(baseSlots.leftBack, ['Patrick Dorgu','Luke Shaw']), slot(baseSlots.centerBack, ['Lisandro Martínez']), slot(baseSlots.centerBack, ['Matthijs de Ligt','Leny Yoro']), slot(baseSlots.rightBack, ['Diogo Dalot','Noussair Mazraoui']),
      slot(baseSlots.goalkeeper, ['Senne Lammens','André Onana','Altay Bayindir'])
    ]}),
    champions: buildLineup(roster, { title: '欧冠预测首发', balance: 88, summary: '更重视转换防守与后场速度，使用机动性更强的右路组合，应对高强度淘汰赛节奏。', slots: [
      slot(baseSlots.striker, ['Benjamin Sesko','Joshua Zirkzee']),
      slot(baseSlots.leftWing, ['Matheus Cunha']), slot(baseSlots.ten, ['Bruno Fernandes']), slot(baseSlots.rightWing, ['Amad Diallo','Bryan Mbeumo','Mason Mount']),
      slot(baseSlots.midfield, ['Kobbie Mainoo']), slot(baseSlots.midfield, ['Manuel Ugarte','Mason Mount']),
      slot(baseSlots.leftBack, ['Patrick Dorgu','Luke Shaw']), slot(baseSlots.centerBack, ['Lisandro Martínez']), slot(baseSlots.centerBack, ['Leny Yoro','Matthijs de Ligt']), slot(baseSlots.rightBack, ['Noussair Mazraoui','Diogo Dalot']),
      slot(baseSlots.goalkeeper, ['Senne Lammens','André Onana','Altay Bayindir'])
    ]}),
    preseason: buildLineup(roster, { title: friendlyOpponent ? `季前赛预测首发 · 对${friendlyOpponent.nameZh || friendlyOpponent.name}` : '季前赛预测首发', balance: 81, summary: '以考察新援和年轻球员为主，同时保留部分一线队骨干维持阵型结构与比赛节奏。', slots: [
      slot(baseSlots.striker, ['Chido Obi','Benjamin Sesko','Joshua Zirkzee']),
      slot(baseSlots.leftWing, ['Matheus Cunha','Marcus Rashford']), slot(baseSlots.ten, ['Mason Mount','Bruno Fernandes']), slot(baseSlots.rightWing, ['Amad Diallo','Bryan Mbeumo']),
      slot(baseSlots.midfield, ['Andrey Santos','Toby Collyer']), slot(baseSlots.midfield, ['Kobbie Mainoo','Jack Fletcher','Tyler Fletcher']),
      slot(baseSlots.leftBack, ['Harry Amass','Patrick Dorgu']), slot(baseSlots.centerBack, ['Ayden Heaven','Tyler Fredricson']), slot(baseSlots.centerBack, ['Leny Yoro','Matthijs de Ligt']), slot(baseSlots.rightBack, ['Diogo Dalot','Noussair Mazraoui']),
      slot(baseSlots.goalkeeper, ['Karl Darlow','Altay Bayindir','Senne Lammens'])
    ]})
  };
}

const previous = JSON.parse(await readFile(OUTPUT, 'utf8'));
const range = '20260701-20270630';
const competitionResults = await Promise.allSettled(COMPETITIONS.map(competition => get(`https://site.api.espn.com/apis/site/v2/sports/soccer/${competition.key}/scoreboard?dates=${range}&limit=1000`)));
const results = await Promise.allSettled([get(endpoints.standings), get(endpoints.championsStandings), get(endpoints.news), get(endpoints.roster), get(endpoints.playerStats)]);
const nextFixtures = competitionResults.flatMap((result, index) => result.status === 'fulfilled' ? parseFixtures(result.value, COMPETITIONS[index]) : []);
const uniqueFixtures = [...new Map(nextFixtures.map(fixture => [fixture.id, fixture])).values()].sort((a,b) => new Date(a.date) - new Date(b.date));
const fixturesWithRecaps = await attachMatchDetails(uniqueFixtures, previous.fixtures || []);
const nextStandings = results[0].status === 'fulfilled' ? parseStandings(results[0].value) : [];
const nextChampionsStandings = results[1].status === 'fulfilled' ? parseStandings(results[1].value) : [];
const nextNews = results[2].status === 'fulfilled' ? await parseNews(results[2].value, previous.news) : [];
const rawNews = results[2].status === 'fulfilled' ? results[2].value.articles || [] : [];
const nextRoster = results[3].status === 'fulfilled' ? parseRoster(results[3].value, rawNews) : [];
const nextScorers = results[4].status === 'fulfilled' ? parseScorers(results[4].value) : [];
const fixtures = fixturesWithRecaps.length ? fixturesWithRecaps : previous.fixtures;
const standings = nextStandings.length ? nextStandings : previous.standings;
const championsStandings = nextChampionsStandings.length ? nextChampionsStandings : (previous.championsStandings || []);
const news = nextNews.length ? nextNews : previous.news;
const roster = nextRoster.length ? nextRoster : (previous.roster || []);
const transfers = buildTransfers(news);
const scorers = nextScorers.length ? nextScorers : (previous.scorers || []);
const staff = [{
  id: '13044', name: 'Michael Carrick', nameZh: '迈克尔·卡里克', role: '主教练', status: '已确认',
  source: 'ESPN · 2026年6月', headshot: 'https://images.fotmob.com/image_resources/playerimages/34944.png'
}];
const united = standings.find(team => team.id === TEAM_ID);
const data = {
  updatedAt: new Date().toISOString(), season: '2026/27',
  statusMessage: fixtures.length ? `已同步 ${fixtures.length} 场全赛事赛程 · 含季前赛` : '26/27 赛程尚待数据源发布 · 每日自动检查更新',
  summary: united ? { position: united.position, played: united.played, points: united.points, goalDifference: united.goalDifference } : previous.summary,
  fixtures, standings, championsStandings, scorers, news, transfers, roster, staff,
  journalists: previous.journalists || [], journalistsUpdatedAt: previous.journalistsUpdatedAt || null,
  predictions: buildPredictions(roster, fixtures)
};
await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated: ${fixtures.length} fixtures, ${standings.length} teams, ${news.length} articles, ${roster.length} players`);
