# lang-bench

> Node.js / Go / Rust 性能对比工具包 — 同一组用例的三语言等价实现、统一调度器、可视化页面。
>
> A Node.js / Go / Rust performance comparison toolkit — equivalent three-language implementations of the same benchmark suite, a unified runner, and a visualization page.

<p align="center">
  <strong>English</strong> · <a href="#benchmarks">Benchmarks</a> · <a href="#quick-start">Quick Start</a> · <a href="#metrics">Metrics</a> · <a href="#fairness-notes">Fairness</a>
  &nbsp;|&nbsp;
  <strong>中文</strong> · <a href="#用例">用例</a> · <a href="#快速开始">快速开始</a> · <a href="#指标说明">指标说明</a> · <a href="#公平性备注">公平性备注</a>
</p>

---

## Benchmarks · 用例

| Benchmark | 类型 | Scenario · 场景 | Key metrics · 主要指标 |
|---|---|---|---|
| `fib` | CLI | Recursive Fibonacci, pure CPU · 递归 Fibonacci，纯 CPU 密集 | Run time · 运行时间 |
| `json-parse` | CLI | Parse + serialize ~9 MB event JSON · 解析 + 序列化约 9 MB 事件 JSON | Run time, memory · 运行时间、内存 |
| `vector-topk` | CLI | RAG: brute-force cosine top-10 over 20k × 256-dim vectors · RAG 向量相似度暴力检索 | Run time · 运行时间 |
| `text-chunk` | CLI | RAG: sliding-window token chunking + hashing · RAG 文档切块 + 哈希 | Run time, memory · 运行时间、内存 |
| `http-server` | Server · 服务 | Agent tool-call gateway: POST JSON → parse → compute → JSON · Agent 工具调用网关 | req/s, p50/p99 latency · 延迟 |
| `sse-stream` | Server · 服务 | LLM token stream relay (SSE) consumed concurrently · LLM token 流转发（并发消费） | events/s, TTFB |

Every CLI benchmark prints the **same verification value** (checksum / hash / sum) in all three languages — confirm they match before trusting any numbers. "Fast" never means "computed the wrong thing."

每个 CLI 用例三种语言输出**相同的校验值**（checksum / hash / sum），跑分前先确认三者一致——"跑得快"绝不等于"算错了"。

---

## Quick Start · 快速开始

### Requirements · 依赖

| Tool · 工具 | Version · 版本 | Notes · 备注 |
|---|---|---|
| **Node.js** | ≥ 20 | Runner + visualization · 调度器与可视化 |
| **Go** | ≥ 1.22 | |
| **Rust** | rustup (stable) | |
| **hyperfine** | optional · 可选 | `brew install hyperfine` — 更严谨的计时 · more rigorous timing |

```bash
npm install          # 安装 autocannon（HTTP 压测）· installs autocannon for HTTP load testing
npm run bench:quick  # 小参数快速跑一遍（首次编译，Rust 较慢）· fast pass with small inputs
npm run serve        # 打开 http://localhost:4173 查看可视化 · open for the chart page
npm run bench        # 正式参数完整跑 · full run with real parameters
```

### Run a subset · 只跑部分

```bash
# 指定用例 / specific benchmarks
node runner/run.mjs fib vector-topk --lang=go,rust

# 快速模式 / quick mode
node runner/run.mjs http-server --quick

# 自定义重复次数 / custom run count
node runner/run.mjs fib --runs=20
```

Results are written to `results/run-<timestamp>.json` and mirrored to `results/latest.json` (which the visualization reads by default). You can also **drag any results JSON** onto the page. The page UI supports Chinese/English via the toggle in the top-right corner.

结果写入 `results/run-<时间戳>.json`，并同步到 `results/latest.json`（页面默认读取）。也可以**把任意 results JSON 拖进页面**。页面右上角可切换中 / 英文。

---

## Metrics · 指标说明

| Metric · 指标 | Description · 说明 |
|---|---|
| **Run time** · 运行时间 | Median of multiple runs after warmup. Hover any bar for mean / stddev / min / max. · 预热后多次运行的中位数，悬停可看 mean / stddev / min / max。 |
| **Peak memory** · 内存峰值 | CLI: max RSS via `/usr/bin/time -l`. Servers: max of `ps` samples every 200ms during load test. · CLI 用 `/usr/bin/time -l` 的 max RSS；服务型压测期间每 200ms 采样 `ps` 的最大值。 |
| **Build time** · 构建时间 | Wall time of `go build` / `cargo build --release`. **First Rust build includes all dependencies** — `cargo clean` first for a cold-build measurement. · Rust 首次构建包含全部依赖编译，想测冷构建先 `cargo clean`。 |
| **Artifact size** · 产物体积 | Stripped binaries for Go/Rust. Node has no binary, so the source file size is recorded (the runtime itself is ~80 MB — keep that in mind when comparing). · Go/Rust 为 strip 后的二进制；Node 记录源码文件大小（运行时约 80 MB，对比时要有数）。 |

---

## Fairness Notes · 公平性备注

> Read this before drawing conclusions. · 读结论前必看。

- **Rust** builds with `--release` + strip. **Go** with `-ldflags="-s -w"`. **Node** relies on the V8 JIT — warmup rounds ensure hot code is compiled. · Rust 用 `--release` + strip，Go 用 `-ldflags="-s -w"`；Node 由 V8 JIT，预热轮次保证热代码已编译。
- **JSON benchmark**: Go/Rust use typed structs (idiomatic). JS uses dynamic objects — that's how each language is actually used, not an unfairness. · Go/Rust 走类型化结构体（idiomatic），JS 走动态对象——这是各语言的实际用法。
- **HTTP / SSE**: Node and Go use their standard libraries. Rust's standard library has no HTTP server, so it uses the de-facto community standard **axum** (+ tokio). · Node 和 Go 用标准库；Rust 标准库没有 HTTP 服务器，用社区事实标准 axum（+ tokio）。
- **Load-test clients** (autocannon / custom SSE client) are Node.js, applied identically to all three servers. · 压测客户端本身是 Node，对三个被测服务一视同仁。
- **Same machine**, plugged in, heavy background programs closed. The results JSON records CPU / memory / language versions — never mix numbers from different machines. · 同一台机器、插电、关闭重负载程序；结果 JSON 记录了 CPU / 内存 / 各语言版本，跨机器数据勿混用。

---

## Project Structure · 项目结构

```
lang-bench/
├── benchmarks/           # 三语言等价实现 · equivalent 3-lang implementations
│   ├── fib/              #   {node,go,rust}/main.{mjs,go,rs}
│   ├── json-parse/
│   ├── vector-topk/
│   ├── text-chunk/
│   ├── http-server/
│   └── sse-stream/
├── runner/               # 调度器 · runner
│   ├── run.mjs           #   构建 → 预热 → 计时 → 采集 → JSON
│   ├── config.mjs        #   用例注册表 · benchmark registry
│   ├── gen-fixtures.mjs  #   生成测试数据 · fixture generator
│   └── sse-client.mjs    #   SSE 并发客户端 · concurrent SSE client
├── web/                  # 可视化页面 · visualization
│   ├── index.html        #   柱状图对比 + 中英切换 · bar-chart comparison
│   └── serve.mjs         #   极简静态服务器 · minimal static server
├── fixtures/             # 测试数据（自动生成）· test data (auto-generated)
├── results/              # 跑分结果 JSON · benchmark result JSONs
├── bin/                  # Go 编译产物 · compiled Go binaries
└── package.json
```

---

## Adding a Benchmark · 新增用例

1. Write three equivalent implementations under `benchmarks/<name>/{node,go,rust}`:
   - **CLI type**: args in → verification value printed to stdout.
   - **Server type**: read the `PORT` env var, expose `GET /ping`, print `READY <port>` to stderr once listening.
   - 在 `benchmarks/<name>/{node,go,rust}` 下写三份等价实现：CLI 型参数进、校验值出；服务型读 `PORT` 环境变量、提供 `GET /ping`、就绪后打印 `READY <port>`。
2. Register it in `runner/config.mjs` (`type: 'cli' | 'http' | 'sse'`, default args and quick args). · 在 `runner/config.mjs` 注册。
3. Add a title line to `I18N.*.bench` in `web/index.html` and it will show up. · 在页面的 `I18N.*.bench` 加一行标题即可显示。

---

## License

MIT
