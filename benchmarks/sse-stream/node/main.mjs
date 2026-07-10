// LLM 流式响应转发:GET /stream?n=200 以 SSE 形式全速吐出 n 个 token 事件,
// 用来测各语言 HTTP 框架的流式写出开销。事件格式三种语言完全一致。
import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? process.argv[2] ?? 8301);

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/ping') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('pong');
    return;
  }
  if (req.method === 'GET' && url.pathname === '/stream') {
    const n = Number(url.searchParams.get('n') ?? 200);
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
    });
    for (let i = 0; i < n; i++) {
      res.write(`data: {"token":"tok_${i}","idx":${i}}\n\n`);
    }
    res.end('data: [DONE]\n\n');
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(port, '127.0.0.1', () => {
  console.log(`READY ${port}`);
});
