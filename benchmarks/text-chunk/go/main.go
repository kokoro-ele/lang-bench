// RAG 场景:文档切块 + FNV-1a 哈希,与 node/rust 实现逐行对应。
package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

func fnv1a(s string, h uint32) uint32 {
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}

func argInt(i, def int) int {
	if len(os.Args) > i {
		if v, err := strconv.Atoi(os.Args[i]); err == nil {
			return v
		}
	}
	return def
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: text-chunk <corpus.txt> [chunkSize] [overlap] [iterations]")
		os.Exit(1)
	}
	path := os.Args[1]
	chunkSize := argInt(2, 400)
	overlap := argInt(3, 50)
	iterations := argInt(4, 5)
	raw, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	text := string(raw)

	var acc uint32
	tokenCount, chunkCount := 0, 0
	for it := 0; it < iterations; it++ {
		tokens := strings.Fields(text)
		tokenCount = len(tokens)
		step := chunkSize - overlap
		chunks := 0
		for start := 0; start < len(tokens); start += step {
			end := start + chunkSize
			if end > len(tokens) {
				end = len(tokens)
			}
			chunk := strings.Join(tokens[start:end], " ")
			acc ^= fnv1a(chunk, 2166136261)
			chunks++
			if end == len(tokens) {
				break
			}
		}
		chunkCount = chunks
	}
	fmt.Printf("tokens=%d chunks=%d hash=%d\n", tokenCount, chunkCount, acc)
}
