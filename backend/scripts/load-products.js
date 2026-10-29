const baseUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const totalRequests = Math.max(Number(process.env.LOAD_REQUESTS) || 100, 1);
const concurrency = Math.min(Math.max(Number(process.env.LOAD_CONCURRENCY) || 10, 1), totalRequests);

async function worker(queue, results) {
  while (queue.length > 0) {
    const index = queue.shift();
    const startedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}/api/products?page=1&limit=12`);
      results[index] = { ok: response.ok, duration: performance.now() - startedAt };
    } catch (error) {
      results[index] = { ok: false, duration: performance.now() - startedAt, error: error.message };
    }
  }
}

async function run() {
  const queue = Array.from({ length: totalRequests }, (_, index) => index);
  const results = new Array(totalRequests);
  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker(queue, results)));
  const elapsed = performance.now() - startedAt;
  const successful = results.filter((result) => result.ok);
  const durations = successful.map((result) => result.duration).sort((a, b) => a - b);
  const percentile95 = durations[Math.max(Math.ceil(durations.length * 0.95) - 1, 0)] || 0;
  const failureCount = totalRequests - successful.length;

  console.log(JSON.stringify({ endpoint: '/api/products', totalRequests, concurrency, successful: successful.length, failureCount, requestsPerSecond: Number((totalRequests / (elapsed / 1000)).toFixed(2)), p95Ms: Number(percentile95.toFixed(2)) }, null, 2));
  if (failureCount > 0) process.exitCode = 1;
}

run();
