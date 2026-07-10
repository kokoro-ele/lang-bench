// RAG 场景:暴力余弦相似度 top-k 检索,与 node/go 实现逐行对应。
struct Rng(u32);

impl Rng {
    fn next(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 17;
        self.0 ^= self.0 << 5;
        self.0 as f64 / 4294967296.0
    }
}

fn arg(i: usize, def: usize) -> usize {
    std::env::args().nth(i).and_then(|s| s.parse().ok()).unwrap_or(def)
}

fn main() {
    let n = arg(1, 20000);
    let d = arg(2, 256);
    let q = arg(3, 50);
    const K: usize = 10;

    let mut rng = Rng(42);
    let db: Vec<f64> = (0..n * d).map(|_| rng.next() - 0.5).collect();
    let queries: Vec<f64> = (0..q * d).map(|_| rng.next() - 0.5).collect();

    let norms: Vec<f64> = (0..n)
        .map(|i| {
            let mut s = 0.0;
            for j in 0..d {
                let v = db[i * d + j];
                s += v * v;
            }
            s.sqrt()
        })
        .collect();

    let mut checksum: i64 = 0;
    for qi in 0..q {
        let qv = &queries[qi * d..(qi + 1) * d];
        let mut qn = 0.0;
        for j in 0..d {
            qn += qv[j] * qv[j];
        }
        let qn = qn.sqrt();
        let mut best_s = [f64::NEG_INFINITY; K];
        let mut best_i = [-1i64; K];
        for i in 0..n {
            let row = &db[i * d..(i + 1) * d];
            let mut dot = 0.0;
            for j in 0..d {
                dot += row[j] * qv[j];
            }
            let s = dot / (qn * norms[i]);
            if s > best_s[K - 1] {
                let mut p = K - 1;
                while p > 0 && best_s[p - 1] < s {
                    best_s[p] = best_s[p - 1];
                    best_i[p] = best_i[p - 1];
                    p -= 1;
                }
                best_s[p] = s;
                best_i[p] = i as i64;
            }
        }
        checksum += best_i.iter().sum::<i64>();
    }
    println!("checksum={checksum}");
}
