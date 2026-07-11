# lang-bench

> A Node.js / Go / Rust performance comparison toolkit — equivalent three-language implementations of the same benchmark suite, a unified runner, and a visualization page.

<p align="center">
  <a href="README_zh.md">中文</a>
  &nbsp;|&nbsp;
  <a href="#benchmarks">Benchmarks</a> · <a href="#quick-start">Quick Start</a> · <a href="#metrics">Metrics</a> · <a href="#fairness-notes">Fairness</a>
</p>

---

## Benchmarks

| Benchmark | Type | Scenario | Key metrics |
|---|---|---|---|
| `fib` | CLI | Recursive Fibonacci, pure CPU | Run time |
| `json-parse` | CLI | Parse + serialize ~9 MB event JSON | Run time, memory |
| `vector-topk` | CLI | RAG: brute-force cosine top-10 over 20k × 256-dim vectors | Run time |
| `text-chunk` | CLI | RAG: sliding-window token chunking + hashing | Run time, memory |
| `http-server` | Server | Agent tool-call gateway: POST JSON → parse → compute → JSON | req/s, p50/p99 latency |
| `sse-stream` | Server | LLM token stream relay (SSE) consumed concurrently | events/s, TTFB |

Every CLI benchmark prints the **same verification value** (checksum / hash / sum) in all three languages — confirm they match before trusting any numbers. "Fast" never means "computed the wrong thing."

---

## Quick Start

### Requirements

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | ≥ 20 | Runner + visualization |
| **Go** | ≥ 1.22 | |
| **Rust** | rustup (stable) | |
| **hyperfine** | optional | `brew install hyperfine` — more rigorous timing |

```bash
npm install          # installs autocannon for HTTP load testing
npm run bench:quick  # fast pass with small inputs (first Rust build may be slow)
npm run serve        # open http://localhost:4173 for the chart page
npm run bench        # full run with real parameters
```

### Run a subset

```bash
# specific benchmarks
node runner/run.mjs fib vector-topk --lang=go,rust

# quick mode
node runner/run.mjs http-server --quick

# custom run count
node runner/run.mjs fib --runs=20
```

Results are written to `results/run-<timestamp>.json` and mirrored to `results/latest.json` (which the visualization reads by default). You can also **drag any results JSON** onto the page. The page UI supports Chinese/English via the toggle in the top-right corner.

---

## Metrics

| Metric | Description |
|---|---|
| **Run time** | Median of multiple runs after warmup. Hover any bar for mean / stddev / min / max. |
| **Peak memory** | CLI: max RSS via `/usr/bin/time -l`. Servers: max of `ps` samples every 200ms during load test. |
| **Build time** | Wall time of `go build` / `cargo build --release`. **First Rust build includes all dependencies** — `cargo clean` first for a cold-build measurement. |
| **Artifact size** | Stripped binaries for Go/Rust. Node has no binary, so the source file size is recorded (the runtime itself is ~80 MB — keep that in mind when comparing). |

---

## Fairness Notes

> Read this before drawing conclusions.

- **Rust** builds with `--release` + strip. **Go** with `-ldflags="-s -w"`. **Node** relies on the V8 JIT — warmup rounds ensure hot code is compiled.
- **JSON benchmark**: Go/Rust use typed structs (idiomatic). JS uses dynamic objects — that's how each language is actually used, not an unfairness.
- **HTTP / SSE**: Node and Go use their standard libraries. Rust's standard library has no HTTP server, so it uses the de-facto community standard **axum** (+ tokio).
- **Load-test clients** (autocannon / custom SSE client) are Node.js, applied identically to all three servers.
- **Same machine**, plugged in, heavy background programs closed. The results JSON records CPU / memory / language versions — never mix numbers from different machines.

---

## Project Structure

```
lang-bench/
├── benchmarks/           # equivalent 3-language implementations
│   ├── fib/              #   {node,go,rust}/main.{mjs,go,rs}
│   ├── json-parse/
│   ├── vector-topk/
│   ├── text-chunk/
│   ├── http-server/
│   └── sse-stream/
├── runner/               # runner
│   ├── run.mjs           #   build → warmup → time → collect → JSON
│   ├── config.mjs        #   benchmark registry
│   ├── gen-fixtures.mjs  #   fixture generator
│   └── sse-client.mjs    #   concurrent SSE client
├── web/                  # visualization
│   ├── index.html        #   bar-chart comparison + i18n toggle
│   └── serve.mjs         #   minimal static server
├── fixtures/             # test data (auto-generated)
├── results/              # benchmark result JSONs
├── bin/                  # compiled Go binaries
└── package.json
```

---

## Adding a Benchmark

1. Write three equivalent implementations under `benchmarks/<name>/{node,go,rust}`:
   - **CLI type**: args in → verification value printed to stdout.
   - **Server type**: read the `PORT` env var, expose `GET /ping`, print `READY <port>` to stderr once listening.
2. Register it in `runner/config.mjs` (`type: 'cli' | 'http' | 'sse'`, default args and quick args).
3. Add a title line to `I18N.*.bench` in `web/index.html` and it will show up.

---

## License

MIT
