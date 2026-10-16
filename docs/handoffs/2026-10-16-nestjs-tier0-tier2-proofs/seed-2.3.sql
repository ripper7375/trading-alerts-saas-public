SET session_replication_role = replica;

DELETE FROM "Notification" WHERE "userId" IN ('u-dl','u-dl-old');
DELETE FROM "OutboxEvent" WHERE "aggregateId" IN ('u-dl','u-dl-old');
DELETE FROM "Subscription" WHERE "userId" IN ('u-dl','u-dl-old');
DELETE FROM "Payment" WHERE id IN ('pay-dl','pay-dl-old');
DELETE FROM "User" WHERE id IN ('u-dl','u-dl-old');
DELETE FROM "DisbursementTransaction" WHERE id IN ('dt-new','dt-old');

INSERT INTO "User"(id,email,"updatedAt") VALUES ('u-dl','dl@x.test',now()),('u-dl-old','dlold@x.test',now());

INSERT INTO "Payment"(id,"userId",provider,"providerPaymentId","providerStatus",amount,"amountUSD",currency,status,"updatedAt")
VALUES ('pay-dl','u-dl','DLOCAL','dl-1','PENDING',29,29,'USD','PENDING',now()),
       ('pay-dl-old','u-dl-old','DLOCAL','dl-old','PENDING',29,29,'USD','PENDING',now());

-- RiseWorks: two PENDING disbursement transactions, each for a PAID-able commission of 10
DELETE FROM "Commission" WHERE id IN ('rw-c-new','rw-c-old');
INSERT INTO "Commission"(id,"affiliateProfileId","affiliateCodeId","userId","grossRevenue","discountAmount","netRevenue","commissionAmount",status,"updatedAt")
VALUES ('rw-c-new','p1','c1','u1',50,0,50,10,'APPROVED',now()),('rw-c-old','p1','c1','u1',50,0,50,10,'APPROVED',now());
INSERT INTO "DisbursementTransaction"(id,"batchId","commissionId","transactionId",provider,amount,"providerTxId")
VALUES ('dt-new','batch-x','rw-c-new','TXN-NEW','MOCK',10,'ptx-new'),
       ('dt-old','batch-x','rw-c-old','TXN-OLD','MOCK',10,'ptx-old');
