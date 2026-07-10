// LLM 流式响应转发(SSE),与 node/rust 实现的事件格式一致。
package main

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8301"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ping", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("pong"))
	})
	mux.HandleFunc("GET /stream", func(w http.ResponseWriter, r *http.Request) {
		n := 200
		if q := r.URL.Query().Get("n"); q != "" {
			if v, err := strconv.Atoi(q); err == nil {
				n = v
			}
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		flusher, _ := w.(http.Flusher)
		for i := 0; i < n; i++ {
			fmt.Fprintf(w, "data: {\"token\":\"tok_%d\",\"idx\":%d}\n\n", i, i)
			if flusher != nil {
				flusher.Flush()
			}
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
	})
	fmt.Printf("READY %s\n", port)
	if err := http.ListenAndServe("127.0.0.1:"+port, mux); err != nil {
		panic(err)
	}
}
