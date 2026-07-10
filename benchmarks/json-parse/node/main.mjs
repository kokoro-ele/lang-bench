import { readFileSync } from 'node:fs';

const path = process.argv[2];
const iterations = Number(process.argv[3] ?? 10);
if (!path) {
  console.error('usage: node main.mjs <fixture.json> [iterations]');
  process.exit(1);
}
const raw = readFileSync(path, 'utf8');

let total = 0;
let outLen = 0;
for (let i = 0; i < iterations; i++) {
  const events = JSON.parse(raw);
  let sum = 0;
  for (const e of events) sum += e.amount;
  total += sum;
  outLen = JSON.stringify(events).length;
}
console.log(`sum=${total.toFixed(2)} out=${outLen}`);
