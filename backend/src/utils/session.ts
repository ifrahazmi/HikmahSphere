import redisClient from '../config/redis';

// Simple implementation using Redis for session management
// This works by storing user sessions with a generated session ID
// In a real application, you might use express-session with connect-redis
// This is a manual implementation for educational/custom purposes

export const sessionStore = {
  /**
   * Create a session for a user
   * @param sessionId The session ID (e.g. generated UUID)
   * @param userId The user's ID
   * @param data Additional session data
   * @param ttlSeconds Time to live in seconds (default: 86400 - 1 day)
   */
  createSession: async (sessionId: string, userId: string, data: any = {}, ttlSeconds: number = 86400): Promise<void> => {
    try {
        const key = `session:${sessionId}`;
        // Redis HSET requires string arguments for values
        const sessionData = {
            userId,
            ...Object.entries(data).reduce((acc: any, [k, v]) => {
                acc[k] = String(v);
                return acc;
            }, {}),
            createdAt: new Date().toISOString()
        };
        
        await redisClient.hSet(key, sessionData);
        await redisClient.expire(key, ttlSeconds);
        console.log(`✅ Session created for user ${userId}`);
    } catch (error) {
      console.error('❌ Session creation failed:', error);
    }
  },

  /**
   * Retrieve a session by ID
   * @param sessionId The session ID
   * @returns The session object or null
   */
  getSession: async (sessionId: string): Promise<any> => {
    try {
      const session = await redisClient.hGetAll(`session:${sessionId}`);
      if (!session || Object.keys(session).length === 0) return null;
      return session;
    } catch (error) {
      console.error('❌ Session retrieval failed:', error);
      return null;
    }
  },

  /**
   * Destroy a session
   * @param sessionId The session ID
   */
  destroySession: async (sessionId: string): Promise<void> => {
    try {
      await redisClient.del(`session:${sessionId}`);
      console.log(`🗑️ Session ${sessionId} destroyed`);
    } catch (error) {
      console.error('❌ Session destruction failed:', error);
    }
  }
};
