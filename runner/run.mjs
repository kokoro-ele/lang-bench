#!/usr/bin/env node
// lang-bench 调度器:构建每个实现 → 预热 → 计时 → 采集内存 → 输出结构化 JSON。
// 用法: node runner/run.mjs [bench...] [--lang=node,go,rust] [--quick] [--runs=N]
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, statSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { benches } from './config.mjs';
import { runSseLoad } from './sse-client.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALL_LANGS = ['node', 'go', 'rust'];

// ---------- 参数解析 ----------
const argv = process.argv.slice(2);
const quick = argv.includes('--quick');
const langArg = argv.find(a => a.startsWith('--lang='))?.slice('--lang='.length);
const runsOverride = Number(argv.find(a => a.startsWith('--runs='))?.slice('--runs='.length)) || null;
const selected = argv.filter(a => !a.startsWith('--'));
const benchNames = selected.length ? selected : Object.keys(benches);

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
for (const b of benchNames) if (!benches[b]) fail(`未知用例: ${b}(可选: ${Object.keys(benches).join(', ')})`);

// ---------- 工具链探测 ----------
function tryOut(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim().split('\n')[0] : null;
  } catch {
    return null;
  }
}
const hasHyperfine = tryOut('hyperfine', ['--version']) !== null;
const available = {
  node: true,
  go: tryOut('go', ['version']) !== null,
  rust: tryOut('cargo', ['--version']) !== null,
};
const langs = (langArg ? langArg.split(',') : ALL_LANGS).filter(l => {
  if (!ALL_LANGS.includes(l)) fail(`未知语言: ${l}`);
  if (!available[l]) {
    console.warn(`! 跳过 ${l}: 未找到工具链`);
    return false;
  }
  return true;
});
if (!langs.length) fail('没有可用的语言工具链');

const meta = {
  timestamp: new Date().toISOString(),
  mode: quick ? 'quick' : 'default',
  platform: `${os.type()} ${os.release()} ${os.arch()}`,
  cpu: os.cpus()[0]?.model ?? 'unknown',
  cores: os.cpus().length,
  memGB: Math.round(os.totalmem() / 2 ** 30),
  timer: hasHyperfine ? 'hyperfine' : 'internal',
  versions: {
    node: process.version,
    go: tryOut('go', ['version']),
    rustc: tryOut('rustc', ['--version']),
    hyperfine: hasHyperfine ? tryOut('hyperfine', ['--version']) : null,
  },
};

// ---------- fixtures ----------
const needFixtures = benchNames.flatMap(b => benches[b].fixtures ?? []);
if (needFixtures.some(f => !existsSync(join(ROOT, 'fixtures', f)))) {
  console.log('生成 fixtures…');
  const r = spawnSync(process.execPath, [join(ROOT, 'runner', 'gen-fixtures.mjs')], { stdio: 'inherit' });
  if (r.status !== 0) fail('fixtures 生成失败');
}

// ---------- 通用工具 ----------
function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 失败:\n${r.stderr || r.stdout}`);
  return r;
}

function stats(times) {
  const s = [...times].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, t) => a + (t - mean) ** 2, 0) / s.length);
  return { mean, stddev: sd, median: s[Math.floor(s.length / 2)], min: s[0], max: s[s.length - 1] };
}

const fmtS = s => (s >= 1 ? `${s.toFixed(2)}s` : `${(s * 1000).toFixed(0)}ms`);

// ---------- 构建 ----------
function build(bench, lang) {
  const dir = join(ROOT, 'benchmarks', bench);
  const t0 = performance.now();
  let artifact;
  if (lang === 'node') {
    artifact = join(dir, 'node', 'main.mjs');
  } else if (lang === 'go') {
    artifact = join(ROOT, 'bin', `${bench}-go`);
    mkdirSync(join(ROOT, 'bin'), { recursive: true });
    sh('go', ['build', '-ldflags=-s -w', '-o', artifact, './go'], { cwd: dir });
  } else {
    sh('cargo', ['build', '--release', '--quiet'], { cwd: join(dir, 'rust') });
    artifact = join(dir, 'rust', 'target', 'release', bench);
  }
  return {
    // node 无编译步骤,构建耗时记为 null;rust 首次构建含依赖编译,见 README
    seconds: lang === 'node' ? null : (performance.now() - t0) / 1000,
    artifact,
    artifactBytes: statSync(artifact).size,
  };
}

function commandFor(lang, artifact, args) {
  return lang === 'node' ? { cmd: process.execPath, args: [artifact, ...args] } : { cmd: artifact, args };
}

// ---------- CLI 用例 ----------
function peakRss(cmd, args) {
  try {
    if (process.platform === 'darwin') {
      const r = spawnSync('/usr/bin/time', ['-l', cmd, ...args], { encoding: 'utf8' });
      const m = r.stderr.match(/(\d+)\s+maximum resident set size/);
      return m ? Number(m[1]) : null; // macOS 单位是字节
    }
    const r = spawnSync('/usr/bin/time', ['-v', cmd, ...args], { encoding: 'utf8' });
    const m = r.stderr.match(/Maximum resident set size \(kbytes\): (\d+)/);
    return m ? Number(m[1]) * 1024 : null;
  } catch {
    return null;
  }
}

function runCliBench(lang, artifact, args) {
  const warmup = quick ? 1 : 3;
  const runs = runsOverride ?? (quick ? 5 : 10);
  const { cmd, args: fullArgs } = commandFor(lang, artifact, args);
  let seconds;
  if (hasHyperfine) {
    const tmp = join(os.tmpdir(), `lang-bench-hf-${process.pid}.json`);
    const cmdline = [cmd, ...fullArgs].map(a => `'${a}'`).join(' ');
    sh('hyperfine', ['--warmup', String(warmup), '--runs', String(runs), '--export-json', tmp, cmdline]);
    const hf = JSON.parse(readFileSync(tmp, 'utf8')).results[0];
    rmSync(tmp, { force: true });
    seconds = { mean: hf.mean, stddev: hf.stddev ?? 0, median: hf.median, min: hf.min, max: hf.max };
  } else {
    for (let i = 0; i < warmup; i++) sh(cmd, fullArgs);
    const times = [];
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      sh(cmd, fullArgs);
      times.push((performance.now() - t0) / 1000);
    }
    seconds = stats(times);
  }
  return { warmup, runs, seconds, peakRssBytes: peakRss(cmd, fullArgs) };
}

// ---------- 服务型用例 ----------
let nextPort = 8301;

async function withServer(lang, artifact, fn) {
  const port = nextPort++;
  const { cmd, args } = commandFor(lang, artifact, []);
  const proc = spawn(cmd, args, {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderrBuf = '';
  proc.stderr.on('data', d => (stderrBuf += d));
  let exited = false;
  proc.on('exit', () => (exited = true));

  const deadline = Date.now() + 15000;
  let ready = false;
  while (Date.now() < deadline && !exited) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/ping`, { signal: AbortSignal.timeout(500) });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  if (!ready) {
    proc.kill('SIGKILL');
    throw new Error(`服务启动失败 (${lang}): ${stderrBuf.slice(0, 500)}`);
  }

  const samples = [];
  const sampler = setInterval(() => {
    try {
      const rss = Number(execFileSync('ps', ['-o', 'rss=', '-p', String(proc.pid)], { encoding: 'utf8' }).trim());
      if (rss) samples.push(rss * 1024);
    } catch {}
  }, 200);

  try {
    const result = await fn(port);
    return { ...result, peakRssBytes: samples.length ? Math.max(...samples) : null };
  } finally {
    clearInterval(sampler);
    proc.kill('SIGTERM');
    setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {}
    }, 1000).unref();
  }
}

// 约 1KB 的工具调用请求体,模拟 agent 的一次 tool call
const TOOL_BODY = JSON.stringify({
  name: 'summarize',
  args: { text: 'The quick brown agent streams tokens over the wire. '.repeat(19), max: 128 },
});

async function runHttpBench(lang, artifact, cfg) {
  const autocannon = (await import('autocannon')).default;
  return withServer(lang, artifact, async port => {
    const duration = quick ? cfg.load.quickDuration : cfg.load.duration;
    const opts = {
      url: `http://127.0.0.1:${port}${cfg.load.path}`,
      method: cfg.load.method,
      headers: { 'content-type': 'application/json' },
      body: TOOL_BODY,
      connections: cfg.load.connections,
    };
    await autocannon({ ...opts, duration: quick ? 1 : 2 }); // 预热
    const r = await autocannon({ ...opts, duration });
    return {
      connections: cfg.load.connections,
      durationSeconds: duration,
      requestsPerSec: r.requests.average,
      latencyMs: { mean: r.latency.average, p50: r.latency.p50, p99: r.latency.p99 },
      throughputBytesPerSec: r.throughput.average,
      errors: r.errors,
      non2xx: r.non2xx,
    };
  });
}

async function runSseBench(lang, artifact, cfg) {
  return withServer(lang, artifact, async port => {
    const streams = quick ? cfg.load.quickStreams : cfg.load.streams;
    const url = `http://127.0.0.1:${port}/stream?n=${cfg.load.events}`;
    await runSseLoad({ url, streams: Math.min(16, streams), concurrency: 8 }); // 预热
    const r = await runSseLoad({ url, streams, concurrency: cfg.load.concurrency });
    return { eventsPerStream: cfg.load.events, streams, concurrency: cfg.load.concurrency, ...r };
  });
}

// ---------- 主流程 ----------
console.log(`lang-bench  mode=${meta.mode}  timer=${meta.timer}  langs=${langs.join(',')}`);
console.log(`${meta.cpu} · ${meta.cores} cores · ${meta.memGB}GB · ${meta.platform}\n`);

const results = [];
for (const bench of benchNames) {
  const cfg = benches[bench];
  for (const lang of langs) {
    process.stdout.write(`▸ ${bench.padEnd(12)} ${lang.padEnd(5)} 构建… `);
    let built;
    try {
      built = build(bench, lang);
    } catch (e) {
      console.log('构建失败');
      console.error(String(e.message).slice(0, 1500));
      results.push({ bench, lang, type: cfg.type, error: `build: ${String(e.message).slice(0, 500)}` });
      continue;
    }
    process.stdout.write('运行… ');
    try {
      const record = {
        bench,
        lang,
        type: cfg.type,
        build: { seconds: built.seconds, artifactBytes: built.artifactBytes },
      };
      if (cfg.type === 'cli') {
        const args = (quick ? cfg.quickArgs : cfg.args).map(a => a.replaceAll('{ROOT}', ROOT));
        record.cli = runCliBench(lang, built.artifact, args);
        console.log(`median ${fmtS(record.cli.seconds.median)}`);
      } else if (cfg.type === 'http') {
        record.http = await runHttpBench(lang, built.artifact, cfg);
        console.log(`${Math.round(record.http.requestsPerSec)} req/s, p99 ${record.http.latencyMs.p99}ms`);
      } else {
        record.sse = await runSseBench(lang, built.artifact, cfg);
        console.log(`${Math.round(record.sse.eventsPerSec)} events/s, TTFB p50 ${record.sse.ttfbMs.p50?.toFixed(1)}ms`);
      }
      results.push(record);
    } catch (e) {
      console.log('失败');
      console.error(String(e.message).slice(0, 1500));
      results.push({ bench, lang, type: cfg.type, error: String(e.message).slice(0, 500) });
    }
  }
}

mkdirSync(join(ROOT, 'results'), { recursive: true });
const stamp = meta.timestamp.replace(/[:.]/g, '-');
const file = join(ROOT, 'results', `run-${stamp}.json`);
writeFileSync(file, JSON.stringify({ meta, results }, null, 2));
copyFileSync(file, join(ROOT, 'results', 'latest.json'));
console.log(`\n✓ 结果已写入 results/run-${stamp}.json(同步到 results/latest.json)`);
console.log('  运行 `npm run serve` 后打开 http://localhost:4173 查看可视化对比');
