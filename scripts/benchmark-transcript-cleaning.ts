import { hrtime } from 'node:process';

import { cleanCanonicalTranscript } from '../src/modules/sessions/usecases/disfluencies';

const NORMAL_ITERATIONS = 50_000;
const MAX_ITERATIONS = 5_000;
const P95_BUDGET_MS = 1;

interface BenchmarkResult {
  name: string;
  inputLength: number;
  iterations: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  checksum: number;
}

function percentile(sorted: readonly number[], value: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * value) - 1),
  );
  return sorted[index] ?? Number.NaN;
}

function runBenchmark(
  name: string,
  input: string,
  iterations: number,
): BenchmarkResult {
  for (let index = 0; index < Math.min(iterations, 5_000); index += 1) {
    cleanCanonicalTranscript(input);
  }

  const samples = new Array<number>(iterations);
  let checksum = 0;
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = hrtime.bigint();
    const result = cleanCanonicalTranscript(input);
    const elapsedNs = hrtime.bigint() - startedAt;
    samples[index] = Number(elapsedNs) / 1_000_000;
    checksum = (checksum + result.text.length) % 1_000_000_007;
  }
  samples.sort((left, right) => left - right);

  return {
    name,
    inputLength: input.length,
    iterations,
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    p99Ms: percentile(samples, 0.99),
    checksum,
  };
}

const normalInput = 'né? hoje hoje aula com Ana Né e o tipo assim definido.';
const maxInput =
  `${'hum... comunicação comunicação acessível. '.repeat(150)}`.slice(0, 5_000);
const maxPreservationInput =
  `${'Esse tipo de dado seguro permanece íntegro. '.repeat(150)}`.slice(
    0,
    5_000,
  );
const results = [
  runBenchmark('normal', normalInput, NORMAL_ITERATIONS),
  runBenchmark('max-5000-removal', maxInput, MAX_ITERATIONS),
  runBenchmark('max-5000-preservation', maxPreservationInput, MAX_ITERATIONS),
];

console.log(JSON.stringify({ p95BudgetMs: P95_BUDGET_MS, results }, null, 2));

if (results.some((result) => result.p95Ms > P95_BUDGET_MS)) {
  process.exitCode = 1;
}
