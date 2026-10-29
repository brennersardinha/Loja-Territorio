const buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
const requests = new Map();
const durations = new Map();
const operational = new Map();
const gauges = new Map();
function incrementMetric(name, labels={}) { const key=JSON.stringify([name,labels]); operational.set(key,(operational.get(key)||0)+1); }
function setGauge(name, value, labels={}) { gauges.set(JSON.stringify([name,labels]), Number(value)); }

function labelsKey(method, route, status) {
  return JSON.stringify([method, route, status]);
}

function routeLabel(req) {
  if (req.route?.path) return `${req.baseUrl || ''}${req.route.path}`;
  return 'unmatched';
}

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next();
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const labels = labelsKey(req.method, routeLabel(req), String(res.statusCode));
    requests.set(labels, (requests.get(labels) || 0) + 1);
    const observation = durations.get(labels) || { count: 0, sum: 0, buckets: buckets.map(() => 0) };
    observation.count += 1;
    observation.sum += duration;
    buckets.forEach((bucket, index) => {
      if (duration <= bucket) observation.buckets[index] += 1;
    });
    durations.set(labels, observation);
    const tenantId = req.tenant?.id || 'unresolved';
    incrementMetric('tenant_requests', { tenant_id: tenantId });
    if (res.statusCode >= 400) incrementMetric('tenant_errors', { tenant_id: tenantId, status_class: `${Math.floor(res.statusCode / 100)}xx` });
    if (/checkout|payment/i.test(req.path)) incrementMetric('checkout_payment_requests', { tenant_id: tenantId, result: res.statusCode < 400 ? 'success' : 'error' });
    if (/webhooks?/i.test(req.path)) incrementMetric('webhook_requests', { tenant_id: tenantId, result: res.statusCode < 400 ? 'success' : 'error' });
    if (/domains?/i.test(req.path)) incrementMetric('dns_tls_requests', { tenant_id: tenantId, result: res.statusCode < 400 ? 'success' : 'error' });
  });
  next();
}

function prometheusLabels(key) {
  const [method, route, status] = JSON.parse(key);
  const escapedRoute = route.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `method="${method}",route="${escapedRoute}",status="${status}"`;
}

function renderMetrics() {
  const lines = [
    '# HELP ecommerce_http_requests_total Total de requisicoes HTTP.',
    '# TYPE ecommerce_http_requests_total counter',
  ];
  for (const [key, value] of requests) {
    lines.push(`ecommerce_http_requests_total{${prometheusLabels(key)}} ${value}`);
  }
  lines.push(
    '# HELP ecommerce_http_request_duration_seconds Duracao das requisicoes HTTP.',
    '# TYPE ecommerce_http_request_duration_seconds histogram',
  );
  for (const [key, observation] of durations) {
    const labels = prometheusLabels(key);
    buckets.forEach((bucket, index) => {
      lines.push(`ecommerce_http_request_duration_seconds_bucket{${labels},le="${bucket}"} ${observation.buckets[index]}`);
    });
    lines.push(`ecommerce_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${observation.count}`);
    lines.push(`ecommerce_http_request_duration_seconds_sum{${labels}} ${observation.sum}`);
    lines.push(`ecommerce_http_request_duration_seconds_count{${labels}} ${observation.count}`);
  }
  const memory = process.memoryUsage();
  for(const [key,value] of operational){const[name,labels]=JSON.parse(key),rendered=Object.entries(labels).map(([k,v])=>`${k}="${String(v).replace(/"/g,'\\"')}"`).join(',');lines.push(`ecommerce_${name}_total${rendered?`{${rendered}}`:''} ${value}`);}
  for(const [key,value] of gauges){const[name,labels]=JSON.parse(key),rendered=Object.entries(labels).map(([k,v])=>`${k}="${String(v).replace(/"/g,'\\"')}"`).join(',');lines.push(`ecommerce_${name}${rendered?`{${rendered}}`:''} ${value}`);}
  lines.push(
    '# HELP ecommerce_process_resident_memory_bytes Memoria residente do processo Node.js.',
    '# TYPE ecommerce_process_resident_memory_bytes gauge',
    `ecommerce_process_resident_memory_bytes ${memory.rss}`,
    '# HELP ecommerce_process_uptime_seconds Tempo de atividade do processo Node.js.',
    '# TYPE ecommerce_process_uptime_seconds gauge',
    `ecommerce_process_uptime_seconds ${process.uptime()}`,
  );
  return `${lines.join('\n')}\n`;
}

function metricsHandler(req, res) {
  res.type('text/plain; version=0.0.4; charset=utf-8').send(renderMetrics());
}

function resetMetrics() {
  requests.clear();
  durations.clear();
  operational.clear();
  gauges.clear();
}

module.exports = { metricsMiddleware, metricsHandler, renderMetrics, resetMetrics, incrementMetric, setGauge };
