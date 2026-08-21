import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFields = Record<string, unknown>;

const REDACTED = '[REDACTED]';
const sensitiveKeyPattern =
  /password|passcode|token|authorization|cookie|secret|api[-_]?key|credential|private[-_]?key/i;

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

const redactString = (value: string): string =>
  value
    .replace(/(Bearer\s+)[^\s"',]+/gi, `$1${REDACTED}`)
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, `$1${REDACTED}@`)
    .replace(
      /((?:password|passcode|token|secret|api[-_]?key)\s*[=:]\s*)[^\s,;]+/gi,
      `$1${REDACTED}`
    );

const sanitizeValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value instanceof Error) {
    if (seen.has(value)) return '[Circular Error]';
    seen.add(value);
    const errorCause = (value as Error & { cause?: unknown }).cause;
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(errorCause ? { cause: sanitizeValue(errorCause, seen) } : {}),
    };
  }

  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'bigint') return value.toString();
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? REDACTED : sanitizeValue(item, seen),
    ])
  );
};

const writeLog = (level: LogLevel, event: string, fields: LogFields = {}): void => {
  const entry = sanitizeValue({
    timestamp: new Date().toISOString(),
    level,
    service: 'hikmahsphere-backend',
    environment: process.env.NODE_ENV || 'development',
    event,
    ...fields,
  });

  if (isProduction()) {
    const output = `${JSON.stringify(entry)}\n`;
    (level === 'error' ? process.stderr : process.stdout).write(output);
    return;
  }

  const details = Object.keys(fields).length > 0 ? ` ${JSON.stringify(sanitizeValue(fields))}` : '';
  const output = `${new Date().toISOString()} ${level.toUpperCase()} ${event}${details}\n`;
  (level === 'error' ? process.stderr : process.stdout).write(output);
};

export const appLogger = {
  debug: (event: string, fields?: LogFields) => writeLog('debug', event, fields),
  info: (event: string, fields?: LogFields) => writeLog('info', event, fields),
  warn: (event: string, fields?: LogFields) => writeLog('warn', event, fields),
  error: (event: string, fields?: LogFields) => writeLog('error', event, fields),
};

const formatConsoleArguments = (args: unknown[]): LogFields => {
  const error = args.find((arg): arg is Error => arg instanceof Error);
  const message = args
    .filter((arg) => !(arg instanceof Error))
    .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(sanitizeValue(arg))))
    .join(' ')
    .trim();

  return {
    message: message || error?.message || 'Application log',
    ...(error ? { error } : {}),
  };
};

let consoleBridgeInstalled = false;

/**
 * Render captures stdout/stderr. In production, bridge legacy console calls into
 * one-line JSON so logs from routes and services remain searchable and parseable.
 */
export const installProductionConsoleBridge = (): void => {
  if (!isProduction() || consoleBridgeInstalled) return;
  consoleBridgeInstalled = true;

  console.log = (...args: unknown[]) => appLogger.info('application_log', formatConsoleArguments(args));
  console.info = (...args: unknown[]) => appLogger.info('application_log', formatConsoleArguments(args));
  console.warn = (...args: unknown[]) => appLogger.warn('application_log', formatConsoleArguments(args));
  console.error = (...args: unknown[]) => appLogger.error('application_log', formatConsoleArguments(args));
  console.debug = (...args: unknown[]) => appLogger.debug('application_log', formatConsoleArguments(args));
};

const requestIdFrom = (req: Request): string => {
  const incoming = req.get('x-request-id')?.trim();
  return incoming && /^[A-Za-z0-9._-]{1,128}$/.test(incoming) ? incoming : randomUUID();
};

const requestFields = (req: Request, res: Response, requestId: string, startedAt: bigint): LogFields => {
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  const authenticatedRequest = req as Request & { user?: { userId?: string } };

  return {
    requestId,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    durationMs: Number(durationMs.toFixed(2)),
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent') || undefined,
    userId: authenticatedRequest.user?.userId,
    responseBytes: res.get('content-length') || undefined,
  };
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = process.hrtime.bigint();
  const requestId = requestIdFrom(req);
  let completed = false;

  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.once('finish', () => {
    completed = true;
    const fields = requestFields(req, res, requestId, startedAt);
    if (res.statusCode >= 500) {
      appLogger.error('http_request_completed', fields);
    } else if (res.statusCode >= 400) {
      appLogger.warn('http_request_completed', fields);
    } else {
      appLogger.info('http_request_completed', fields);
    }
  });

  res.once('close', () => {
    if (!completed) {
      appLogger.warn('http_request_aborted', requestFields(req, res, requestId, startedAt));
    }
  });

  next();
};

export const errorLogger = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = err instanceof Error ? err : new Error(String(err));
  appLogger.error('http_request_error', {
    requestId: res.locals.requestId,
    method: req.method,
    path: req.path,
    statusCode: (err as { status?: number })?.status || 500,
    userId: (req as Request & { user?: { userId?: string } }).user?.userId,
    error,
  });
  next(err);
};

export const logStartup = (port: number): void => {
  appLogger.info('server_started', {
    port,
    host: '0.0.0.0',
    nodeVersion: process.version,
  });
};

/**
 * Summarize a MongoDB URI without exposing credentials or the full connection string.
 */
export const summarizeMongoUri = (uri: string): { host: string; database: string } => {
  try {
    const normalized = uri.replace(/^mongodb(\+srv)?:\/\//i, 'http://');
    const parsed = new URL(normalized);
    const database = parsed.pathname.replace(/^\//, '').split('?')[0] || '(default)';
    const hostname = parsed.hostname || '(unknown)';
    const host = hostname.endsWith('.mongodb.net') ? 'MongoDB Atlas' : hostname;
    return { host, database };
  } catch {
    return { host: '(unknown)', database: '(unknown)' };
  }
};

export const logDatabaseConnection = (uri: string, resolvedDatabase?: string): void => {
  const { host, database } = summarizeMongoUri(uri);
  appLogger.info('database_connected', {
    host,
    database: resolvedDatabase || database,
  });
};
