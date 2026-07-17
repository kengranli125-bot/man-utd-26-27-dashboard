import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../data/dashboard.json', import.meta.url), 'utf8'));
const updatedAt = Date.parse(data.updatedAt);
const maxAgeHours = Number(process.argv[2] || 6.5);
const ageHours = (Date.now() - updatedAt) / 3_600_000;

if (!Number.isFinite(updatedAt)) {
  console.error('Update health failed: invalid updatedAt value.');
  process.exit(1);
}

console.log(`updatedAt=${data.updatedAt} ageHours=${ageHours.toFixed(2)} maxAgeHours=${maxAgeHours}`);
if (ageHours > maxAgeHours) {
  console.error('Update health failed: dashboard data is stale.');
  process.exit(1);
}
