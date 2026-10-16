// Sanity check of the Redis command forms used in Tier 2 (2.7 and 2.9). ioredis-mock models Redis;
// it is NOT a real server. The gateway's devDependency ioredis-mock must be installed.
// Sanity check of the Redis command forms used in Tier 2 (ioredis-mock models Redis; it is NOT a real server).
const path = require('path');
const RedisMock = require(
  path.resolve(__dirname, '../../../railway-gateway/node_modules/ioredis-mock')
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail) => {
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`
  );
  if (!ok) failures++;
};

(async () => {
  const redis = new RedisMock();

  // cron lock (money-service CronLockService): SET key value PX ttl NX
  const a = await redis.set('money:cron-lock:job', 'a', 'PX', 150, 'NX');
  const b = await redis.set('money:cron-lock:job', 'b', 'PX', 150, 'NX');
  check(
    'cron lock: first instance wins (OK), second loses (null)',
    a === 'OK' && b === null,
    `${a} / ${b}`
  );
  check(
    "cron lock: the winner's value is kept",
    (await redis.get('money:cron-lock:job')) === 'a'
  );
  await sleep(220);
  check(
    'cron lock: it expires on its own (next firing can win)',
    (await redis.set('money:cron-lock:job', 'c', 'PX', 150, 'NX')) === 'OK'
  );

  // outbox consumer claim (operation-service): SET key in-flight EX 300 NX, then SET key done EX 604800, DEL
  const k = 'outbox-consumer:event:evt_1';
  const w = await redis.set(k, 'in-flight', 'EX', 300, 'NX');
  const l = await redis.set(k, 'in-flight', 'EX', 300, 'NX');
  check(
    'outbox claim: winner OK, loser null',
    w === 'OK' && l === null,
    `${w} / ${l}`
  );
  check(
    'outbox claim: loser can read the state',
    (await redis.get(k)) === 'in-flight'
  );
  await redis.set(k, 'done', 'EX', 604800);
  check(
    'outbox claim: marking done overwrites and keeps a long TTL',
    (await redis.get(k)) === 'done' && (await redis.ttl(k)) > 600000,
    `ttl ${await redis.ttl(k)}`
  );
  await redis.del(k);
  check(
    'outbox claim: release (DEL) frees it for the retry',
    (await redis.set(k, 'in-flight', 'EX', 300, 'NX')) === 'OK'
  );

  console.log(
    failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
})();
