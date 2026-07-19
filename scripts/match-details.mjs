const TEAM_ID = '360';

const playerName = (athlete, namesZh = {}) => {
  const name = athlete?.displayName || athlete?.fullName || athlete?.name || '';
  return { name, nameZh: namesZh[name]?.[0] || name };
};

const playCount = (plays, key) => (plays || []).filter(play => play?.[key]).length;

function parseLineups(payload, namesZh = {}) {
  return (payload?.rosters || []).map(teamRoster => {
    const players = (teamRoster.roster || []).map(entry => {
      const athlete = entry.athlete || {};
      const names = playerName(athlete, namesZh);
      const substitution = (entry.plays || []).find(play => play.substitution);
      return {
        id: String(athlete.id || names.name), ...names, jersey: entry.jersey || '',
        position: entry.position?.abbreviation || entry.position?.displayName || '',
        starter: Boolean(entry.starter), active: Boolean(entry.active), subbedIn: Boolean(entry.subbedIn),
        subbedOut: Boolean(entry.subbedOut), substitutionTime: substitution?.clock?.displayValue || ''
      };
    }).filter(player => player.name);
    return {
      teamId: String(teamRoster.team?.id || ''), teamName: teamRoster.team?.displayName || '',
      logo: teamRoster.team?.logo || '', formation: teamRoster.formation || '',
      confirmed: players.filter(player => player.starter).length >= 11,
      starters: players.filter(player => player.starter), substitutes: players.filter(player => !player.starter)
    };
  }).filter(team => team.teamId && (team.starters.length || team.substitutes.length > 1));
}

function teamStats(payload, teamId) {
  const team = (payload?.boxscore?.teams || []).find(item => String(item.team?.id) === String(teamId));
  const raw = team?.statistics;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw).flat().filter(Boolean);
  return [];
}

function buildRecap(fixture, payload, namesZh = {}) {
  const unitedHome = fixture.home.id === TEAM_ID;
  const united = unitedHome ? fixture.home : fixture.away;
  const opponent = unitedHome ? fixture.away : fixture.home;
  const us = Number(united.score || 0);
  const them = Number(opponent.score || 0);
  const outcome = us > them ? '战胜' : us === them ? '战平' : '不敌';
  const keyEvents = payload?.keyEvents || payload?.header?.competitions?.[0]?.details || [];
  const goals = keyEvents.filter(event => event.scoringPlay || /goal/i.test(event.type?.text || event.type?.type || '')).map(event => {
    const athlete = event.participants?.[0]?.athlete || event.athletesInvolved?.[0] || event.athlete;
    const names = playerName(athlete, namesZh);
    return { ...names, minute: event.clock?.displayValue || '', teamId: String(event.team?.id || ''), text: event.text || '' };
  }).filter(goal => goal.name);
  const goalSentence = goals.length
    ? `本场进球：${goals.map(goal => `${goal.nameZh}${goal.minute ? `（${goal.minute}）` : ''}`).join('、')}。`
    : '本场没有进球事件。';
  const summary = `曼联${unitedHome ? '主场' : '客场'}以 ${us}–${them} ${outcome}${opponent.nameZh || opponent.name}。${goalSentence}${fixture.venue ? `比赛在${fixture.venue}进行。` : ''}`;
  const statNames = [
    { names: ['possessionPct', 'possession'], label: '控球率' }, { names: ['totalShots', 'shots'], label: '射门' },
    { names: ['shotsOnTarget'], label: '射正' }, { names: ['wonCorners', 'corners'], label: '角球' },
    { names: ['foulsCommitted', 'fouls'], label: '犯规' }, { names: ['offsides'], label: '越位' },
    { names: ['yellowCards'], label: '黄牌' }, { names: ['redCards'], label: '红牌' }
  ];
  const statFor = (teamId, names) => {
    const stat = teamStats(payload, teamId).find(item => names.includes(item.name) || names.includes(item.abbreviation));
    return stat?.displayValue ?? stat?.value ?? null;
  };
  const stats = statNames.map(item => ({ label: item.label, united: statFor(united.id, item.names), opponent: statFor(opponent.id, item.names) }))
    .filter(item => item.united != null && item.opponent != null);
  const lineups = parseLineups(payload, namesZh);
  const eventByAthlete = new Map();
  for (const event of keyEvents) for (const participant of event.participants || []) {
    const id = String(participant.athlete?.id || '');
    if (id) eventByAthlete.set(id, [...(eventByAthlete.get(id) || []), event]);
  }
  const playerStats = (payload?.rosters || []).map(teamRoster => ({
    teamId: String(teamRoster.team?.id || ''), teamName: teamRoster.team?.displayName || '',
    players: (teamRoster.roster || []).filter(entry => entry.starter || entry.subbedIn || entry.active).map(entry => {
      const athlete = entry.athlete || {};
      const names = playerName(athlete, namesZh);
      const events = eventByAthlete.get(String(athlete.id || '')) || [];
      const substitution = (entry.plays || []).find(play => play.substitution);
      return {
        id: String(athlete.id || names.name), ...names, starter: Boolean(entry.starter),
        position: entry.position?.abbreviation || entry.position?.displayName || '', jersey: entry.jersey || '',
        minutes: substitution?.clock?.displayValue || (entry.starter ? '90' : '—'),
        goals: events.filter(event => event.scoringPlay && event.participants?.[0]?.athlete?.id === athlete.id).length,
        assists: events.filter(event => event.scoringPlay && event.participants?.[1]?.athlete?.id === athlete.id).length,
        shots: '—', shotsOnTarget: '—', saves: '—',
        yellowCards: playCount(entry.plays, 'yellowCard'), redCards: playCount(entry.plays, 'redCard')
      };
    }).filter(player => player.name)
  })).filter(team => team.players.length);
  return {
    headline: `曼联 ${us}–${them} ${opponent.nameZh || opponent.name}`, summary,
    outcome: us > them ? 'win' : us === them ? 'draw' : 'loss', goals, stats,
    statsAvailable: stats.length > 0, playerStats, lineups, generatedAt: new Date().toISOString()
  };
}

export function applyMatchDetails(fixture, payload, namesZh = {}) {
  const competition = payload?.header?.competitions?.[0];
  const completed = Boolean(competition?.status?.type?.completed) || competition?.status?.type?.state === 'post';
  const competitors = competition?.competitors || [];
  const scoreFor = teamId => {
    const team = competitors.find(item => String(item.team?.id) === String(teamId));
    return Number(team?.score?.value ?? team?.score ?? 0);
  };
  const next = {
    ...fixture,
    status: completed ? 'completed' : fixture.status,
    home: { ...fixture.home, score: completed ? scoreFor(fixture.home.id) : fixture.home.score },
    away: { ...fixture.away, score: completed ? scoreFor(fixture.away.id) : fixture.away.score },
    lineups: parseLineups(payload, namesZh)
  };
  return completed ? { ...next, recap: buildRecap(next, payload, namesZh) } : next;
}

export const matchSummaryUrl = fixture => `https://site.api.espn.com/apis/site/v2/sports/soccer/${fixture.competitionKey}/summary?event=${fixture.id}`;
