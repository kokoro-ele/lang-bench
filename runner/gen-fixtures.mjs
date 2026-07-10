// 生成基准测试用的固定数据(确定性 PRNG,任何机器上生成的内容一致)。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'fixtures');
mkdirSync(DIR, { recursive: true });

let state = 12345 >>> 0;
function next() {
  state = (state ^ (state << 13)) >>> 0;
  state = (state ^ (state >>> 17)) >>> 0;
  state = (state ^ (state << 5)) >>> 0;
  return state / 4294967296;
}
const pick = arr => arr[Math.floor(next() * arr.length)];

const WORDS = [
  'agent', 'model', 'token', 'prompt', 'vector', 'stream', 'tool', 'context',
  'memory', 'plan', 'search', 'code', 'data', 'graph', 'chain', 'node',
  'rust', 'cargo', 'goroutine', 'channel', 'async', 'await', 'buffer', 'socket',
  'parse', 'chunk', 'embed', 'index', 'query', 'rank', 'cache', 'batch',
  'shard', 'merge', 'float', 'tensor', 'logit', 'sample', 'decode', 'encode',
  'layer', 'weight', 'train', 'infer', 'serve', 'route', 'proxy', 'retry',
  'queue', 'worker', 'thread', 'event', 'loop', 'signal', 'metric', 'trace',
  'span', 'log', 'error', 'state',
];

// events.json —— 5 万条模拟事件,给 json-parse 用
{
  const types = ['click', 'view', 'purchase', 'search'];
  const sources = ['web', 'ios', 'android'];
  const events = [];
  for (let i = 0; i < 50000; i++) {
    const tags = [];
    const nTags = 1 + Math.floor(next() * 3);
    for (let t = 0; t < nTags; t++) tags.push(pick(WORDS));
    events.push({
      id: i,
      user: `user_${1 + Math.floor(next() * 5000)}`,
      event: pick(types),
      amount: Math.round(next() * 50000) / 100,
      ts: 1700000000 + Math.floor(next() * 10000000),
      tags,
      props: { depth: 1 + Math.floor(next() * 10), source: pick(sources) },
    });
  }
  const json = JSON.stringify(events);
  writeFileSync(join(DIR, 'events.json'), json);
  console.log(`fixtures/events.json  ${(json.length / 1e6).toFixed(1)} MB (${events.length} events)`);
}

// corpus.txt —— 约 3MB 纯 ASCII 文本,给 text-chunk 用(必须纯 ASCII)
{
  const parts = [];
  let bytes = 0;
  while (bytes < 3_000_000) {
    const sentenceCount = 3 + Math.floor(next() * 5);
    const sentences = [];
    for (let s = 0; s < sentenceCount; s++) {
      const wordCount = 6 + Math.floor(next() * 14);
      const ws = [];
      for (let w = 0; w < wordCount; w++) ws.push(pick(WORDS));
      sentences.push(ws.join(' ') + '.');
    }
    const para = sentences.join(' ');
    parts.push(para);
    bytes += para.length + 2;
  }
  const text = parts.join('\n\n') + '\n';
  writeFileSync(join(DIR, 'corpus.txt'), text);
  console.log(`fixtures/corpus.txt   ${(text.length / 1e6).toFixed(1)} MB`);
}
