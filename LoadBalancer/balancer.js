const axios = require('axios');
const amqp = require('amqplib');
const { exec } = require('child_process');
const fs = require('fs');
const Docker = require('dockerode');


const ampqUrl = "amqp://guest:guest@rabbitmq:5672";
const API_ENDPOINT = 'http://rabbitmq:15672/api/queues/%2F/java_queue';//'amqp://guest:guest@rabbitmq:5672/api/queues/%2F/java_queue'; // Replace with your RabbitMQ API endpoint and queue name
const USERNAME = 'guest'; // Replace with your RabbitMQ username
const PASSWORD = 'guest'; // Replace with your RabbitMQ password
const JAVA_QUEUE = 'java_queue'
var channel;
var CountOfContainers= 0;


async function getUnacknowledgedMessageCount(channel) {
  try {
    const response = await axios.get(API_ENDPOINT, {
      auth: {
        username: USERNAME,
        password: PASSWORD
      }
    });
    const unacknowledgedCount = response.data.messages_ready;
    console.log('Unacknowledged Message Count:', unacknowledgedCount);
    return unacknowledgedCount;
  } catch (error) {
    console.error('Error retrieving unacknowledged message count:', error.message);
  }
}

// getUnacknowledgedMessageCount();


// Create a Docker client
const docker = new Docker();


async function scaleUpService(serviceName, image, scaleCount, environment, networkName  ) {
// Scale up the service
const service = docker.getService(serviceName);
await service.update({ mode: { Replicated: { Replicas: scaleCount } } });

// Update the service with new environment variables and network
await service.update({
    taskTemplate: {
      containerSpec: {
        env: environment
      },
      networks: [
        { target: networkName }
      ]
    }
  });
}



const interval = setInterval( async () => {
    const result = getUnacknowledgedMessageCount();
    // console.log(result);
    if(60 == 60 && CountOfContainers <=0 ){
        console.log("Started creating container")
        CountOfContainers++;
            //docker container create --name consumer_2 --env NODE_ENV=production --env AMQP_URL=amqp://guest:guest@rabbitmq:5672 --env NAME=consumer2 --network compiler_all_dockers_bridge compiler-consumer:latest
            // Call the scaleUpService function with your desired parameters
            scaleUpService(
                'consumer_service',             // Service name
                'compiler-consumer:latest',       // Image name and tag
                3,                   // Desired scale count
                {                    // Environment variables
                    NODE_ENV: 'production',
                    AMQP_URL: 'amqp://guest:guest@rabbitmq:5672',
                    NAME: 'consumer3'
                },
                'all_docker_bridge'
            );
            //createContainer();
    }
}, 1000);

const createContainer = async () => {
    try {
      console.log("Started creating container")
      const docker = new Docker({ socketPath: '/var/run/docker.sock' }); // Use the appropriate socket path or API endpoint
  
      const containerConfig      = {
        name: 'consumer_2',
        Env: [
          'NODE_ENV=production',
          'AMQP_URL=amqp://guest:guest@rabbitmq:5672',
          'NAME=consumer2'
        ],
        HostConfig: {
          NetworkMode: 'compiler_all_dockers_bridge'
        },
        Image: 'compiler-consumer:latest'
      };
  
      docker.createContainer(containerConfig)
        .then(container => {
            // The container was created successfully
            console.log('New container ID:', container.id);
            // Start the container if desired
            return container.start();
        })
        .then(() => {
            console.log('Container started successfully');
        })
        .catch(error => {
            console.error('Error creating or starting container:', error);
        });

    } catch (error) {
      console.error('Error creating container:', error.message);
    }
  };


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
    channel = await connection.createChannel().catch((err) => {console.log("Error from channel:"+err)});
    channel.prefetch(0); 
    const queue = 'java_queue';

    channel.assertQueue(queue, {
      durable: true
    });

    console.log('Waiting for messages...');

    channel.consume(queue, async (message) => {
      var b = getUnacknowledgedMessageCount(channel);
    }, {
      noAck: false
    });
  } catch (error) {
    console.error(error);
  }
}

//consume();
