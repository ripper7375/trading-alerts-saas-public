INSERT INTO "User"(id,email,"updatedAt") VALUES ('u1','a@x.test',now()),('aff-user','aff@x.test',now());
INSERT INTO "AffiliateProfile"(id,"userId","fullName",country,"paymentMethod","paymentDetails","updatedAt")
  VALUES ('p1','aff-user','Aff','US','PAYPAL','{}',now());
INSERT INTO "AffiliateCode"(id,code,"affiliateProfileId","discountPercent","commissionPercent","expiresAt","updatedAt")
  VALUES ('c1','AFF10','p1',20,20,now()+interval '1 day',now());
-- the race outcome we are guarding against: two commissions for one code and one invoice
INSERT INTO "Commission"(id,"affiliateProfileId","affiliateCodeId","userId","stripeInvoiceId","grossRevenue","discountAmount","netRevenue","commissionAmount","updatedAt")
  VALUES ('k1','p1','c1','u1','inv_dup',29,5.8,23.2,4.64,now()),
         ('k2','p1','c1','u1','inv_dup',29,5.8,23.2,4.64,now());
-- two clawback rows for one original commission
INSERT INTO "Commission"(id,"affiliateProfileId","affiliateCodeId","userId","clawbackOfCommissionId","grossRevenue","discountAmount","netRevenue","commissionAmount","updatedAt")
  VALUES ('cb1','p1','c1','u1','k1',-29,-5.8,-23.2,-4.64,now()),
         ('cb2','p1','c1','u1','k1',-29,-5.8,-23.2,-4.64,now());
-- rows that must NEVER conflict: NULL invoice (dLocal / legacy), two of them
INSERT INTO "Commission"(id,"affiliateProfileId","affiliateCodeId","userId","grossRevenue","discountAmount","netRevenue","commissionAmount","updatedAt")
  VALUES ('n1','p1','c1','u1',29,0,29,5.8,now()),('n2','p1','c1','u1',29,0,29,5.8,now());
