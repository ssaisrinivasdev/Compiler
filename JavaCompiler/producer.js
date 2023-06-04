const amqp = require('amqplib');

const rabbitSettings = {
  protocol: 'amqp',
  hostname: 'localhost',
  port: 5672,
  username: 'rabbitmq',
  password: 'rabbitmq',
  vhost:'/',
  authMechanism: ['PLAIN','AMQPLAIN','EXTERNAL']
};

const queueName = 'java_queue';
// const message = 'Hello RabbitMQ!';

async function produce(language, code, user, guid) {
  try {

    var queue = "java_queue";
    switch(language){
      case 'java': 
        queue = "java_queue";
        break;
      case 'python':
        queue = "python_queue";
        break;
      case 'cplusplus':
        queue = "cplusplus_queue";
        break;
    }

    const message = {queue: queue, code: code, user: user, requestId: guid};
    const jsonMessage = JSON.stringify(message);

    const conn = await amqp.connect('amqp://localhost:5673');
    const channel = await conn.createChannel();
    
    await channel.assertQueue(queue, { durable: true });
    await channel.sendToQueue(queue, Buffer.from(jsonMessage), { persistent: true });
    
    console.log('Message sent:', jsonMessage);
    
    await channel.close();
    await conn.close();
  } catch (error) {
    console.error(error);
  }
}

for(i=1; i<=20; i++){
produce("java", `

// Java Program to Demonstrate
// Implementation of LinkedList
// class
 
// Importing required classes
import java.util.*;
 
// Main class
public class Main {
 
    // Driver code
    public static void main(String args[])
    {
        
      try {  
        for (int j = 0; j < 1; j++)  
        {  
          
          // The main thread sleeps for the 1000 milliseconds, which is 1 sec  
          // whenever the loop runs  
          //Thread.sleep(1000);  
            
          // displaying the value of the variable  
          System.out.println(${i.toString()});  
        }  
      }  
      catch (Exception expn)   
      {  
        // catching the exception  
        System.out.println(expn);  
      }  
    }
}

`, i.toString(),'1234_3'+i.toString());
}