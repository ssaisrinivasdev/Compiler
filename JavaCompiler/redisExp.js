const redis = require('redis');

const client = redis.createClient({
    url: "redis://localhost:6379",
  });
   

client.on('connect', () => console.log('Redis Client Connected'));
client.on('error', (err) => console.log('Redis Client Connection Error', err));

(async () => {
    try {
      client.connect();

      client.set('key1', 'value1', (error, reply) => {
        if (error) {
          console.error('Error setting value in Redis:', error);
        } else {
          console.log('Value set in Redis:', reply);
        }
      });
  
      // Retrieve data from Redis
      let v = await client.get('key1');
  
      console.log(v)

      // Close Redis connection
    //   client.quit();
    } catch (error) {
      console.error('Error connecting to Redis:', error);
    }
  })();