function createTenantRateLimiter({ windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000, max = Number(process.env.RATE_LIMIT_MAX) || 300, now = Date.now } = {}) {
  const buckets = new Map();
  return function tenantRateLimit(req, res, next) {
    const tenantId = req.tenant?.id;
    if (!tenantId) return next();
    const key = `${tenantId}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const timestamp = now();
    let bucket = buckets.get(key);
    if (!bucket || timestamp >= bucket.resetAt) bucket = { count: 0, resetAt: timestamp + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.set('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000))));
      return res.status(429).json({ error: 'Limite de requisicoes excedido para esta loja.' });
    }
    if (buckets.size > 10000) {
      for (const [bucketKey, value] of buckets) if (timestamp >= value.resetAt) buckets.delete(bucketKey);
    }
    return next();
  };
}

module.exports = { createTenantRateLimiter };
