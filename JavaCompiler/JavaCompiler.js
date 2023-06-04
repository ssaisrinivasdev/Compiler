const amqp = require('amqplib');
const { default: Redlock}  = require("redlock");
const { exec } = require('child_process');
const fs = require('fs');
const Redis = require('ioredis');

const amqpUrl = process.env.AMQP_URL || 'amqp://localhost:5673';
const redisUrl =  "redis://redis:6379";

const filePath = 'Main.java';
const client =  new Redis(6379, 'redis');

console.log("Started")
connect();
async function connect(){
  try{
   
    const redlock = new Redlock([client], {
      driftFactor: 0.01, // Percentage of clock drift allowed
      retryCount: 0, // Number of times to retry acquiring the lock
      retryDelay: 10000, // Delay between retries in milliseconds
    });

    client.on('connect', () => console.log('Redis Client Connected'));
    client.on('error', (err) => console.log('Redis Client Connection Error', err));

    redlock.on('connect', () => console.log('redlock Connected'));
    redlock.on('error', (err) => console.log('redlock Connection Error', err));

    //await client.connect();
        
    isRunning = true;
    console.log("Started Application")
    console.log(amqpUrl)
    const connection = await amqp.connect(amqpUrl + "?heartbeat=60", function (err, conn) {
      if (err) {
        console.error("Error: ", err);
      } else {
        console.log("Connected successfully");
      }
    });
    console.log("First Stage: No Error until now.")
    const channel = await connection.createChannel().catch((err) => {console.log("Error from channel:"+err)});
    channel.prefetch(40);
    const queue = 'java_queue';
    const outputQueue = 'output_queue';

    channel.assertQueue(queue, {
      durable: true
    });
    channel.assertQueue(outputQueue, {
      durable: true
    });

    console.log('Waiting for messages...');

    channel.consume(queue, async (message) => {
      const content = message.content.toString();
      var user = "";
      if(content!=null){
        const messageJson = JSON.parse(content);
        const queue = messageJson.queue;
        const code = messageJson.code;
        const requestId = messageJson.requestId;
        user = messageJson.user;
        let process_msg = {
          requestId ,
          progress: "picked"           
        } 
        //channel.ack(message);
        console.log('*********Started*********'); 
        if(queue == 'java_queue' && await isRedisDataPresent(requestId)){

          var lockKey = `locks:${requestId}`;
          try{
            let lock = await redlock.acquire([lockKey], 10000);
          
          
          await setRedisData(requestId, process_msg);

          await CreateJavaFile(code, user);              
          console.log('Received message:', content);
      
          // Replace the command and file paths with your own
          const command = 'javac';
          const inputArgs = ['arg1', 'arg2', 'arg3'];

          // Execute the command as a child process
          exec(`${command} ${user}/${filePath}`, (error, stdout, stderr) => {
            console.log('Started command');
            const startTime = process.hrtime();
            if (error) {
              const endTime = process.hrtime(startTime);
              const executionTimeInMs = endTime[0] * 1000 + endTime[1] / 1000000;
              console.error(`Error executing command while running ${command} ${filePath}: ${error.message}`);
              channel.ack(message);
              produce(user, error.toString(), executionTimeInMs.toFixed(2)+ ' ms')
              return;
            }
            if (stderr) {
              const endTime = process.hrtime(startTime);
              const executionTimeInMs = endTime[0] * 1000 + endTime[1] / 1000000;
              console.error(`Command returned error: ${stderr}`);
              channel.ack(message);
              produce(user, stderr.toString(), executionTimeInMs.toFixed(2)+ ' ms')
              return;
            }
            
            console.log("STDOUT:"+stdout);
            exec(`java -cp /app/${user} Main ${inputArgs.join(' ')}`, (errorI, stdoutI, stderrI)=>{
              console.log('Started Inside command');
              if(stdoutI){
                console.log('Result: '+stdoutI)
                channel.ack(message);
                const endTime = process.hrtime(startTime);
                const executionTimeInMs = endTime[0] * 1000 + endTime[1] / 1000000;

                console.log('Execution Time:', executionTimeInMs.toFixed(2), 'ms');
                if(IsJavaFilePresent(user)){
                  DeleteJavaFile(user);
                }else{
                  console.log(user+" folder is not present")
                }
                process_msg.progress = "Completed"
                // Release the lock
                if (lock.expiration > Date.now() && lock.expiration != 0) {
                  lock.release();
                }
                setRedisData(requestId, process_msg);
                const message_j = {user: user, output: stdoutI, timeTaken: executionTimeInMs.toFixed(2)+ ' ms', Env: process.env.NAME};
                const jsonMessage = JSON.stringify(message_j);
                channel.sendToQueue('output_queue', Buffer.from(jsonMessage));
                //produce(user, stdoutI, executionTimeInMs.toFixed(2)+ ' ms')
              }
              if (errorI) {
                const endTime = process.hrtime(startTime);
                const executionTimeInMs = endTime[0] * 1000 + endTime[1] / 1000000;
                console.error(`Error executing command java Main: ${errorI.message}`);
                channel.ack(message);
                produce(user, errorI.toString(), executionTimeInMs.toFixed(2)+ ' ms')
                return;
              }
              if (stderrI) {
                const endTime = process.hrtime(startTime);
                const executionTimeInMs = endTime[0] * 1000 + endTime[1] / 1000000;
                console.error(`Command returned error: ${stderrI}`);
                channel.ack(message);
                produce(user, stderrI.toString(), executionTimeInMs.toFixed(2)+ ' ms')
                return;
              }
            });
          });
          }catch(error){
            if (error.name === 'ResourceLockedError') {
              console.log('Locked Error')
            }
          }
        }else{
          console.log("Already picked")
          channel.ack(message);
        }
        console.log('*********Ended*********');
      }
    }, {
      noAck: false
    });
  }
  catch(err){
    console.error(`Error-> ${err}`);
    if(err.toString().includes('ECONNREFUSED') || err.toString().includes('Redis is already connecting/connected')){
      console.log('Retrying in 5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return connect();
    }
  }
  console.log("Ended")
}


async function CreateJavaFile(code, user){
  if (!fs.existsSync(user)) {
    fs.mkdirSync(user);
  }
  fs.writeFile(user+'/Main.java', code, (err) => {
      if (err) {
          console.error("Error at CreateJavaFile: "+err.toString());
          return;
      }
      console.log('File created successfully');
  });
}

async function DeleteJavaFile(user){
  fs.rmSync('/app/'+user, { recursive: true }, (err) => {
    if (err) {
      console.error(`Error deleting the file: ${err}`);
    } else {
      console.log(`File has been deleted successfully.`);
    }
  });
}

async function IsJavaFilePresent(user){
  fs.stat(user+'/'+filePath, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.log(`File ${filePath} does not exist.`);
      } else {
        console.error(`Error checking the existence of file ${filePath}: ${err}`);
      }
      return false;
    } else {
      return true;
    }
  });
}

async function produce(user, output, timeTaken) {
  try {
    const queueName = 'output_queue'; 
    const message = {user: user, output: output, timeTaken: timeTaken, Env: process.env.NAME};
    const jsonMessage = JSON.stringify(message);

    const conn = await amqp.connect(amqpUrl + "?heartbeat=60", function (err, conn) {
      if (err) {
        console.error("Error: ", err);
      } else {
        console.log("Connected successfully");
      }
    });
    const channel = await conn.createChannel();
    
    await channel.assertQueue(queueName, { durable: true });
    await channel.sendToQueue(queueName, Buffer.from(jsonMessage), { persistent: true });
    
    console.log('Message sent:', jsonMessage);
    
    await channel.close();
    await conn.close();
  } catch (error) {
    console.error(error);
  }
}

async function getRedisData(key){
  var value = await client.get(key);
  return value;
}

async function isRedisDataPresent(key){
  var value = await client.get(key);
  console.log("Value:"+ value+"|");
  console.log(value == null? "false": "true")
  return value != null ? false : true ;
}

async function setRedisData(key, value){
  try{
    const valueString = JSON.stringify(value);
    var redisBool = await isRedisDataPresent(key);
    if(redisBool){
      client.set(key, valueString);
    }else{
      console.log("Already exists.")
    }
  }
  catch(err){
    console.log(`Error at setting Redis Data: `+err.toString());
  }

}

async function unlockRedis(lock){
  await lock.release()
}