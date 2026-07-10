package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
)

type props struct {
	Depth  int64  `json:"depth"`
	Source string `json:"source"`
}

type event struct {
	ID     int64    `json:"id"`
	User   string   `json:"user"`
	Event  string   `json:"event"`
	Amount float64  `json:"amount"`
	Ts     int64    `json:"ts"`
	Tags   []string `json:"tags"`
	Props  props    `json:"props"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: json-parse <fixture.json> [iterations]")
		os.Exit(1)
	}
	path := os.Args[1]
	iterations := 10
	if len(os.Args) > 2 {
		if v, err := strconv.Atoi(os.Args[2]); err == nil {
			iterations = v
		}
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}

	total := 0.0
	outLen := 0
	for i := 0; i < iterations; i++ {
		var events []event
		if err := json.Unmarshal(raw, &events); err != nil {
			panic(err)
		}
		sum := 0.0
		for _, e := range events {
			sum += e.Amount
		}
		total += sum
		out, err := json.Marshal(events)
		if err != nil {
			panic(err)
		}
		outLen = len(out)
	}
	fmt.Printf("sum=%.2f out=%d\n", total, outLen)
}
