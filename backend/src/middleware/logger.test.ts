import { EventEmitter } from 'events';
import { NextFunction, Request, Response } from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  appLogger,
  errorLogger,
  installProductionConsoleBridge,
  requestLogger,
  resetLogBudget,
} from './logger';

type FakeResponse = Response & EventEmitter;

type RequestOptions = {
  method: string;
  path: string;
  statusCode?: number;
  body?: unknown;
  query?: Record<string, unknown>;
  contentType?: string;
  durationMs?: number;
  error?: Error;
  abort?: boolean;
};

const createRequest = (options: RequestOptions): Request =>
  ({
    method: options.method,
    path: options.path,
    query: options.query ?? {},
    body: options.body,
    ip: '203.0.113.4',
    socket: { remoteAddress: '203.0.113.4' },
    get: jest.fn((header: string): string | undefined => {
      const name = header.toLowerCase();
      if (name === 'x-request-id') return 'test-request-id';
      if (name === 'content-type') {
        return options.contentType ?? (options.body ? 'application/json' : undefined);
      }
      return undefined;
    }),
  }) as unknown as Request;

const createResponse = (statusCode: number): FakeResponse => {
  const response = new EventEmitter() as FakeResponse;
  response.statusCode = statusCode;
  response.locals = {};
  response.setHeader = jest.fn() as unknown as Response['setHeader'];
  response.get = jest.fn(() => '412') as unknown as Response['get'];
  return response;
};

const runRequest = (options: RequestOptions): void => {
  const durationNs = BigInt(Math.round((options.durationMs ?? 12) * 1_000_000));
  jest
    .spyOn(process.hrtime, 'bigint')
    .mockReturnValueOnce(0n)
    .mockReturnValue(durationNs);

  const req = createRequest(options);
  const res = createResponse(options.statusCode ?? 200);
  requestLogger(req, res, jest.fn() as NextFunction);

  if (options.error) {
    errorLogger(options.error, req, res, jest.fn() as NextFunction);
  }

  res.emit(options.abort ? 'close' : 'finish');
};

const spyOnStdout = () =>
  jest.spyOn(process.stdout, 'write').mockImplementation((() => true) as any);
const spyOnStderr = () =>
  jest.spyOn(process.stderr, 'write').mockImplementation((() => true) as any);

const outputOf = (spy: ReturnType<typeof spyOnStdout>): string =>
  spy.mock.calls.map((call) => String(call[0])).join('');

const linesOf = (spy: ReturnType<typeof spyOnStdout>): string[] =>
  outputOf(spy).split('\n').filter((line) => line.length > 0);

describe('readable Render logger', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalNoColor = process.env.NO_COLOR;
  const originalBudget = process.env.LOG_MAX_LINES_PER_MINUTE;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
    process.env.NO_COLOR = '1';
  });

  afterAll(() => {
    if (typeof originalNodeEnv === 'undefined') delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (typeof originalNoColor === 'undefined') delete process.env.NO_COLOR;
    else process.env.NO_COLOR = originalNoColor;
  });

  beforeEach(() => {
    resetLogBudget();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (typeof originalBudget === 'undefined') delete process.env.LOG_MAX_LINES_PER_MINUTE;
    else process.env.LOG_MAX_LINES_PER_MINUTE = originalBudget;
  });

  it('writes exactly one compact line for a successful GET', () => {
    const stdout = spyOnStdout();

    runRequest({ method: 'GET', path: '/api/quran/surahs' });

    expect(stdout).toHaveBeenCalledTimes(1);
    expect(linesOf(stdout)).toHaveLength(1);
    expect(outputOf(stdout)).toMatch(/GET\s+\/api\/quran\/surahs\s+200\s+\d+ms/);
    expect(outputOf(stdout)).not.toContain('request ');
  });

  it('writes a block with request, body, and response for a write request', () => {
    const stdout = spyOnStdout();

    runRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'user@example.com', password: 'super-secret' },
      durationMs: 231,
    });

    const lines = linesOf(stdout);
    expect(lines[0]).toMatch(/POST\s+\/api\/auth\/login/);
    expect(lines[1]).toContain('request');
    expect(lines[1]).toContain('id=test-request-id');
    expect(lines[1]).toContain('ip=203.0.113.4');
    expect(lines[2]).toContain('"email":"user@example.com"');
    expect(lines[3]).toMatch(/response\s+200 OK/);
    expect(lines[3]).toContain('231ms');
  });

  it('redacts secrets and collapses oversized strings in the logged body', () => {
    const stdout = spyOnStdout();

    runRequest({
      method: 'PUT',
      path: '/api/users/profile',
      body: {
        password: 'plain-text-password',
        token: 'jwt-value',
        profilePicture: `data:image/png;base64,${'A'.repeat(400)}`,
      },
    });

    const output = outputOf(stdout);
    expect(output).toContain('"password":"[REDACTED]"');
    expect(output).toContain('"token":"[REDACTED]"');
    expect(output).not.toContain('plain-text-password');
    expect(output).not.toContain('jwt-value');
    expect(output).toContain('chars omitted');
    expect(output).not.toContain('AAAAAAAAAA');
  });

  it('describes multipart uploads without dumping file contents', () => {
    const stdout = spyOnStdout();

    runRequest({
      method: 'POST',
      path: '/api/users/avatar',
      contentType: 'multipart/form-data; boundary=x',
      body: { caption: 'my avatar' },
    });

    expect(outputOf(stdout)).toContain('[multipart upload] fields=[caption]');
  });

  it('writes a single failure block with error, stack, and FAILED marker', () => {
    const stderr = spyOnStderr();
    const stdout = spyOnStdout();
    const failure = new Error('Server selection timed out after 15000ms');
    failure.name = 'MongooseError';
    failure.stack = 'MongooseError: Server selection timed out\n    at Timeout._onTimeout (/app/dist/routes/auth.js:88:15)';

    runRequest({
      method: 'POST',
      path: '/api/auth/login',
      statusCode: 500,
      body: { email: 'user@example.com', password: 'super-secret' },
      error: failure,
      durationMs: 15021,
    });

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(1);

    const output = outputOf(stderr);
    expect(output).toContain('FAILED');
    expect(output).toContain('MongooseError: Server selection timed out after 15000ms');
    expect(output).toContain('at Timeout._onTimeout');
    expect(output).toMatch(/response\s+500 Internal Server Error/);
    expect(output).toContain('[REDACTED]');
  });

  it('writes a block for a failing read, including the query', () => {
    const stdout = spyOnStdout();

    runRequest({
      method: 'GET',
      path: '/api/quran/tafsir',
      statusCode: 404,
      query: { surah: '2', edition: 'maududi' },
    });

    const lines = linesOf(stdout);
    expect(lines[0]).toContain('FAILED');
    expect(outputOf(stdout)).toContain('"edition":"maududi"');
    expect(outputOf(stdout)).toMatch(/response\s+404 Not Found/);
  });

  it('stays silent for a healthy health check but logs a failing one', () => {
    const stdout = spyOnStdout();
    const stderr = spyOnStderr();

    runRequest({ method: 'GET', path: '/health' });
    runRequest({ method: 'GET', path: '/api/health' });
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();

    runRequest({ method: 'GET', path: '/health', statusCode: 503 });
    expect(linesOf(stderr).length).toBeGreaterThan(1);
    expect(outputOf(stderr)).toContain('FAILED');
  });

  it('writes a block for a slow but successful read', () => {
    const stdout = spyOnStdout();

    runRequest({ method: 'GET', path: '/api/quran/surahs', durationMs: 4200 });

    const lines = linesOf(stdout);
    expect(lines).toHaveLength(3);
    expect(lines[0]).not.toContain('FAILED');
    expect(lines[2]).toContain('4200ms');
  });

  it('notes aborted connections', () => {
    const stdout = spyOnStdout();

    runRequest({ method: 'GET', path: '/api/quran/surahs', abort: true });

    const output = outputOf(stdout);
    expect(output).toContain('ABORTED');
    expect(output).toContain('client disconnected');
  });

  it('collapses blocks to one-liners with a single warning once the budget is spent', () => {
    process.env.LOG_MAX_LINES_PER_MINUTE = '6';
    const stdout = spyOnStdout();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      runRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'user@example.com', password: 'super-secret' },
      });
    }

    const lines = linesOf(stdout);
    const warnings = lines.filter((line) => line.includes('log budget reached'));
    expect(warnings).toHaveLength(1);

    const collapsed = lines.filter((line) => /POST\s+\/api\/auth\/login\s+200\s+\d+ms/.test(line));
    expect(collapsed.length).toBeGreaterThanOrEqual(3);
    expect(lines.filter((line) => line.includes('"email"'))).toHaveLength(1);
  });

  it('prints a compact startup block', () => {
    const stdout = spyOnStdout();

    appLogger.info('server_started', {
      port: 5000,
      host: '0.0.0.0',
      nodeVersion: 'v20.11.0',
      nodeEnvironment: 'production',
      database: 'MongoDB Atlas / hikmahsphere',
      redis: 'connected',
    });

    const lines = linesOf(stdout);
    expect(lines[0]).toContain('Server ready');
    expect(lines[1]).toContain('0.0.0.0:5000');
    expect(lines[2]).toContain('MongoDB Atlas / hikmahsphere');
    expect(lines[3]).toContain('connected');
  });

  it('redacts secrets in warning messages', () => {
    const stdout = spyOnStdout();

    appLogger.warn('application_log', {
      message: 'token=visible-token password=visible-password',
    });

    const output = outputOf(stdout);
    expect(output).toContain('token=[REDACTED]');
    expect(output).toContain('password=[REDACTED]');
    expect(output).not.toContain('visible-token');
    expect(output).not.toContain('visible-password');
  });

  it('suppresses routine legacy console noise but keeps warnings', () => {
    const stdout = spyOnStdout();
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    try {
      installProductionConsoleBridge();
      console.log('routine route message');
      console.info('routine info');
      console.debug('routine debug');
      expect(stdout).not.toHaveBeenCalled();

      console.warn('important warning');
      expect(stdout).toHaveBeenCalledTimes(1);
      expect(outputOf(stdout)).toContain('important warning');
    } finally {
      Object.assign(console, originalConsole);
    }
  });
});
