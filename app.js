const DATA_URL = './data/dashboard.json';
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const state = { data: null, view: 'overview', filter: 'all', competition: 'all', lineup: 'league', position: 'all' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const fmtDate = (value, withTime = false) => {
  if (!value) return '待定';
  const date = new Date(value);
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(date);
};
const safe = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const empty = (title, message) => `<div class="empty-state"><strong>${safe(title)}</strong><span>${safe(message)}</span></div>`;

function setView(view) {
  state.view = view;
  $$('.view').forEach(el => el.classList.toggle('active', el.id === `${view}-view`));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  const titles = { overview: '赛季概览', fixtures: '全赛事赛程', squad: '阵容实验室', standings: '积分榜', news: '球队动态' };
  $('#pageTitle').textContent = titles[view];
  $('.sidebar').classList.remove('open'); $('#scrim').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderStats() {
  const s = state.data.summary;
  const items = [['联赛排名', s.position ? `${s.position}` : '—', s.position ? '位' : '未开赛'], ['已赛', s.played ?? 0, '场'], ['积分', s.points ?? 0, '分'], ['净胜球', s.goalDifference > 0 ? `+${s.goalDifference}` : (s.goalDifference ?? 0), '球']];
  $('#statGrid').innerHTML = items.map(([label, value, unit]) => `<div class="stat"><span class="label">${label}</span><strong>${value}<small>${unit}</small></strong></div>`).join('');
}

function teamBlock(team) { return `<div class="match-team"><img src="${safe(team.logo || '')}" alt="" /><span>${safe(team.nameZh || team.name)}</span></div>`; }
function renderNextMatch() {
  const match = state.data.fixtures.find(f => f.status === 'upcoming');
  if (!match) { $('#nextMatch').innerHTML = empty('赛程尚未发布', '数据源发布新赛季赛程后将在这里自动显示。'); return; }
  $('#nextMatch').innerHTML = `<div class="match-card">${teamBlock(match.home)}<div class="match-meta"><time>${fmtDate(match.date, true)}</time><div class="versus">VS</div><span>${safe(match.venue || '场地待定')}</span></div>${teamBlock(match.away)}</div>`;
}

function renderForm() {
  const games = state.data.fixtures.filter(f => f.status === 'completed').slice(-5).reverse();
  if (!games.length) { $('#recentForm').innerHTML = empty('暂无赛季战绩', '首轮比赛结束后更新近期状态。'); return; }
  $('#recentForm').innerHTML = games.map(g => { const unitedHome = g.home.id === '360'; const us = unitedHome ? g.home.score : g.away.score; const them = unitedHome ? g.away.score : g.home.score; const result = us > them ? ['W','win'] : us === them ? ['D','draw'] : ['L','loss']; const opponent = unitedHome ? g.away : g.home; return `<div class="form-row"><span class="result ${result[1]}">${result[0]}</span><span>${safe(opponent.nameZh || opponent.name)}</span><span class="form-score">${us}–${them}</span></div>`; }).join('');
}

function newsCard(article) {
  const image = article.image ? `style="background-image:url('${safe(article.image)}')"` : '';
  return `<a class="news-card" href="${safe(article.url || '#')}" target="_blank" rel="noreferrer"><div class="news-image ${article.image ? '' : 'no-image'}" ${image}></div><div class="news-body"><time>${fmtDate(article.published)}</time><h4>${safe(article.titleZh || article.title)}</h4></div></a>`;
}
function renderNews() {
  const news = state.data.news || [];
  const fallback = [{ title: '26/27 赛季数据通道已就绪', published: state.data.updatedAt, url: '', image: '' }, { title: '新赛程发布后将自动同步至比赛中心', published: state.data.updatedAt, url: '', image: '' }, { title: '积分与赛果将在比赛结束后每日刷新', published: state.data.updatedAt, url: '', image: '' }];
  const display = news.length ? news : fallback;
  $('#newsPreview').innerHTML = display.slice(0, 3).map(newsCard).join('');
  $('#allNews').innerHTML = display.map(newsCard).join('');
}

function renderFixtures() {
  let list = state.data.fixtures || [];
  if (state.filter !== 'all') list = list.filter(f => f.status === state.filter);
  if (state.competition !== 'all') list = list.filter(f => f.competitionGroup === state.competition);
  if (!list.length) { $('#fixtureList').innerHTML = empty(state.filter === 'all' ? '赛程尚未发布' : '此分类暂无比赛', '每日更新任务会自动检查最新赛程。'); return; }
  const groups = list.reduce((acc, fixture) => { const date = new Date(fixture.date); const key = `${date.getFullYear()}年${date.getMonth()+1}月`; (acc[key] ||= []).push(fixture); return acc; }, {});
  $('#fixtureList').innerHTML = Object.entries(groups).map(([month, fixtures]) => `<section class="fixture-month"><h3>${month}<span>${fixtures.length} 场</span></h3><div>${fixtures.map(g => `<article class="fixture-row"><div class="fixture-date"><strong>${fmtDate(g.date)}</strong>${new Date(g.date).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}<span class="competition-badge ${safe(g.competitionGroup)}">${safe(g.competition)}</span></div><div class="fixture-teams"><div class="fixture-team"><img src="${safe(g.home.logo)}" alt="" />${safe(g.home.nameZh || g.home.name)}<span class="score">${g.status === 'completed' ? g.home.score : ''}</span></div><div class="fixture-team"><img src="${safe(g.away.logo)}" alt="" />${safe(g.away.nameZh || g.away.name)}<span class="score">${g.status === 'completed' ? g.away.score : ''}</span></div></div><div class="fixture-venue"><strong>${g.status === 'completed' ? '完场' : '未赛'}</strong>${safe(g.venue || '场地待定')}</div>${g.status === 'completed' && g.recap ? renderMatchRecap(g.recap) : ''}</article>`).join('')}</div></section>`).join('');
}

function renderMatchRecap(recap) {
  const goals = recap.goals?.length ? `<div class="recap-goals"><strong>进球</strong>${recap.goals.map(goal => `<span>${safe(goal.nameZh || goal.name)} ${safe(goal.minute)}</span>`).join('')}</div>` : '';
  const stats = recap.stats?.length ? `<div class="recap-stats">${recap.stats.map(stat => `<div><span>${safe(stat.united)}</span><small>${safe(stat.label)}</small><span>${safe(stat.opponent)}</span></div>`).join('')}</div>` : '';
  const players = recap.playerStats?.length ? `<div class="match-player-data">${recap.playerStats.map(team => `<section><h5>${safe(team.teamName)}球员数据</h5><div class="player-data-scroll"><table><thead><tr><th>球员</th><th>身份</th><th>分钟</th><th>进球</th><th>助攻</th><th>射门</th><th>射正</th><th>扑救</th><th>黄牌</th><th>红牌</th></tr></thead><tbody>${team.players.map(player => `<tr><td>${safe(player.nameZh || player.name)}</td><td>${player.starter ? '首发' : '替补'}</td><td>${safe(player.minutes)}</td><td>${safe(player.goals)}</td><td>${safe(player.assists)}</td><td>${safe(player.shots)}</td><td>${safe(player.shotsOnTarget)}</td><td>${safe(player.saves)}</td><td>${safe(player.yellowCards)}</td><td>${safe(player.redCards)}</td></tr>`).join('')}</tbody></table></div></section>`).join('')}</div>` : '';
  return `<details class="match-recap"><summary>赛后总结与技术统计 <span>展开 →</span></summary><div class="recap-content"><h4>${safe(recap.headline)}</h4><p>${safe(recap.summary)}</p>${goals}${stats}${players}</div></details>`;
}

function renderStandings() {
  const rows = state.data.standings || [];
  if (!rows.length) { $('#standingsBody').innerHTML = `<tr><td colspan="8">${empty('积分榜尚未产生', '新赛季开始后将自动载入完整排名。')}</td></tr>`; return; }
  $('#standingsBody').innerHTML = rows.map(t => `<tr class="${t.id === '360' ? 'united' : ''} ${t.position <= 4 ? 'zone-ucl' : t.position >= 18 ? 'zone-relegation' : ''}"><td>${t.position}</td><td><div class="table-club"><img src="${safe(t.logo)}" alt="" />${safe(t.nameZh || t.name)}</div></td><td>${t.played}</td><td>${t.wins}</td><td>${t.draws}</td><td>${t.losses}</td><td>${t.goalDifference > 0 ? '+' : ''}${t.goalDifference}</td><td><strong>${t.points}</strong></td></tr>`).join('');
}

function renderChampionsBoard() {
  const standings = state.data.championsStandings || [];
  if (!standings.length) { $('#championsBoard').innerHTML = empty('欧冠积分榜尚未产生', '联赛阶段抽签及比赛开始后每日更新。'); return; }
  const united = standings.find(team => team.id === '360');
  const display = standings.slice(0,8);
  if (united && united.position > 8) display.push({ separator:true }, united);
  $('#championsBoard').innerHTML = `<div class="compact-table"><div class="compact-head"><span>排名</span><span>球队</span><span>场</span><span>净胜</span><span>积分</span></div>${display.map(team => team.separator ? '<div class="table-separator">···</div>' : `<div class="compact-row ${team.id === '360' ? 'united' : ''} ${team.position <= 8 ? 'direct' : team.position <= 24 ? 'playoff' : ''}"><span>${team.position}</span><span class="compact-club"><img src="${safe(team.logo)}" alt="" />${safe(team.nameZh || team.name)}</span><span>${team.played}</span><span>${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</span><strong>${team.points}</strong></div>`).join('')}</div>`;
}

function renderScorersBoard() {
  const scorers = state.data.scorers || [];
  if (!scorers.length) { $('#scorersBoard').innerHTML = empty('新赛季尚无进球', '首场英超比赛结束后生成球队射手排名。'); return; }
  $('#scorersBoard').innerHTML = `<div class="scorer-list">${scorers.slice(0,7).map((player,index) => `<div class="scorer-row"><span class="scorer-rank">${index+1}</span><div class="scorer-photo">${playerAvatar(player,true)}</div><div class="scorer-name"><strong>${safe(player.nameZh || player.name)}</strong><span>${player.appearances} 次出场 · ${player.assists} 次助攻</span></div><div class="goal-total"><strong>${player.goals}</strong><span>进球</span></div></div>`).join('')}</div>`;
}

const positionZh = { Goalkeeper: '门将', Defender: '后卫', Midfielder: '中场', Forward: '前锋' };
function playerAvatar(player, compact = false) {
  const initials = player.name.split(' ').map(part => part[0]).slice(-2).join('');
  if (player.headshot) return `<img src="${safe(player.headshot)}" alt="${safe(player.nameZh || player.name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span class="player-initial ${compact ? 'compact' : ''}" hidden>${safe(initials)}</span>`;
  return `<span class="player-initial ${compact ? 'compact' : ''}">${safe(initials)}</span>`;
}

function renderRoster() {
  let players = state.data.roster || [];
  if (state.position !== 'all') players = players.filter(player => player.position === state.position);
  if (!players.length) { $('#rosterGrid').innerHTML = empty('阵容数据正在同步', '每日任务会自动载入一线队名单。'); return; }
  $('#rosterGrid').innerHTML = players.map(player => `<article class="roster-card">
    <div class="roster-avatar">${playerAvatar(player)}</div>
    <div class="roster-info"><div class="roster-number">${safe(player.jersey || '—')}</div><div><h4>${safe(player.nameZh || player.name)}</h4><span>${positionZh[player.position] || safe(player.position)} · ${player.age || '—'}岁</span><span class="nationality">${player.flag ? `<img src="${safe(player.flag)}" alt="" />` : ''}${safe(player.nationalityZh || '待确认')}</span></div></div>
    <div class="availability"><span class="status-pill ${player.statusType}">${safe(player.statusLabel)}</span><div class="score-bar"><i style="width:${player.availabilityScore}%"></i></div><strong>${player.availabilityScore}<small>/100</small></strong></div>
  </article>`).join('');
}

function transferCard(item) {
  return `<a class="transfer-item" href="${safe(item.url || '#')}" target="_blank" rel="noreferrer"><span class="transfer-status ${safe(item.statusType)}">${safe(item.status)}</span><div><strong>${safe(item.player || '曼联转会动态')}</strong><p>${safe(item.titleZh || item.title)}</p></div><time>${fmtDate(item.published)}</time></a>`;
}
function renderTransfers() {
  const transfers = state.data.transfers || [];
  const content = transfers.length ? transfers.map(transferCard).join('') : empty('暂无新转会动态', '发现新的可靠消息后将在这里自动显示。');
  $('#transferPreview').innerHTML = transfers.length ? transfers.slice(0,3).map(transferCard).join('') : content;
  $('#allTransfers').innerHTML = content;
}

function renderJournalists() {
  const items = state.data.journalists || [];
  const updated = state.data.journalistsUpdatedAt;
  $('#journalistsUpdatedAt').textContent = updated ? fmtDate(updated, true) : '等待首次同步';
  if (!items.length) {
    $('#journalistFeed').innerHTML = empty('记者动态正在接入', '首次抓取完成后将展示罗马诺、奥恩斯坦及曼联权威跟队记者的公开报道。');
    return;
  }
  $('#journalistFeed').innerHTML = items.slice(0, 8).map(item => `<a class="journalist-item" href="${safe(item.url)}" target="_blank" rel="noreferrer"><div class="reporter-mark">${safe((item.reporterZh || item.reporter).slice(0,1))}</div><div class="journalist-copy"><div><strong>${safe(item.reporterZh || item.reporter)}</strong><span>${safe(item.reporterOutlet || item.source)}</span><i class="tier tier-${safe(item.tier)}">T${safe(item.tier)} 信源</i></div><p>${safe(item.titleZh || item.title)}</p><small>${safe(item.source)} · ${fmtDate(item.published, true)}</small></div><b>→</b></a>`).join('');
}

function renderStaff() {
  const staff = state.data.staff || [];
  const confirmed = staff.map(member => `<article class="staff-card"><div class="staff-photo">${playerAvatar(member)}</div><div><span class="staff-status">${safe(member.status)}</span><h4>${safe(member.nameZh)}</h4><p>${safe(member.role)}</p><small>${safe(member.source)}</small></div></article>`).join('');
  $('#staffGrid').innerHTML = `${confirmed}<article class="staff-card pending-staff"><div class="staff-placeholder">+</div><div><span class="staff-status pending">等待更新</span><h4>助理教练团队</h4><p>成员名单待俱乐部公开资料确认</p><small>不会展示未经确认的人名</small></div></article>`;
}

function renderLineup() {
  const prediction = state.data.predictions?.[state.lineup];
  if (!prediction?.players?.length) { $('#lineupPitch').innerHTML = empty('预测阵容待生成', '阵容同步后将自动生成首发建议。'); return; }
  $('#formationLabel').textContent = prediction.formation;
  $('#lineupTitle').textContent = prediction.title;
  $('#lineupSummary').textContent = prediction.summary;
  const rows = ['F', 'AM', 'DM', 'D', 'GK'];
  $('#lineupPitch').innerHTML = rows.map(row => `<div class="pitch-row row-${row.toLowerCase()}">${prediction.players.filter(player => player.line === row).map(player => `<div class="pitch-player"><div class="pitch-avatar">${playerAvatar(player, true)}<span>${safe(player.jersey || '—')}</span></div><strong>${safe(player.shortNameZh || player.nameZh || player.shortName || player.name)}</strong><small>${safe(player.role)}</small></div>`).join('')}</div>`).join('');
  $('#lineupMetrics').innerHTML = prediction.metrics.map(metric => `<div class="metric"><span>${safe(metric.label)}</span><div><i style="width:${metric.value}%"></i></div><strong>${metric.value}</strong></div>`).join('');
}

function render() {
  $('#updatedAt').textContent = new Intl.DateTimeFormat('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(state.data.updatedAt));
  $('#seasonStatus').textContent = state.data.statusMessage;
  renderStats(); renderNextMatch(); renderForm(); renderNews(); renderTransfers(); renderJournalists(); renderFixtures(); renderStandings(); renderChampionsBoard(); renderScorersBoard(); renderStaff(); renderRoster(); renderLineup();
}

async function loadLatestData({ initial = false } = {}) {
  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('data unavailable');
    const nextData = await response.json();
    const changed = !state.data || nextData.updatedAt !== state.data.updatedAt;
    state.data = nextData;
    if (changed || initial) render();
  } catch {
    if (initial) $('#seasonStatus').textContent = '暂时无法读取数据，请稍后重试';
  }
}

async function init() {
  await loadLatestData({ initial: true });
  $$('.nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $$('[data-jump]').forEach(button => button.addEventListener('click', () => setView(button.dataset.jump)));
  $$('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; $$('[data-filter]').forEach(b => b.classList.toggle('active', b === button)); renderFixtures(); }));
  $$('[data-competition]').forEach(button => button.addEventListener('click', () => { state.competition = button.dataset.competition; $$('[data-competition]').forEach(b => b.classList.toggle('active', b === button)); renderFixtures(); }));
  $$('.lineup-tabs button').forEach(button => button.addEventListener('click', () => { state.lineup = button.dataset.lineup; $$('.lineup-tabs button').forEach(b => b.classList.toggle('active', b === button)); renderLineup(); }));
  $$('.roster-filters button').forEach(button => button.addEventListener('click', () => { state.position = button.dataset.position; $$('.roster-filters button').forEach(b => b.classList.toggle('active', b === button)); renderRoster(); }));
  $('#menuButton').addEventListener('click', () => { $('.sidebar').classList.add('open'); $('#scrim').classList.add('open'); });
  $('#scrim').addEventListener('click', () => { $('.sidebar').classList.remove('open'); $('#scrim').classList.remove('open'); });
  setInterval(loadLatestData, REFRESH_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadLatestData(); });
}
init();
