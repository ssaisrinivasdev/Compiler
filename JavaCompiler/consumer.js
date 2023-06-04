const amqp = require('amqplib');

const rabbitSettings = {
  protocol: 'amqp',
  hostname: 'localhost',
  port: 5673,
  username: 'guest1',
  password: 'guest1',
  vhost:'/',
  authMechanism: ['PLAIN','AMQPLAIN','EXTERNAL']
}


const amqpUrl = process.env.AMQP_URL || 'amqp://localhost:5673';

async function consume() {
  try {
    const connection = await amqp.connect(amqpUrl + "?heartbeat=60", function (err, conn) {
      if (err) {
        console.error("Error: ", err);
      } else {
        console.log("Connected successfully");
      }
    });
    console.log("First Stage: No Error until now.")
    const channel = await connection.createChannel().catch((err) => {console.log("Error from channel:"+err)});
    channel.prefetch(100);
    const queue = 'output_queue';

    channel.assertQueue(queue, {
      durable: true
    });

    console.log('Waiting for messages...');

    channel.consume(queue, async (message) => {
      const content = message.content.toString();
      console.log(content);

      channel.ack(message);
    }, {
      noAck: false
    });
  } catch (error) {
    console.error(error);
  }
}

consume();
