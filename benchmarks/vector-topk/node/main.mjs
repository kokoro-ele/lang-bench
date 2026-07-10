// RAG 场景:在 n 条 d 维向量上暴力余弦相似度检索,每条查询取 top-k。
// 三种语言用同一个 xorshift32 PRNG 生成相同数据,checksum 必须一致。
const n = Number(process.argv[2] ?? 20000);
const d = Number(process.argv[3] ?? 256);
const q = Number(process.argv[4] ?? 50);
const k = 10;

let state = 42 >>> 0;
function next() {
  state = (state ^ (state << 13)) >>> 0;
  state = (state ^ (state >>> 17)) >>> 0;
  state = (state ^ (state << 5)) >>> 0;
  return state / 4294967296;
}

const db = new Float64Array(n * d);
for (let i = 0; i < db.length; i++) db[i] = next() - 0.5;
const queries = new Float64Array(q * d);
for (let i = 0; i < queries.length; i++) queries[i] = next() - 0.5;

const norms = new Float64Array(n);
for (let i = 0; i < n; i++) {
  let s = 0;
  for (let j = 0; j < d; j++) {
    const v = db[i * d + j];
    s += v * v;
  }
  norms[i] = Math.sqrt(s);
}

let checksum = 0;
const bestS = new Float64Array(k);
const bestI = new Int32Array(k);
for (let qi = 0; qi < q; qi++) {
  bestS.fill(-Infinity);
  bestI.fill(-1);
  let qn = 0;
  for (let j = 0; j < d; j++) {
    const v = queries[qi * d + j];
    qn += v * v;
  }
  qn = Math.sqrt(qn);
  for (let i = 0; i < n; i++) {
    let dot = 0;
    const off = i * d;
    const qoff = qi * d;
    for (let j = 0; j < d; j++) dot += db[off + j] * queries[qoff + j];
    const s = dot / (qn * norms[i]);
    if (s > bestS[k - 1]) {
      let p = k - 1;
      while (p > 0 && bestS[p - 1] < s) {
        bestS[p] = bestS[p - 1];
        bestI[p] = bestI[p - 1];
        p--;
      }
      bestS[p] = s;
      bestI[p] = i;
    }
  }
  for (let j = 0; j < k; j++) checksum += bestI[j];
}
console.log(`checksum=${checksum}`);
