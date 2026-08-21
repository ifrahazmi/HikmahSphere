import { randomUUID } from 'crypto';
import { STATUS_CODES } from 'http';
import { Request, Response, NextFunction } from 'express';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFields = Record<string, unknown>;

const REDACTED = '[REDACTED]';
const sensitiveKeyPattern =
  /password|passcode|token|authorization|cookie|secret|api[-_]?key|credential|private[-_]?key/i;

const isProduction = (): boolean => process.env.NODE_ENV === 'production';
const healthCheckPaths = new Set(['/health', '/api/health']);
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Strings longer than this inside a request body are collapsed, so base64 uploads cannot flood a line. */
const BODY_STRING_MAX_CHARS = 200;
/** Only the first frames of a stack are printed; deep traces add volume without adding information. */
const MAX_STACK_FRAMES = 6;
const BUDGET_WINDOW_MS = 60_000;

const positiveEnv = (name: string, fallback: number): number => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const slowRequestMs = (): number => positiveEnv('LOG_SLOW_REQUEST_MS', 1500);
const bodyMaxChars = (): number => positiveEnv('LOG_BODY_MAX_CHARS', 600);
const maxLinesPerMinute = (): number => positiveEnv('LOG_MAX_LINES_PER_MINUTE', 2000);

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

const useColor = (): boolean => process.env.NO_COLOR !== '1';
const colorize = (value: string, color: string): string =>
  useColor() ? `${color}${value}${colors.reset}` : value;
const timestamp = (): string => new Date().toISOString().slice(11, 19);

/** Indented `label   value` line used inside every multi-line block. */
const detailLine = (label: string, value: string): string =>
  `     ${colorize(label.padEnd(9), colors.dim)} ${value}`;

const levelTag = (level: LogLevel): string => {
  switch (level) {
    case 'debug':
      return colorize('DEBUG', colors.dim);
    case 'info':
      return colorize('INFO ', colors.cyan);
    case 'warn':
      return colorize('WARN ', colors.yellow);
    case 'error':
      return colorize('ERROR', colors.red);
  }
};

const redactString = (value: string): string =>
  value
    .replace(/(Bearer\s+)[^\s"',]+/gi, `$1${REDACTED}`)
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, `$1${REDACTED}@`)
    .replace(
      /((?:password|passcode|token|secret|api[-_]?key)\s*[=:]\s*)[^\s,;]+/gi,
      `$1${REDACTED}`
    );

type SanitizeOptions = { maxStringLength?: number };

const sanitizeValue = (
  value: unknown,
  options: SanitizeOptions = {},
  seen = new WeakSet<object>()
): unknown => {
  if (value instanceof Error) {
    if (seen.has(value)) return '[Circular Error]';
    seen.add(value);
    const errorCause = (value as Error & { cause?: unknown }).cause;
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
      ...(errorCause ? { cause: sanitizeValue(errorCause, options, seen) } : {}),
    };
  }

  if (typeof value === 'string') {
    const redacted = redactString(value);
    const limit = options.maxStringLength;
    return limit && redacted.length > limit ? `[${redacted.length} chars omitted]` : redacted;
  }
  if (typeof value === 'bigint') return value.toString();
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, options, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? REDACTED : sanitizeValue(item, options, seen),
    ])
  );
};

const asRecord = (value: unknown): LogFields =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as LogFields) : {};

const fieldText = (fields: LogFields, key: string, fallback = ''): string => {
  const value = fields[key];
  return value === null || typeof value === 'undefined' ? fallback : String(value);
};

const truncate = (value: string, limit: number): string =>
  value.length > limit ? `${value.slice(0, limit)}... +${value.length - limit} chars` : value;

const statusColor = (statusCode: number): string => {
  if (statusCode >= 500) return colors.red;
  if (statusCode >= 400) return colors.yellow;
  if (statusCode >= 300) return colors.cyan;
  return colors.green;
};

const methodColor = (method: string): string =>
  writeMethods.has(method) ? colors.magenta : colors.blue;

const errorDetails = (fields: LogFields): { message: string; stack?: string } => {
  const error = asRecord(fields.error);
  const name = fieldText(error, 'name');
  const message = fieldText(error, 'message', fieldText(fields, 'message', 'Unknown error'));
  return {
    message: name && name !== 'Error' ? `${name}: ${message}` : message,
    ...(typeof error.stack === 'string' ? { stack: error.stack } : {}),
  };
};

const stackFrames = (stack: string): string[] =>
  stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .slice(0, MAX_STACK_FRAMES);

/* ------------------------------------------------------------------ *
 * Line budget
 *
 * Render discards everything above 6,000 log lines per minute per
 * instance. Multi-line blocks are worth it at normal traffic but must
 * never be the reason a log line disappears, so detail collapses back
 * to one-liners once the budget for the current minute is spent.
 * ------------------------------------------------------------------ */

let windowStartedAt = Date.now();
let linesThisWindow = 0;
let suppressedDetailLines = 0;
let collapseWarned = false;

const streamFor = (level: LogLevel): NodeJS.WriteStream =>
  level === 'error' ? process.stderr : process.stdout;

const writeLines = (level: LogLevel, lines: string[]): void => {
  linesThisWindow += lines.length;
  streamFor(level).write(`${lines.join('\n')}\n`);
};

const rollWindowIfNeeded = (): void => {
  if (Date.now() - windowStartedAt < BUDGET_WINDOW_MS) return;

  const carried = suppressedDetailLines;
  windowStartedAt = Date.now();
  linesThisWindow = 0;
  suppressedDetailLines = 0;
  collapseWarned = false;

  if (carried > 0) {
    writeLines('warn', [
      `${colorize(`[${timestamp()}]`, colors.dim)} ${levelTag('warn')}  collapsed ${carried} detail lines in the previous minute`,
    ]);
  }
};

/**
 * Print a log entry, degrading a block to its single-line summary when the
 * per-minute budget is exhausted.
 */
const emit = (level: LogLevel, lines: string[], collapsedLine?: string): void => {
  rollWindowIfNeeded();

  const limit = maxLinesPerMinute();
  const overBudget = linesThisWindow + lines.length > limit;

  if (lines.length > 1 && collapsedLine && overBudget) {
    suppressedDetailLines += lines.length - 1;
    if (!collapseWarned) {
      collapseWarned = true;
      writeLines('warn', [
        `${colorize(`[${timestamp()}]`, colors.dim)} ${levelTag('warn')}  log budget reached (${limit} lines/min), collapsing request detail`,
      ]);
    }
    writeLines(level, [collapsedLine]);
    return;
  }

  writeLines(level, lines);
};

/** Reset the budget window. Used by tests and by manual diagnostics. */
export const resetLogBudget = (): void => {
  windowStartedAt = Date.now();
  linesThisWindow = 0;
  suppressedDetailLines = 0;
  collapseWarned = false;
};

/* ------------------------------------------------------------------ *
 * Application events
 * ------------------------------------------------------------------ */

const eventMessage = (event: string, fields: LogFields): string => {
  switch (event) {
    case 'server_started':
      return 'Server ready';
    case 'database_connected':
      return `MongoDB connected · ${fieldText(fields, 'host')} / ${fieldText(fields, 'database')}`;
    case 'environment_loaded':
      return `Environment loaded · ${fieldText(fields, 'nodeEnvironment', 'development')}`;
    case 'shutdown_started':
      return `Graceful shutdown started · ${fieldText(fields, 'signal')}`;
    case 'shutdown_completed':
      return `Graceful shutdown completed · ${fieldText(fields, 'signal')}`;
    case 'application_log':
      return fieldText(fields, 'message', 'Application warning');
    default: {
      if (fields.error) return `${event.replace(/_/g, ' ')} · ${errorDetails(fields).message}`;
      return fieldText(fields, 'message', event.replace(/_/g, ' '));
    }
  }
};

const eventDetailLines = (level: LogLevel, event: string, fields: LogFields): string[] => {
  if (event === 'server_started') {
    const lines = [
      detailLine(
        'listen',
        `${fieldText(fields, 'host', '0.0.0.0')}:${fieldText(fields, 'port')}  ·  node ${fieldText(fields, 'nodeVersion')}  ·  ${fieldText(fields, 'nodeEnvironment', 'development')}`
      ),
    ];
    const database = fieldText(fields, 'database');
    if (database) lines.push(detailLine('database', database));
    const redis = fieldText(fields, 'redis');
    if (redis) lines.push(detailLine('redis', redis));
    return lines;
  }

  if (level !== 'error') return [];

  const { stack } = errorDetails(fields);
  if (!stack) return [];
  return stackFrames(stack).map((frame) => detailLine('stack', colorize(frame, colors.dim)));
};

const writeLog = (level: LogLevel, event: string, fields: LogFields = {}): void => {
  const safeFields = asRecord(sanitizeValue(fields));
  const header = `${colorize(`[${timestamp()}]`, colors.dim)} ${levelTag(level)}  ${eventMessage(event, safeFields)}`;
  emit(level, [header, ...eventDetailLines(level, event, safeFields)], header);
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
 * Render captures stdout/stderr. Suppress routine legacy chatter in production,
 * while preserving redacted warnings and errors in the readable formatter.
 */
export const installProductionConsoleBridge = (): void => {
  if (!isProduction() || consoleBridgeInstalled) return;
  consoleBridgeInstalled = true;

  console.log = () => undefined;
  console.info = () => undefined;
  console.warn = (...args: unknown[]) => appLogger.warn('application_log', formatConsoleArguments(args));
  console.error = (...args: unknown[]) => appLogger.error('application_log', formatConsoleArguments(args));
  console.debug = () => undefined;
};

/* ------------------------------------------------------------------ *
 * Request logging
 * ------------------------------------------------------------------ */

const requestIdFrom = (req: Request): string => {
  const incoming = req.get('x-request-id')?.trim();
  return incoming && /^[A-Za-z0-9._-]{1,128}$/.test(incoming) ? incoming : randomUUID();
};

const collectFileNames = (candidate: unknown): string[] => {
  if (!candidate || typeof candidate !== 'object') return [];

  const nameOf = (entry: unknown): string | null => {
    const name = (entry as { originalname?: unknown } | null)?.originalname;
    return typeof name === 'string' && name ? name : null;
  };

  if (Array.isArray(candidate)) {
    return candidate.map(nameOf).filter((name): name is string => Boolean(name));
  }

  const single = nameOf(candidate);
  if (single) return [single];

  return Object.values(candidate as Record<string, unknown>).flatMap((value) =>
    collectFileNames(value)
  );
};

/**
 * Serialize a request body for the log block: secrets redacted, long strings
 * collapsed, whole payload capped, uploads described rather than dumped.
 */
const describeRequestBody = (req: Request): string | null => {
  const contentType = req.get('content-type') || '';
  const body = (req as Request & { body?: unknown }).body;
  const uploadRequest = req as Request & { file?: unknown; files?: unknown };

  if (contentType.includes('multipart/form-data')) {
    const fields = body && typeof body === 'object' ? Object.keys(body) : [];
    const files = [
      ...collectFileNames(uploadRequest.file),
      ...collectFileNames(uploadRequest.files),
    ];
    return `[multipart upload] fields=[${fields.join(', ')}] files=[${files.join(', ')}]`;
  }

  if (Buffer.isBuffer(body)) return `[binary ${body.length} bytes]`;
  if (!body || typeof body !== 'object') return null;

  const isEmpty = Array.isArray(body) ? body.length === 0 : Object.keys(body).length === 0;
  if (isEmpty) return null;

  const serialized = JSON.stringify(
    sanitizeValue(body, { maxStringLength: BODY_STRING_MAX_CHARS })
  );
  return serialized ? truncate(serialized, bodyMaxChars()) : null;
};

const describeQuery = (req: Request): string | null => {
  const query = req.query as Record<string, unknown> | undefined;
  if (!query || Object.keys(query).length === 0) return null;
  const serialized = JSON.stringify(sanitizeValue(query, { maxStringLength: BODY_STRING_MAX_CHARS }));
  return serialized ? truncate(serialized, bodyMaxChars()) : null;
};

type RequestOutcome = {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId: string;
  ip: string;
  responseBytes: string | null;
  aborted: boolean;
  error: LogFields | null;
};

const outcomeOf = (
  req: Request,
  res: Response,
  requestId: string,
  startedAt: bigint,
  aborted: boolean
): RequestOutcome => {
  const authenticatedRequest = req as Request & { user?: { userId?: string } };
  const storedError = res.locals.requestError;
  const contentLength = typeof res.get === 'function' ? res.get('content-length') : undefined;

  return {
    requestId,
    method: req.method.toUpperCase(),
    path: req.path || '/',
    statusCode: res.statusCode,
    durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
    userId: authenticatedRequest.user?.userId || 'anonymous',
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    responseBytes: typeof contentLength === 'string' && contentLength ? contentLength : null,
    aborted,
    error: storedError ? asRecord(sanitizeValue({ error: storedError })) : null,
  };
};

const compactLine = (outcome: RequestOutcome): string => {
  const method = outcome.method.padEnd(4);
  const path =
    outcome.path.length > 42 ? `${outcome.path.slice(0, 39)}...` : outcome.path.padEnd(42);

  return [
    colorize(`[${timestamp()}]`, colors.dim),
    colorize(method, methodColor(outcome.method)),
    path,
    colorize(String(outcome.statusCode), statusColor(outcome.statusCode)),
    colorize(`${Math.round(outcome.durationMs)}ms`, colors.dim),
  ].join(' ');
};

const blockLines = (req: Request, outcome: RequestOutcome): string[] => {
  const failed = outcome.statusCode >= 400 || outcome.aborted;
  const marker = outcome.aborted
    ? colorize('ABORTED', colors.yellow)
    : failed
      ? colorize('FAILED', colors.red)
      : '';

  const lines = [
    [
      colorize(`[${timestamp()}]`, colors.dim),
      colorize(outcome.method.padEnd(4), methodColor(outcome.method)),
      outcome.path,
      marker,
    ]
      .filter(Boolean)
      .join(' '),
    detailLine(
      'request',
      `id=${outcome.requestId}  user=${outcome.userId}  ip=${outcome.ip}`
    ),
  ];

  // Query only matters when something went wrong; successful reads stay quiet.
  if (failed) {
    const query = describeQuery(req);
    if (query) lines.push(detailLine('query', query));
  }

  const body = describeRequestBody(req);
  if (body) lines.push(detailLine('body', body));

  const error = outcome.error ? errorDetails(outcome.error) : null;
  if (error) lines.push(detailLine('error', colorize(error.message, colors.red)));

  const statusText = STATUS_CODES[outcome.statusCode] || '';
  const responseParts = [
    colorize(`${outcome.statusCode} ${statusText}`.trim(), statusColor(outcome.statusCode)),
    `${Math.round(outcome.durationMs)}ms`,
    ...(outcome.responseBytes ? [`${outcome.responseBytes}B`] : []),
  ];
  lines.push(
    detailLine(
      'response',
      outcome.aborted
        ? colorize('client disconnected before response completed', colors.yellow)
        : responseParts.join('  ·  ')
    )
  );

  if (error?.stack) {
    stackFrames(error.stack).forEach((frame) =>
      lines.push(detailLine('stack', colorize(frame, colors.dim)))
    );
  }

  return lines;
};

const levelForStatus = (statusCode: number): LogLevel => {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
};

const logRequestOutcome = (req: Request, outcome: RequestOutcome): void => {
  const failed = outcome.statusCode >= 400;
  const healthy = healthCheckPaths.has(outcome.path) && !failed && !outcome.aborted;

  // The keepalive workflow polls /health constantly; successful pings say nothing useful.
  if (healthy) return;

  const slow = outcome.durationMs > slowRequestMs();
  const wantsBlock = outcome.aborted || failed || slow || writeMethods.has(outcome.method);

  if (!wantsBlock) {
    // Successful reads are the bulk of traffic and stay a single line.
    if (outcome.method !== 'GET') return;
    emit('info', [compactLine(outcome)]);
    return;
  }

  const level = outcome.aborted ? 'warn' : levelForStatus(outcome.statusCode);
  emit(level, blockLines(req, outcome), compactLine(outcome));
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = process.hrtime.bigint();
  const requestId = requestIdFrom(req);
  let completed = false;

  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.once('finish', () => {
    completed = true;
    logRequestOutcome(req, outcomeOf(req, res, requestId, startedAt, false));
  });

  res.once('close', () => {
    if (completed) return;
    logRequestOutcome(req, outcomeOf(req, res, requestId, startedAt, true));
  });

  next();
};

/**
 * Attach the failure to the response so `requestLogger` can print it inside the
 * request block. Printing here as well would duplicate every 500.
 */
export const errorLogger = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.locals.requestError = err instanceof Error ? err : new Error(String(err));
  next(err);
};

type StartupDetails = {
  database?: string;
  redis?: string;
};

export const logStartup = (port: number, details: StartupDetails = {}): void => {
  appLogger.info('server_started', {
    port,
    host: '0.0.0.0',
    nodeVersion: process.version,
    nodeEnvironment: process.env.NODE_ENV || 'development',
    ...(details.database ? { database: details.database } : {}),
    ...(details.redis ? { redis: details.redis } : {}),
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
