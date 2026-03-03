Microservice A, B, C, D ---> @nestjs/bullmq (BULLMQ is wrapped by Nest.js) ---> ioredis library (write to redis) ---> redis (casual database) = Job Queue ---> ioredis library (read fron redis) ---> Background Worker Service_1, 2, 3, 4 (BULLMQ is wrapped by Nest.js) (1, 2, 3, 4 = Multiple workers read from redis and write to PostgreSQL) ---> Prisma_A, B, C, D for Microservice A, B, C, D (Translators between Nest.js and PostgreSQL) ---> PostgreSQL_A, B, C, D (permanent databases for Prisma_A, B, C, D)

==============================================

My SaaS on MVP stage

MT5 terminal 1 2 3 4 5 ---> @nestjs/bullmq (BULLMQ is wrapped by Nest.js) ---> ioredis library (write to redis) ---> redis(casual database) = Job Queue ---> ioredis library (read from redis) ---> Background Worker Service (BULLMQ is wrapped by Nest.js) (worker reads from redis and writes to PostgreSQL) ---> Single Prisma (Translator between Nest.js and PostgreSQL) ---> Single PostgreSQL (permanent database)

==============================================

Since you are using a Single Redis and a Single Worker, use Named Queues in BullMQ.

this.bullModule.registerQueue({ name: 'emails' })
this.bullModule.registerQueue({ name: 'image-processing' })

Based on 2 name queues above ---> email is prioritized over image-processing

===============================================
