const amqp = require('amqplib');

async function getTotalUnackedMessages() {
  const rabbitmqURL = 'amqp://localhost:5673'; // Update with your RabbitMQ URL

  try {
    const connection = await amqp.connect(rabbitmqURL);
    const channel = await connection.createChannel();

    const queueName = 'java_queue'; // Update with your queue name
    const { messageCount, consumerCount } = await channel.assertQueue(queueName);

    console.log('Total Unacked Messages:', messageCount - consumerCount);

    channel.close();
    connection.close();
  } catch (error) {
    console.error('Error retrieving unacked messages:', error);
  }
}

getTotalUnackedMessages();
