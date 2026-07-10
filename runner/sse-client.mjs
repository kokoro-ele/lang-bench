// SSE 压测客户端:以固定并发消费 SSE 流,统计 TTFB、单流耗时和整体事件吞吐。
import http from 'node:http';

function percentiles(values) {
  const s = [...values].sort((a, b) => a - b);
  const pct = p => (s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : null);
  return {
    p50: pct(50),
    p99: pct(99),
    mean: s.length ? s.reduce((a, b) => a + b, 0) / s.length : null,
  };
}

export async function runSseLoad({ url, streams, concurrency }) {
  const ttfb = [];
  const durations = [];
  let totalEvents = 0;
  let errors = 0;
  let launched = 0;
  const t0 = performance.now();

  function one() {
    return new Promise(resolve => {
      const s0 = performance.now();
      const req = http.get(url, res => {
        let first = -1;
        let count = 0;
        let tail = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          if (first < 0) first = performance.now() - s0;
          const data = tail + chunk;
          let idx = 0;
          let hit;
          while ((hit = data.indexOf('\n\n', idx)) !== -1) {
            count++;
            idx = hit + 2;
          }
          tail = data.slice(idx);
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            ttfb.push(first);
            durations.push(performance.now() - s0);
            totalEvents += count;
          } else {
            errors++;
          }
          resolve();
        });
        res.on('error', () => {
          errors++;
          resolve();
        });
      });
      req.on('error', () => {
        errors++;
        resolve();
      });
    });
  }

  async function worker() {
    while (launched < streams) {
      launched++;
      await one();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const wallSeconds = (performance.now() - t0) / 1000;
  return {
    completedStreams: durations.length,
    errors,
    wallSeconds,
    eventsPerSec: totalEvents / wallSeconds,
    ttfbMs: percentiles(ttfb),
    streamDurationMs: percentiles(durations),
  };
}
