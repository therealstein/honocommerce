/**
 * Prometheus Metrics
 * Exposes metrics for monitoring
 */

// Simple in-memory metrics store
class MetricsStore {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const key = this.formatKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  setGauge(name: string, labels: Record<string, string> = {}, value: number): void {
    const key = this.formatKey(name, labels);
    this.gauges.set(key, value);
  }

  observeHistogram(name: string, labels: Record<string, string> = {}, value: number): void {
    const key = this.formatKey(name, labels);
    const values = this.histograms.get(key) ?? [];
    values.push(value);
    // Keep last 1000 observations
    if (values.length > 1000) {
      values.shift();
    }
    this.histograms.set(key, values);
  }

  private formatKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  export(): string {
    const lines: string[] = [];

    // Export counters
    for (const [key, value] of this.counters) {
      const name = key.split('{')[0];
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${key} ${value}`);
    }

    // Export gauges
    for (const [key, value] of this.gauges) {
      const name = key.split('{')[0];
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${key} ${value}`);
    }

    // Export histograms as simple summaries
    for (const [key, values] of this.histograms) {
      const name = key.split('{')[0];
      if (values.length === 0) continue;
      
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const sorted = [...values].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      lines.push(`# TYPE ${name} summary`);
      lines.push(`${key}_count ${values.length}`);
      lines.push(`${key}_sum ${sum.toFixed(2)}`);
      lines.push(`${key}_avg ${avg.toFixed(2)}`);
      lines.push(`${key}_p50 ${p50.toFixed(2)}`);
      lines.push(`${key}_p95 ${p95.toFixed(2)}`);
      lines.push(`${key}_p99 ${p99.toFixed(2)}`);
    }

    return lines.join('\n');
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

// Singleton instance
export const metrics = new MetricsStore();

// ============== PREDEFINED METRICS ==============

// HTTP metrics
export const httpRequestsTotal = (method: string, path: string, status: number) => {
  metrics.incrementCounter('http_requests_total', { method, path: sanitizePath(path), status: status.toString() });
};

export const httpRequestDuration = (method: string, path: string, durationMs: number) => {
  metrics.observeHistogram('http_request_duration_ms', { method, path: sanitizePath(path) }, durationMs);
};

export const httpRequestsInProgress = (method: string, path: string, delta: number) => {
  const key = sanitizePath(path);
  // This is a gauge, so we need to track it differently
  // For simplicity, we'll just count active requests
};

// API metrics
export const apiRequestsTotal = (endpoint: string, status: number) => {
  metrics.incrementCounter('api_requests_total', { endpoint, status: status.toString() });
};

// Queue metrics
export const queueJobsTotal = (queue: string, status: string) => {
  metrics.incrementCounter('queue_jobs_total', { queue, status });
};

export const queueJobDuration = (queue: string, durationMs: number) => {
  metrics.observeHistogram('queue_job_duration_ms', { queue }, durationMs);
};

// Database metrics
export const dbQueryDuration = (query: string, durationMs: number) => {
  metrics.observeHistogram('db_query_duration_ms', { query: sanitizeQuery(query) }, durationMs);
};

// ============== HELPERS ==============

const sanitizePath = (path: string): string => {
  // Replace numeric IDs with placeholder
  return path
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid');
};

const sanitizeQuery = (query: string): string => {
  // Get first word as query type
  return query.trim().split(/\s+/)[0].toLowerCase();
};

// ============== EXPORT HANDLER ==============

export const getMetricsExport = (): string => {
  return metrics.export();
};

export default metrics;
