// RAG 场景:暴力余弦相似度 top-k 检索,与 node/rust 实现逐行对应。
package main

import (
	"fmt"
	"math"
	"os"
	"strconv"
)

var state uint32 = 42

func next() float64 {
	state ^= state << 13
	state ^= state >> 17
	state ^= state << 5
	return float64(state) / 4294967296.0
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
	n := argInt(1, 20000)
	d := argInt(2, 256)
	q := argInt(3, 50)
	const k = 10

	db := make([]float64, n*d)
	for i := range db {
		db[i] = next() - 0.5
	}
	queries := make([]float64, q*d)
	for i := range queries {
		queries[i] = next() - 0.5
	}

	norms := make([]float64, n)
	for i := 0; i < n; i++ {
		s := 0.0
		for j := 0; j < d; j++ {
			v := db[i*d+j]
			s += v * v
		}
		norms[i] = math.Sqrt(s)
	}

	checksum := 0
	bestS := make([]float64, k)
	bestI := make([]int, k)
	for qi := 0; qi < q; qi++ {
		for j := 0; j < k; j++ {
			bestS[j] = math.Inf(-1)
			bestI[j] = -1
		}
		qn := 0.0
		for j := 0; j < d; j++ {
			v := queries[qi*d+j]
			qn += v * v
		}
		qn = math.Sqrt(qn)
		for i := 0; i < n; i++ {
			dot := 0.0
			off := i * d
			qoff := qi * d
			for j := 0; j < d; j++ {
				dot += db[off+j] * queries[qoff+j]
			}
			s := dot / (qn * norms[i])
			if s > bestS[k-1] {
				p := k - 1
				for p > 0 && bestS[p-1] < s {
					bestS[p] = bestS[p-1]
					bestI[p] = bestI[p-1]
					p--
				}
				bestS[p] = s
				bestI[p] = i
			}
		}
		for j := 0; j < k; j++ {
			checksum += bestI[j]
		}
	}
	fmt.Printf("checksum=%d\n", checksum)
}
