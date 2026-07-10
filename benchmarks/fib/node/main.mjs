const n = Number(process.argv[2] ?? 35);

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

console.log(`fib(${n})=${fib(n)}`);
