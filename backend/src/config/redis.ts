import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables properly
const envPath = path.join(process.cwd(), '../.env');
dotenv.config({ path: envPath });
dotenv.config(); // Fallback to local .env

const redisUrl = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

console.log('🔌 Connecting to Redis at:', redisUrl);

const redisClient = createClient({
    url: redisUrl
});

redisClient.on('error', (err) => console.log('❌ Redis Client Error', err));
redisClient.on('connect', () => console.log('✅ Redis Client Connected'));
redisClient.on('ready', () => console.log('✅ Redis Client Ready'));

(async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
    }
})();

export default redisClient;
