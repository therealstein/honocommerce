/**
 * Structured Logging System
 * Single-line JSON logs for production, pretty format for development
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  request_id?: string;
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

interface LoggerOptions {
  service: string;
  level: LogLevel;
  format: 'json' | 'pretty';
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private service: string;
  private level: LogLevel;
  private format: 'json' | 'pretty';

  constructor(options: Partial<LoggerOptions> = {}) {
    this.service = options.service ?? 'honocommerce';
    this.level = (process.env.LOG_LEVEL as LogLevel) ?? options.level ?? 'info';
    this.format = (process.env.LOG_FORMAT as 'json' | 'pretty') ?? options.format ?? 
      (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatEntry(entry: LogEntry): string {
    if (this.format === 'json') {
      // Single-line JSON format
      return JSON.stringify(entry);
    }

    // Pretty format for development
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const service = `[${entry.service}]`;
    let line = `${timestamp} ${level} ${service} ${entry.message}`;

    const meta: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (!['timestamp', 'level', 'service', 'message'].includes(key) && value !== undefined) {
        meta[key] = value;
      }
    }

    if (Object.keys(meta).length > 0) {
      line += ' ' + JSON.stringify(meta);
    }

    return line;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...data,
    };

    // Handle error objects specially
    if (data?.error instanceof Error) {
      entry.error = data.error.message;
      entry.stack = data.error.stack?.replace(/\n/g, '\\n');
      delete entry.error;
    }

    const output = this.formatEntry(entry);

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  private parent: Logger;
  private context: Record<string, unknown>;

  constructor(parent: Logger, context: Record<string, unknown>) {
    this.parent = parent;
    this.context = context;
  }

  private mergeData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!data) return this.context;
    return { ...this.context, ...data };
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.parent.debug(message, this.mergeData(data));
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.parent.info(message, this.mergeData(data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.parent.warn(message, this.mergeData(data));
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.parent.error(message, this.mergeData(data));
  }
}

// Default logger instance
export const logger = new Logger();

/**
 * Create a request-scoped logger
 */
export const createRequestLogger = (requestId: string, method?: string, path?: string) => {
  return logger.child({ request_id: requestId, method, path });
};

/**
 * Log an HTTP request
 */
export const logRequest = (
  requestId: string,
  method: string,
  path: string,
  status: number,
  durationMs: number,
  data?: Record<string, unknown>
): void => {
  const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  
  logger.log(level, `${method} ${path}`, {
    request_id: requestId,
    method,
    path,
    status,
    duration_ms: durationMs,
    ...data,
  });
};

export { Logger };
export default logger;
