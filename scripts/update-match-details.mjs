import { readFile, writeFile } from 'node:fs/promises';
import { applyMatchDetails, matchSummaryUrl } from './match-details.mjs';

const OUTPUT = new URL('../data/dashboard.json', import.meta.url);
const data = JSON.parse(await readFile(OUTPUT, 'utf8'));
const namesZh = Object.fromEntries((data.roster || []).map(player => [player.name, [player.nameZh || player.name]]));
const now = Date.now();
const windowStart = now - 72 * 3_600_000;
const windowEnd = now + 36 * 3_600_000;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'united-26-27-dashboard/1.0' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

let changed = false;
const comparable = fixture => JSON.stringify(fixture, (key, value) => key === 'generatedAt' ? undefined : value);
const fixtures = await Promise.all(data.fixtures.map(async fixture => {
  const kickoff = new Date(fixture.date).getTime();
  if (kickoff < windowStart || kickoff > windowEnd) return fixture;
  try {
    const payload = await fetchJson(matchSummaryUrl(fixture));
    const next = applyMatchDetails(fixture, payload, namesZh);
    if (comparable(next) === comparable(fixture)) return fixture;
    changed = true;
    return next;
  } catch (error) {
    console.warn(`Match details unavailable for ${fixture.id}: ${error.message}`);
    return fixture;
  }
}));

if (!changed) {
  console.log('Match details unchanged.');
  process.exit(0);
}

data.fixtures = fixtures;
data.updatedAt = new Date().toISOString();
await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`);
console.log('Match details updated.');
