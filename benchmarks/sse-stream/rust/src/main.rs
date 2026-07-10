// LLM 流式响应转发(SSE),与 node/go 实现的事件格式一致。
use std::convert::Infallible;

use axum::extract::Query;
use axum::response::sse::{Event, Sse};
use axum::routing::get;
use axum::Router;
use futures::stream::{self, Stream};
use serde::Deserialize;

#[derive(Deserialize)]
struct StreamParams {
    n: Option<usize>,
}

async fn stream_handler(
    Query(params): Query<StreamParams>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let n = params.n.unwrap_or(200);
    let events = (0..n)
        .map(|i| Ok(Event::default().data(format!("{{\"token\":\"tok_{i}\",\"idx\":{i}}}"))))
        .chain(std::iter::once(Ok(Event::default().data("[DONE]"))));
    Sse::new(stream::iter(events))
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8301);
    let app = Router::new()
        .route("/ping", get(|| async { "pong" }))
        .route("/stream", get(stream_handler));
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await.unwrap();
    println!("READY {port}");
    axum::serve(listener, app).await.unwrap();
}
