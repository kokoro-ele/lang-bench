# lang-bench

> Node.js / Go / Rust 性能对比工具包 — 同一组用例的三语言等价实现、统一调度器、可视化页面。

<p align="center">
  <a href="README.md">English</a>
  &nbsp;|&nbsp;
  <a href="#用例">用例</a> · <a href="#快速开始">快速开始</a> · <a href="#指标说明">指标说明</a> · <a href="#公平性备注">公平性备注</a>
</p>

---

## 用例

| Benchmark | 类型 | 场景 | 主要指标 |
|---|---|---|---|
| `fib` | CLI | 递归 Fibonacci，纯 CPU 密集 | 运行时间 |
| `json-parse` | CLI | 解析 + 序列化约 9 MB 事件 JSON | 运行时间、内存 |
| `vector-topk` | CLI | RAG 向量相似度暴力检索：20k × 256 维 cosine top-10 | 运行时间 |
| `text-chunk` | CLI | RAG 文档切块 + 哈希：滑动窗口分词 | 运行时间、内存 |
| `http-server` | 服务 | Agent 工具调用网关：POST JSON → 解析 → 计算 → JSON | req/s、p50/p99 延迟 |
| `sse-stream` | 服务 | LLM token 流转发（SSE）并发消费 | events/s、TTFB |

每个 CLI 用例三种语言输出**相同的校验值**（checksum / hash / sum），跑分前先确认三者一致——"跑得快"绝不等于"算错了"。

---

## 快速开始

### 依赖

| 工具 | 版本 | 备注 |
|---|---|---|
| **Node.js** | ≥ 20 | 调度器与可视化 |
| **Go** | ≥ 1.22 | |
| **Rust** | rustup (stable) | |
| **hyperfine** | 可选 | `brew install hyperfine` — 更严谨的计时 |

```bash
npm install          # 安装 autocannon（HTTP 压测）
npm run bench:quick  # 小参数快速跑一遍（首次编译，Rust 较慢）
npm run serve        # 打开 http://localhost:4173 查看可视化
npm run bench        # 正式参数完整跑
```

### 只跑部分

```bash
# 指定用例
node runner/run.mjs fib vector-topk --lang=go,rust

# 快速模式
node runner/run.mjs http-server --quick

# 自定义重复次数
node runner/run.mjs fib --runs=20
```

结果写入 `results/run-<时间戳>.json`，并同步到 `results/latest.json`（页面默认读取）。也可以**把任意 results JSON 拖进页面**。页面右上角可切换中 / 英文。

---

## 指标说明

| 指标 | 说明 |
|---|---|
| **运行时间** | 预热后多次运行的中位数，悬停可看 mean / stddev / min / max。 |
| **内存峰值** | CLI 用 `/usr/bin/time -l` 的 max RSS；服务型压测期间每 200ms 采样 `ps` 的最大值。 |
| **构建时间** | `go build` / `cargo build --release` 的耗时。Rust 首次构建包含全部依赖编译，想测冷构建先 `cargo clean`。 |
| **产物体积** | Go/Rust 为 strip 后的二进制；Node 记录源码文件大小（运行时约 80 MB，对比时要有数）。 |

---

## 公平性备注

> 读结论前必看。

- **Rust** 用 `--release` + strip，**Go** 用 `-ldflags="-s -w"`；**Node** 由 V8 JIT，预热轮次保证热代码已编译。
- **JSON 用例**：Go/Rust 走类型化结构体（idiomatic），JS 走动态对象——这是各语言的实际用法，并非不公平。
- **HTTP / SSE**：Node 和 Go 用标准库；Rust 标准库没有 HTTP 服务器，用社区事实标准 **axum**（+ tokio）。
- **压测客户端**（autocannon / 自定义 SSE 客户端）本身是 Node，对三个被测服务一视同仁。
- **同一台机器**、插电、关闭重负载程序；结果 JSON 记录了 CPU / 内存 / 各语言版本，跨机器数据勿混用。

---

## 项目结构

```
lang-bench/
├── benchmarks/           # 三语言等价实现
│   ├── fib/              #   {node,go,rust}/main.{mjs,go,rs}
│   ├── json-parse/
│   ├── vector-topk/
│   ├── text-chunk/
│   ├── http-server/
│   └── sse-stream/
├── runner/               # 调度器
│   ├── run.mjs           #   构建 → 预热 → 计时 → 采集 → JSON
│   ├── config.mjs        #   用例注册表
│   ├── gen-fixtures.mjs  #   生成测试数据
│   └── sse-client.mjs    #   SSE 并发客户端
├── web/                  # 可视化页面
│   ├── index.html        #   柱状图对比 + 中英切换
│   └── serve.mjs         #   极简静态服务器
├── fixtures/             # 测试数据（自动生成）
├── results/              # 跑分结果 JSON
├── bin/                  # Go 编译产物
└── package.json
```

---

## 新增用例

1. 在 `benchmarks/<name>/{node,go,rust}` 下写三份等价实现：
   - **CLI 型**：参数进 → 校验值出，打印到 stdout。
   - **服务型**：读 `PORT` 环境变量、提供 `GET /ping`、就绪后打印 `READY <port>` 到 stderr。
2. 在 `runner/config.mjs` 注册（`type: 'cli' | 'http' | 'sse'`，默认参数和快速参数）。
3. 在页面 `web/index.html` 的 `I18N.*.bench` 加一行标题即可显示。

---

## License

MIT
