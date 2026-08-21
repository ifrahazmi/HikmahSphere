import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables properly
const envPath = path.join(process.cwd(), '../.env');
dotenv.config({ path: envPath });
dotenv.config(); // Fallback to local .env

const summarizeRedisTarget = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'rediss:') {
      return 'Upstash Redis (TLS)';
    }
    return `redis://${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
  } catch {
    return '(configured Redis)';
  }
};

/**
 * Local Docker / host: REDIS_HOST + REDIS_PORT (optional REDIS_PASSWORD)
 * Production Upstash: REDIS_URL=rediss://default:TOKEN@HOST:6379  (takes precedence)
 */
const buildRedisUrl = (): string => {
  const fromUrl = process.env.REDIS_URL?.trim();
  if (fromUrl) {
    return fromUrl;
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD?.trim();

  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
  }

  return `redis://${host}:${port}`;
};

const redisUrl = buildRedisUrl();
const usesTls = redisUrl.startsWith('rediss://');
const redisLogTarget = summarizeRedisTarget(redisUrl);

console.log('🔌 Connecting to Redis at:', redisLogTarget);
if (usesTls) {
  console.log('   TLS: enabled');
}

const redisClient = createClient({
  url: redisUrl,
  socket: {
    ...(usesTls ? { tls: true as const } : {}),
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 20) {
        console.error('❌ Redis reconnect abandoned after 20 attempts (non-fatal)');
        return new Error('Redis reconnect limit reached');
      }
      return Math.min(retries * 200, 5000);
    },
  },
});

redisClient.on('error', (err) => {
  console.log('❌ Redis Client Error:', err?.message || 'unknown error');
});
redisClient.on('connect', () => console.log('✅ Redis Client Connected'));
redisClient.on('ready', () => console.log('✅ Redis Client Ready'));

(async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error: any) {
    console.error('❌ Failed to connect to Redis:', error?.message || 'unknown error');
    console.error('   Target:', redisLogTarget);
    console.error('   Cache will be unavailable until Redis is reachable (non-fatal).');
  }
})();

export default redisClient;
