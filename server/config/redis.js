const { createClient } = require('redis');

let redisClient;

const connectRedis = async () => {
  redisClient = createClient({
    url: process.env.REDIS_URI || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => console.error('Redis Client Error:', err));
  redisClient.on('connect', () => console.log('Redis Connected'));

  try {
    await redisClient.connect();
  } catch (error) {
    console.error(`Failed to connect to Redis: ${error.message}`);
    // We don't exit the process here so the app can still run without cache
  }
};

const getRedisClient = () => redisClient;

module.exports = {
  connectRedis,
  getRedisClient
};
