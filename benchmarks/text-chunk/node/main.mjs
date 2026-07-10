// RAG 场景:把大文本按 token 数滑动窗口切块(带 overlap),对每块算 FNV-1a 哈希。
// 注意:fixture 必须是纯 ASCII,保证 JS charCodeAt 与 go/rust 的按字节哈希一致。
import { readFileSync } from 'node:fs';

const path = process.argv[2];
const chunkSize = Number(process.argv[3] ?? 400);
const overlap = Number(process.argv[4] ?? 50);
const iterations = Number(process.argv[5] ?? 5);
if (!path) {
  console.error('usage: node main.mjs <corpus.txt> [chunkSize] [overlap] [iterations]');
  process.exit(1);
}
const text = readFileSync(path, 'utf8');

function fnv1a(str, h) {
  for (let i = 0; i < str.length; i++) {
    h = (h ^ str.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

let acc = 0;
let tokenCount = 0;
let chunkCount = 0;
for (let it = 0; it < iterations; it++) {
  const tokens = text.split(/\s+/).filter(t => t.length > 0);
  tokenCount = tokens.length;
  const step = chunkSize - overlap;
  let chunks = 0;
  for (let start = 0; start < tokens.length; start += step) {
    const end = Math.min(start + chunkSize, tokens.length);
    const chunk = tokens.slice(start, end).join(' ');
    acc = (acc ^ fnv1a(chunk, 2166136261 >>> 0)) >>> 0;
    chunks++;
    if (end === tokens.length) break;
  }
  chunkCount = chunks;
}
console.log(`tokens=${tokenCount} chunks=${chunkCount} hash=${acc}`);
