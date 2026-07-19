import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../data/dashboard.json', import.meta.url), 'utf8'));
const fixture = data.fixtures.find(item => item.id === '401863531');
const failures = [];

if (!fixture) failures.push('Wrexham fixture is missing');
if (fixture?.status !== 'completed') failures.push('Wrexham fixture is not completed');
if ((fixture?.lineups || []).length !== 2) failures.push('both match squads are missing');
const united = fixture?.lineups?.find(team => team.teamId === '360');
if ((united?.starters || []).length !== 11) failures.push('Manchester United starting XI is missing');
if (!(fixture?.recap?.goals || []).length) failures.push('goal events are missing');
if (!fixture?.recap?.summary) failures.push('post-match summary is missing');
if (!(fixture?.recap?.playerStats || []).length) failures.push('post-match player data is missing');

if (failures.length) {
  console.error(`Match details check failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log(`Match details ready: ${fixture.home.name} ${fixture.home.score}-${fixture.away.score} ${fixture.away.name}; United starters=${united.starters.length}`);
