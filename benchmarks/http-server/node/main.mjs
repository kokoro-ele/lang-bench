// Agent 工具调用网关:POST /tool 接收 {"name","args":{"text","max"}},
// 解析 JSON、对 text 算 FNV-1a 哈希、返回 JSON 结果。三种语言路由与响应完全一致。
import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? process.argv[2] ?? 8301);

function fnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = (h ^ str.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('pong');
    return;
  }
  if (req.method === 'POST' && req.url === '/tool') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const text = String(body.args?.text ?? '');
        const out = JSON.stringify({
          ok: true,
          name: body.name,
          len: text.length,
          hash: fnv1a(text),
        });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(out);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end('{"ok":false}');
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(port, '127.0.0.1', () => {
  console.log(`READY ${port}`);
});
