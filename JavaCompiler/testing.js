const Redis = require('ioredis');
const  { default: Redlock}   = require('redlock');

const client =  new Redis();

// Create a Redlock instance
const redlock = new Redlock([client], {
  driftFactor: 0.01, // Percentage of clock drift allowed
  retryCount: 300, // Number of times to retry acquiring the lock
  retryDelay: 200, // Delay between retries in milliseconds
});

async function main (){
    try{

        console.log("a");
        await redlock.lock("regression", 10000);
        console.log("b");
        const second = await redlock.lock("regression", 10000);
        console.log("c");
        await second.unlock();
        console.log("d");
    }catch(err){
        console.log(err)
    }
  }
  
  //main();


  
async function testLocking(key, duration) {
    try {
      // Acquire a lock
      let lock = await redlock.acquire(key, duration);
  
      // Perform some critical operation within the lock
      console.log(`Lock acquired for key '${key}'. Performing critical operation...`);
      await performCriticalOperation();
  
      // Simulate a delay to hold the lock for the specified duration
      //await delay(duration);

      var dat = new Date(lock.expiration);
      var now = new Date(Date.now());
      console.log("Now: "+now);
      console.log("Expire: "+dat);

      // Release the lock
      if (lock.expiration > Date.now() && lock.expiration != 0) {
        await lock.release();
      }
  
      console.log(`Lock released for key '${key}'.`);
    } catch (error) {
      console.error(`Error occurred while acquiring or releasing the lock: ${error}`);
    }
  }
  
  async function performCriticalOperation() {
    // Simulate a critical operation by delaying for a few seconds
    await delay(1000);
    console.log('Critical operation completed.');
  }
  
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  // Test the locking system
  async function runLockingTest() {
    const key = 'myLock1';
    const duration = 10000; // Lock duration in milliseconds
  
    // Start two parallel lock tests with the same key
    console.log('Test 1: Start');
    testLocking(key, duration);
    
    console.log('Test 2: Start');
    testLocking(key, duration);
  }
  
runLockingTest();
  