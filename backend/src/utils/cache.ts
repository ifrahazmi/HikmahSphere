import redisClient from '../config/redis';

/**
 * Cache utility for Redis
 */
export const cache = {
  /**
   * Set a key-value pair in Redis with an optional expiration time
   * @param key The key to set
   * @param value The value to store (will be JSON stringified)
   * @param expireSeconds Expiration time in seconds (default: 3600 - 1 hour)
   */
  set: async (key: string, value: any, expireSeconds: number = 3600): Promise<void> => {
    try {
      await redisClient.set(key, JSON.stringify(value), {
        EX: expireSeconds
      });
    } catch (error) {
      console.error(`❌ Error setting cache for key ${key}:`, error);
    }
  },

  /**
   * Get a value from Redis by key
   * @param key The key to retrieve
   * @returns The parsed value or null if not found
   */
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const data = await redisClient.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (error) {
      console.error(`❌ Error getting cache for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Delete a key from Redis
   * @param key The key to delete
   */
  del: async (key: string): Promise<void> => {
    try {
      await redisClient.del(key);
      console.log(`🗑️ Cache key ${key} deleted`);
    } catch (error) {
      console.error(`❌ Error deleting cache for key ${key}:`, error);
    }
  },

  /**
   * Clear all keys matching a pattern
   * @param pattern The pattern to match (e.g., 'user:*')
   */
  clearPattern: async (pattern: string): Promise<void> => {
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`🧹 Cleared ${keys.length} keys matching pattern ${pattern}`);
        }
    } catch (error) {
        console.error(`❌ Error clearing cache pattern ${pattern}:`, error);
    }
  }
};
