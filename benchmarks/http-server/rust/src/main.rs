// Agent 工具调用网关,与 node/go 实现的路由和响应一致。
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Default)]
struct ToolArgs {
    #[serde(default)]
    text: String,
    #[serde(default)]
    #[allow(dead_code)]
    max: i64,
}

#[derive(Deserialize)]
struct ToolCall {
    name: String,
    #[serde(default)]
    args: ToolArgs,
}

#[derive(Serialize)]
struct ToolResult {
    ok: bool,
    name: String,
    len: usize,
    hash: u32,
}

fn fnv1a(bytes: &[u8]) -> u32 {
    let mut h: u32 = 2166136261;
    for &b in bytes {
        h ^= b as u32;
        h = h.wrapping_mul(16777619);
    }
    h
}

async fn tool(Json(call): Json<ToolCall>) -> Json<ToolResult> {
    let hash = fnv1a(call.args.text.as_bytes());
    Json(ToolResult {
        ok: true,
        name: call.name,
        len: call.args.text.len(),
        hash,
    })
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8301);
    let app = Router::new()
        .route("/ping", get(|| async { "pong" }))
        .route("/tool", post(tool));
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await.unwrap();
    println!("READY {port}");
    axum::serve(listener, app).await.unwrap();
}
