const { Queue } = require('bullmq');
const Redis = require('ioredis');
const connection = new Redis();
const q = new Queue('ia-process', { connection });

async function test() {
  const failed = await q.getFailed();
  console.log('Failed jobs:', failed.length);
  if (failed.length > 0) {
    console.log(failed[0].failedReason);
  }
  process.exit(0);
}
test();
