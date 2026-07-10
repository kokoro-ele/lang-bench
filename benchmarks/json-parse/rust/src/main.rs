use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct Props {
    depth: i64,
    source: String,
}

#[derive(Serialize, Deserialize)]
struct Event {
    id: i64,
    user: String,
    event: String,
    amount: f64,
    ts: i64,
    tags: Vec<String>,
    props: Props,
}

fn main() {
    let mut args = std::env::args().skip(1);
    let path = args.next().expect("usage: json-parse <fixture.json> [iterations]");
    let iterations: usize = args.next().and_then(|s| s.parse().ok()).unwrap_or(10);
    let raw = std::fs::read_to_string(&path).unwrap();

    let mut total = 0.0f64;
    let mut out_len = 0usize;
    for _ in 0..iterations {
        let events: Vec<Event> = serde_json::from_str(&raw).unwrap();
        let sum: f64 = events.iter().map(|e| e.amount).sum();
        total += sum;
        out_len = serde_json::to_string(&events).unwrap().len();
    }
    println!("sum={total:.2} out={out_len}");
}
