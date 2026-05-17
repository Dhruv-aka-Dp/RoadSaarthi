const { createClient } = require('redis');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URI || 'redis://localhost:6379',
      socket: {
        // Don't retry automatically — app works fine without Redis
        reconnectStrategy: false,
        connectTimeout: 3000,
      },
    });

    // Only log the first error, then stay silent
    redisClient.on('error', () => {});
    redisClient.on('connect', () => console.log('✓ Redis connected'));

    await redisClient.connect();
  } catch (error) {
    console.warn('⚠ Redis unavailable — caching disabled (app will still work)');
    redisClient = null;
  }
};

const getRedisClient = () => redisClient;

module.exports = {
  connectRedis,
  getRedisClient,
};
