// 基准用例定义。args 里的 {ROOT} 会被替换为仓库根目录绝对路径。
export const benches = {
  fib: {
    type: 'cli',
    title: '递归 Fibonacci(CPU 密集)',
    args: ['35'],
    quickArgs: ['32'],
  },
  'json-parse': {
    type: 'cli',
    title: 'JSON 解析 + 序列化(约 9MB 事件数据)',
    fixtures: ['events.json'],
    args: ['{ROOT}/fixtures/events.json', '10'],
    quickArgs: ['{ROOT}/fixtures/events.json', '3'],
  },
  'vector-topk': {
    type: 'cli',
    title: '向量相似度 top-k 检索(RAG)',
    args: ['20000', '256', '50'],
    quickArgs: ['8000', '128', '20'],
  },
  'text-chunk': {
    type: 'cli',
    title: '文档切块 + 哈希(RAG)',
    fixtures: ['corpus.txt'],
    args: ['{ROOT}/fixtures/corpus.txt', '400', '50', '5'],
    quickArgs: ['{ROOT}/fixtures/corpus.txt', '400', '50', '2'],
  },
  'http-server': {
    type: 'http',
    title: 'HTTP 工具调用网关(agent tool call)',
    load: { method: 'POST', path: '/tool', connections: 64, duration: 10, quickDuration: 3 },
  },
  'sse-stream': {
    type: 'sse',
    title: 'SSE 流式响应(LLM token 流转发)',
    load: { events: 200, streams: 512, quickStreams: 128, concurrency: 32 },
  },
};
