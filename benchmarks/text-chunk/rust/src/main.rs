// RAG 场景:文档切块 + FNV-1a 哈希,与 node/go 实现逐行对应。
fn fnv1a(s: &str, mut h: u32) -> u32 {
    for b in s.bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(16777619);
    }
    h
}

fn main() {
    let mut args = std::env::args().skip(1);
    let path = args.next().expect("usage: text-chunk <corpus.txt> [chunkSize] [overlap] [iterations]");
    let chunk_size: usize = args.next().and_then(|s| s.parse().ok()).unwrap_or(400);
    let overlap: usize = args.next().and_then(|s| s.parse().ok()).unwrap_or(50);
    let iterations: usize = args.next().and_then(|s| s.parse().ok()).unwrap_or(5);
    let text = std::fs::read_to_string(&path).unwrap();

    let mut acc: u32 = 0;
    let mut token_count = 0;
    let mut chunk_count = 0;
    for _ in 0..iterations {
        let tokens: Vec<&str> = text.split_whitespace().collect();
        token_count = tokens.len();
        let step = chunk_size - overlap;
        let mut chunks = 0;
        let mut start = 0;
        while start < tokens.len() {
            let end = (start + chunk_size).min(tokens.len());
            let chunk = tokens[start..end].join(" ");
            acc ^= fnv1a(&chunk, 2166136261);
            chunks += 1;
            if end == tokens.len() {
                break;
            }
            start += step;
        }
        chunk_count = chunks;
    }
    println!("tokens={token_count} chunks={chunk_count} hash={acc}");
}
