SELECT 'dup-invoice' AS check, "affiliateCodeId", "stripeInvoiceId", COUNT(*) AS "rows",
       ARRAY_AGG("id" ORDER BY "createdAt","id") AS "ids"
FROM "Commission"
WHERE "stripeInvoiceId" IS NOT NULL
GROUP BY "affiliateCodeId", "stripeInvoiceId"
HAVING COUNT(*) > 1;

SELECT 'dup-clawback' AS check, "clawbackOfCommissionId", COUNT(*) AS "rows",
       ARRAY_AGG("id" ORDER BY "createdAt","id") AS "ids"
FROM "Commission"
WHERE "clawbackOfCommissionId" IS NOT NULL
GROUP BY "clawbackOfCommissionId"
HAVING COUNT(*) > 1;
