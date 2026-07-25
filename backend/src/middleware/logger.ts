import { Request, Response, NextFunction } from 'express';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Status colors
  success: '\x1b[32m', // Green
  info: '\x1b[36m',    // Cyan
  warning: '\x1b[33m', // Yellow
  error: '\x1b[31m',   // Red

  // Request method colors
  get: '\x1b[34m',     // Blue
  post: '\x1b[35m',    // Magenta
  put: '\x1b[33m',     // Yellow
  delete: '\x1b[31m',  // Red
  patch: '\x1b[36m',   // Cyan
};

// Sanitize sensitive data from logs
const sanitizeData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };
  const sensitiveFields = ['password', 'token', 'refreshToken', 'accessToken', 'oldPassword', 'newPassword'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
};

// Get color based on HTTP method
const getMethodColor = (method: string): string => {
  const methodColors: { [key: string]: string } = {
    GET: colors.get,
    POST: colors.post,
    PUT: colors.put,
    DELETE: colors.delete,
    PATCH: colors.patch,
  };
  return methodColors[method] || colors.info;
};

// Get color based on status code
const getStatusColor = (statusCode: number): string => {
  if (statusCode >= 500) return colors.error;
  if (statusCode >= 400) return colors.warning;
  if (statusCode >= 300) return colors.info;
  if (statusCode >= 200) return colors.success;
  return colors.reset;
};

// Format timestamp
const getTimestamp = (): string => {
  return new Date().toISOString();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const timestamp = getTimestamp();
  const methodColor = getMethodColor(req.method);

  // Log incoming request
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}📥 INCOMING REQUEST${colors.reset}`);
  console.log(`${colors.dim}Timestamp:${colors.reset} ${timestamp}`);
  console.log(`${colors.dim}Method:${colors.reset} ${methodColor}${req.method}${colors.reset}`);
  console.log(`${colors.dim}Path:${colors.reset} ${colors.bright}${req.path}${colors.reset}`);
  console.log(`${colors.dim}IP:${colors.reset} ${req.ip || req.connection.remoteAddress}`);
  console.log(`${colors.dim}User-Agent:${colors.reset} ${req.get('user-agent') || 'Unknown'}`);

  // Log query parameters if present
  if (Object.keys(req.query).length > 0) {
    console.log(`${colors.dim}Query Params:${colors.reset} ${JSON.stringify(req.query)}`);
  }

  // Log request body (sanitized) for non-GET requests
  if (req.method !== 'GET' && Object.keys(req.body || {}).length > 0) {
    console.log(`${colors.dim}Body:${colors.reset} ${JSON.stringify(sanitizeData(req.body), null, 2)}`);
  }

  // Log auth header presence (not the actual token)
  if (req.headers.authorization) {
    console.log(`${colors.dim}Auth:${colors.reset} ${colors.success}✓ Token Present${colors.reset}`);
  }

  // Capture the original end function
  const originalEnd = res.end;

  // Override res.end to log response
  res.end = function(this: Response, chunk?: any, encodingOrCallback?: any, callback?: any): Response {
    const duration = Date.now() - startTime;
    const statusColor = getStatusColor(res.statusCode);

    // Log outgoing response
    console.log(`\n${colors.bright}📤 OUTGOING RESPONSE${colors.reset}`);
    console.log(`${colors.dim}Status:${colors.reset} ${statusColor}${res.statusCode}${colors.reset}`);
    console.log(`${colors.dim}Duration:${colors.reset} ${duration}ms`);
    console.log(`${colors.dim}Content-Type:${colors.reset} ${res.get('content-type') || 'Not set'}`);

    // Log success or error
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`${colors.success}✅ SUCCESS${colors.reset}`);
    } else if (res.statusCode >= 400 && res.statusCode < 500) {
      console.log(`${colors.warning}⚠️  CLIENT ERROR${colors.reset}`);
    } else if (res.statusCode >= 500) {
      console.log(`${colors.error}❌ SERVER ERROR${colors.reset}`);
    }

    console.log('='.repeat(80) + '\n');

    // Call the original end function with proper arguments
    return originalEnd.call(this, chunk, encodingOrCallback, callback);
  };

  next();
};

// Error logging middleware
export const errorLogger = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.error}${colors.bright}💥 ERROR OCCURRED${colors.reset}`);
  console.log(`${colors.dim}Timestamp:${colors.reset} ${getTimestamp()}`);
  console.log(`${colors.dim}Method:${colors.reset} ${getMethodColor(req.method)}${req.method}${colors.reset}`);
  console.log(`${colors.dim}Path:${colors.reset} ${colors.bright}${req.path}${colors.reset}`);
  console.log(`${colors.dim}Error Name:${colors.reset} ${colors.error}${err.name || 'Error'}${colors.reset}`);
  console.log(`${colors.dim}Error Message:${colors.reset} ${colors.error}${err.message}${colors.reset}`);

  if (err.stack && process.env.NODE_ENV === 'development') {
    console.log(`${colors.dim}Stack Trace:${colors.reset}`);
    console.log(colors.dim + err.stack + colors.reset);
  }

  console.log('='.repeat(80) + '\n');

  next(err);
};

// Log application startup
export const logStartup = (port: number) => {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.success}${colors.bright}🚀 HIKMAHSPHERE API SERVER STARTED${colors.reset}`);
  console.log(`${colors.dim}Timestamp:${colors.reset} ${getTimestamp()}`);
  console.log(`${colors.dim}Port:${colors.reset} ${colors.bright}${port}${colors.reset}`);
  console.log(`${colors.dim}Environment:${colors.reset} ${process.env.NODE_ENV || 'development'}`);
  console.log(`${colors.dim}Node Version:${colors.reset} ${process.version}`);
  console.log(`${colors.success}✅ Server is ready to accept requests${colors.reset}`);
  console.log('='.repeat(80) + '\n');
};

// Log database connection
export const logDatabaseConnection = (uri: string) => {
  const sanitizedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.success}${colors.bright}🗄️  DATABASE CONNECTED${colors.reset}`);
  console.log(`${colors.dim}Timestamp:${colors.reset} ${getTimestamp()}`);
  console.log(`${colors.dim}URI:${colors.reset} ${sanitizedUri}`);
  console.log(`${colors.success}✅ MongoDB connection established${colors.reset}`);
  console.log('='.repeat(80) + '\n');
};
