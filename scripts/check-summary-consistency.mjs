import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../data/dashboard.json', import.meta.url), 'utf8'));
const completedLeagueMatches = (data.fixtures || []).filter(fixture => fixture.competitionGroup === 'league' && fixture.status === 'completed');

if (completedLeagueMatches.length > 0 && Number(data.summary?.played || 0) === 0) {
  console.error(`Summary consistency failed: ${completedLeagueMatches.length} completed league matches but summary.played is 0.`);
  process.exit(1);
}

console.log(`Summary consistency passed: ${completedLeagueMatches.length} completed league matches, summary.played=${data.summary?.played ?? 'missing'}.`);
