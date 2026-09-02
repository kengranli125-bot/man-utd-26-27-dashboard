import { readFile } from 'node:fs/promises';
import { OFFICIAL_AVAILABILITY_OVERRIDES } from './player-availability.mjs';

const data = JSON.parse(await readFile(new URL('../data/dashboard.json', import.meta.url), 'utf8'));
const errors = [];

for (const [name, expected] of Object.entries(OFFICIAL_AVAILABILITY_OVERRIDES)) {
  const player = data.roster.find(item => item.name === name);
  if (!player) {
    errors.push(`${name}: missing from roster`);
    continue;
  }
  if (player.statusType !== expected.statusType || player.excludeFromPrediction !== expected.excludeFromPrediction) {
    errors.push(`${name}: official availability override was not applied`);
  }
}

for (const [competition, prediction] of Object.entries(data.predictions || {})) {
  for (const player of prediction.players || []) {
    if (player.statusType === 'out' || player.excludeFromPrediction) {
      errors.push(`${competition}: unavailable player selected (${player.name})`);
    }
  }
}

const latestLeague = [...(data.fixtures || [])]
  .filter(fixture => fixture.competitionGroup === 'league' && fixture.status === 'completed')
  .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
const latestUnited = (latestLeague?.lineups || latestLeague?.recap?.lineups || [])
  .find(team => String(team.teamId) === '360' || team.teamName === 'Manchester United');
if (latestUnited?.starters?.length === 11 && data.predictions?.league?.players?.length) {
  const recentEligible = new Set(latestUnited.starters
    .map(starter => data.roster.find(player => player.name === starter.name))
    .filter(player => player && player.statusType !== 'out' && !player.excludeFromPrediction)
    .map(player => player.name));
  const overlap = data.predictions.league.players.filter(player => recentEligible.has(player.name)).length;
  const required = Math.min(8, recentEligible.size);
  if (overlap < required) errors.push(`league: only ${overlap}/${recentEligible.size} recent eligible starters retained (minimum ${required})`);
}

if (errors.length) {
  console.error(`Lineup availability failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log('Lineup availability passed: official absences are excluded from every prediction.');
