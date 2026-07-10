// Agent 工具调用网关,与 node/rust 实现的路由和响应一致。
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type toolArgs struct {
	Text string `json:"text"`
	Max  int    `json:"max"`
}

type toolCall struct {
	Name string   `json:"name"`
	Args toolArgs `json:"args"`
}

type toolResult struct {
	Ok   bool   `json:"ok"`
	Name string `json:"name"`
	Len  int    `json:"len"`
	Hash uint32 `json:"hash"`
}

func fnv1a(s string) uint32 {
	h := uint32(2166136261)
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8301"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ping", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("pong"))
	})
	mux.HandleFunc("POST /tool", func(w http.ResponseWriter, r *http.Request) {
		var call toolCall
		if err := json.NewDecoder(r.Body).Decode(&call); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"ok":false}`))
			return
		}
		res := toolResult{Ok: true, Name: call.Name, Len: len(call.Args.Text), Hash: fnv1a(call.Args.Text)}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(res)
	})
	fmt.Printf("READY %s\n", port)
	if err := http.ListenAndServe("127.0.0.1:"+port, mux); err != nil {
		panic(err)
	}
}
