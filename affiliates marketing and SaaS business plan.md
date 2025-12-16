ANSWER to 15. OPEN QUESTIONS & DECISIONS NEEDED

Before implementation, please decide:

1. **Code Format Preference:**
   - Option A: Auto-generated (e.g., TRADE8A3B2C1D) ---> Yes to this (code format must be full random with >12 characters e.g. SxTYo25#1dpgiNguD because code would be one-time use; once expired, user must contact affiliates or search for new code from social media that affiliates posted.
   - Option B: Admin-provided custom (e.g., SAVE20PRO)
   - Option C: Hybrid (prefix + random, e.g., AFFILIATE-8A3B2C1D)

2. **Maximum Discount:**
   - Current design: 50% max ---> Yes to this
   - Adjust if needed (e.g., 30% max for safety)

3. **Commission Payment Method:**
   - Current design: Manual (PayPal/Bank Transfer) ---> Yes to this
   - Future: Automated Stripe payouts?

4. **Affiliate Self-Service:**
   - MVP: Admin manages everything ---> No to this (This is not transparent and result in low trust in business engagement by affiliates)
   - Future: Let affiliates log in to view earnings? ---> affiliates should have their own log in page to view their

(1) Code inventory report :

Here is logic of code inventory report

(1.0) opening codes balance, at beginning of current month = this codes balance came from closing codes balance at the end of previous month  
(1.1) discount codes received from Admin during current month (codes received) (as Admin allocates codes to all individual affiliates)
(1.2) codes used by free tier user to upgrade to pro plan during current month (codes used)
(1.3) codes expired  
(1.4) codes cancelled by Admin during current month (code cancelled) (as Admin may want to discontinue with this affiliate or as marketing plan was changed)
(1.5) closing codes balance, at end of current month = (1.0) + (1.1) - (1.2) - (1.3) - (1.4)

Code Inventory Main Report (display code inventory movement for 3 most recent months)

2566956, John
United States
Code Inventory (Main Report) (in Unit) November 2025 October 2025 September 2025
(Current month) (Last month) (Last 2 month)
================================================================================================
Codes opening balance (1.0)

- Codes Received (1.1)

* Codes Used (1.2)
* Codes Expired (1.3)
* Codes Cancelled (1.4)
  = Codes closing balance (1.5)

(1.1), (1.2), (1.3), (1.4) are clickable --> navigate to subsidiary reports of Code Inventory Main Report

When click on Codes Received (1.1) ---> navigate to subsidiary report below

Codes Reception Report (main header)
For September - November, 2025 (3 most recent months) (sub-header)
4 Columns ---> No. | Reception time and date | Codes Numbers (e.g. SxTYo25#1dpgiNguD) | %Discount (e.g. 20% discount, 25% discount, etc)

When click on Codes Used (1.2) ---> navigate to subsidiary report below

Codes Usage Report (main header)
For September - November, 2025 (3 most recent months) (sub-header)
4 Columns ---> No. | Being Used time and date | Codes Numbers | %Discount (e.g. 20% discount, 25% discount, etc)

When click on Codes Expired (1.3) ---> navigate to subsidiary report below

Codes Expiration Report (main header)
For September - November, 2025 (3 most recent months) (sub-header)
4 Columns ---> No. | Expired time and date | Codes Numbers | %Discount (e.g. 20% discount, 25% discount, etc)

When click on Codes Cancelled (1.4) ---> navigate to subsidiary report below

Codes Cancellation Report (main header)
For September - November, 2025 (3 most recent months) (sub-header)
5 Columns ---> No. | Cancelled time and date | Codes Numbers | %Discount (e.g. 20% discount, 25% discount, etc) | Reason for Cancellation (specified by admin)

(2) Commission Receivable Report

Here is logic of commission receivable report

(2.0) Opening commission receivable balance, at the beginning of current month = this balance came from closing codes balance at the end of previous month
(2.1) Commission earned during current month (Commission Earned)
(2.2) Commission paid during current month (Disbursement of commission earned in previous month to affiliates)
(2.3) Closing commission receviable balance, at the end of current month = (2.0) + (2.1) + (2.2) = (2.3)

Commission Receivable Main Report (display code inventory movement for 3 most recent months)

Commission Receivable (Main Report) (in USD) November 2025 October 2025 September 2025
(Current month) (Last month) (Last 2 month)
================================================================================================================
Commission Receivable opening balance (2.0)

- Commission Earned (2.1)

* Commission Paid (2.2)
  = Commission Receivable closing balance (2.3)

(2.1) and (2.2) are clickable ---> navigate to subsidiary reports of Commission Receivable Main Report

When click on Commission Earned (2.1) ---> navigate to subsidiary report below

Commission Earnings Report (main header)
For September - November, 2025 (3 most recent months) (sub-header)
5 Columns ---> No. | Time and date of Payment was received from code was used | Codes Numbers (e.g. TRADE2024ABC) | %Discount (e.g. 20% discount, 25% discount, etc) | Amount of Commission Earned

Note : Must have sum of amount of commission earned for a sigle month.

When click on Commission Paid (2.2) ---> navigate to subsidiary report below

Commission Payment Report (main header)
For September - November, 2025 (3 most recent months) (sub-header)
4 Columns ---> No. | Time and date of Payment was paid to Affiliates | Month of Commission Incurrence (from last month earned) | Amount Paid (USD) | Remark from Admin

(3) Afflitate profile page

This page comes from Affilate registeration login (like user registeration for login)

Note : This page must specify country in which affiliate conduct marketing activities in promoting PRO Plan + social media channels used by the affiliate to promote PRO Plan (these are very important for Market strategy evaluation for Admin).

Note : Afflitate profile page must have contact information of Affilate (e.g. Whatsapp, telegram, facebook messenger, X (DM), Telephone, in addition to email in registeration form of Affiliates (This is very important for Admin could contact affiliate directly and instantly)

Note : Afflitate profile page must have preferred choice of commission receiption (payment to affiliate) let affiliate choose one of the followings

(1) Local bank transfers in local currency
(2) Crypto transfers (in USDT) to affiliate's crypto wallet
(3) Global digital wallets (in USD) e.g. Paypal, Apple Pay, Google Pay, Stripe Wallet
(4) Local/Regional Digital Wallets in local currency

This could be used for appropriate means of payment to affiliates

4.5 Admin should have dashboards (pages) that shows

4.5.1) Profit and Loss Report for last 3 months

Profit and Loss Report (in USD)
For September - November 2025
November 2025 (A) October 2025 (B) September 2025 (C)
=======================================================================================================================================
Gross Sales Revenue
Less : Sales Discount to users
Equal to : Net Sales Revenue
Less : Commission Earned by (not paid to) Affiliates
Equal to : Net Contribution from Sales

When click on November 2025 (A) ---> navigate to subsidiary report below

Sales Performance Report
For November, 2025 (sum amount from beginning of month till current date of the month but not exceed end of month)
====================================================================================================================================================
No. | Affiliate ID | Name of Affiliate | Country of Affiliates | Social Medias used | Gross Sales | Sales Discount | Commission Earned by Affiliate
====================================================================================================================================================

1.                  2566956            John               United States       Tiktok, X, Facebook    $ xxxxxx        $ xxxxx               $ xxxxxx
2.                  2666955            Mike                 Indonesia           Tiktok, Youtube      $ xxxxxx        $ xxxxx               $ xxxxxx
3.                  2685558            Beer                 Thailand             Facebook, IG        $ xxxxxx        $ xxxxx               $ xxxxxx
    Total amounts $ xxxxxxx $ xxxxxx $ xxxxxxxx

When click on October 2025 (B) ---> navigate to same subsidiary report as above but for October 2025
When click on September 2025 (C) ---> navigate to same subsidiary report as above but for September 2025

When click on November 2025 (A) and then click on 2566956 ---> navigate to subsidiary report below

2566956, John
United States
Tiktok, X, Facebook
For November, 2025
===================================================================================================================
No. | Time / Date of Payment was received by SaaS | Gross Sales | Sales Discount | Commission Earned by Affiliate
====================================================================================================================

1.
2.
3. Total Amounts xxxxxx xxxxxxxxxx xxxxxxxxxxx

When click on October 2025 (B) and then click on 2666955 ---> navigate to subsidiary report below

2666955, Mike
Indonesia
Tiktok, Youtube
For October, 2025
===================================================================================================================
No. | Time / Date of Payment was received by SaaS | Gross Sales | Sales Discount | Commission Earned by Affiliate
====================================================================================================================

1.
2.
3. Total Amounts xxxxxx xxxxxxxxxx xxxxxxxxxxx

   4.5.2) Commission Owings Report (This is report shows Admin owed Commission to Affiliates)

# Commission Owings Report

# No. | Affiliate ID | Name of Affiliate | Country | Month of Commission Incurrence | Amount of Commission due | Date of Payment (specified by admin)\*\* | Overdue (Yes / No)

1.
2.
3.                                                                                                      $  xxxxxxxxxxx

\*\* Admin must declare commission payment date to all affiliates in advance (SaaS must have predetermined commission payment date e.g. every 5th of next month OR must provide input box in allowing admin to fill date of upcoming commission payment in override of predetermined commission payment date)

Note : Affiliates whose name are eligible for this report are one who have commission earned but not yet paid for both Payment is not yet due and Payment is overdue. Once payments were made to affiliates (manual checkout by admin) and had no new (zero) commission earned by those affiliates ---> result in name of those affiliates who previously are in this report were removed.

Commission Owings Report provide quick view of commission payment status of SaaS Admin.

4.5.3) Aggregate Code inventory report (All codes from all affiliates)

Aggregate Code Inventory (Main Report) (in Unit) November 2025 October 2025 September 2025
(Current month) (Last month) (Last 2 month)
====================================================================================================================
Aggregate Codes opening balance (x0)

- Aggregate Codes Received (x1)

* Aggregate Codes Used (x2)
* Aggregate Codes Expired (x3)
* Aggregate Codes Cancelled (x4)
  = Aggregate Codes closing balance (x5)

(x1), (x2), (x3), (x4) are clickable --> navigate to subsidiary reports of Aggregate Code Inventory Report

When click on Aggregate Codes Received (x1) ---> navigate to subsidiary report below

Aggregate Codes Reception Report (main header)
For September - November, 2025 (3 most recent months) (sub-header)
5 Columns ---> No. | Reception time and date | Codes Numbers (e.g. SxTYo25#1dpgiNguD) | %Discount (e.g. 20% discount, 25% discount, etc) | Affilate ID who own this code

When click on Aggregate Codes Used (x2) ---> navigate to subsidiary report below

Aggregate Codes Usage Report (main header)
For September - November, 2025 (3 most recent months) (sub-header)
5 Columns ---> No. | Being Used time and date | Codes Numbers | %Discount (e.g. 20% discount, 25% discount, etc) | Affiliate ID who own this code

When click on Codes Expired (x3) ---> navigate to subsidiary report below

Aggregate Codes Expiration Report (main header)
For September - November, 2025 (3 most recent months) (sub-header)
5 Columns ---> No. | Expired time and date | Codes Numbers | %Discount (e.g. 20% discount, 25% discount, etc) | Affiliate ID who own this code

When click on Codes Cancelled (x4) ---> navigate to subsidiary report below

Aggregate Codes Cancellation Report (main header)
For September - November, 2025 (3 most recent months) (sub-header)
6 Columns ---> No. | Cancelled time and date | Codes Numbers | %Discount (e.g. 20% discount, 25% discount, etc) | Affiliate ID who own this code
| Reason for Cancellation (specified by admin)

At inception of being Affiliates (at a time of affiliate account is created) ---> 15 Codes are given to the each affiliate account.

Useful life of code = last until end of month (all codes issued during current month will be expired at the end of month - at time of xx:xx:xx (you may specify this standard time for expiration))

New code is issued at beginning of the month at time xx:xx:xx (you may specify this standard time for new code distribution to all affiliates)

How many new codes should be given to each different affiliates ? ---> answer = 15 codes ; in case 15 codes are used up before end of month, affiliate may contact admin and ask for more codes, admin may generate more codes and specifically distribute to that affiliate (must have code generation and distribution page for admin to generate and distribute code to affiliate using affiliate ID as identification for code distribution).

5. **Code Usage Limits:**
   - Current design: Unlimited uses per code ---> Yes to this
   - Future: Max uses per code? (e.g., first 100 users)

6. **Recurring Commissions:**
   - Current design: One-time commission on signup ---> Yes to this (I do not agree with Recurring commission on renewal as code is used just one-time, if user want to renew the PRO Plan, user must contact affiliate (maybe the one who used to give code to the user or new one who has never provide code to user). Therefore this would encourage competition among affiliates in reaching out potential users.
   - Future: Recurring commissions on renewals? ---> I disagree this!

=================================================================

Please redesign the SaaS system to reflect all requirements above (prefer to use Next.js 15 backend engine and postgreSQL for SaaS system design)

You may first study ui-frontend-user-journey/saas-user-journey-updated.md + 3 mermaid diagrams in ui-frontend-user-journey/mermaid-diagrams folder

then

incorporate your previously proposed plan + my business plan above into saas-user-journey-updated.md

then

(1) update docs/AFFILIATE-MARKETING-DESIGN.md
(2) update docs/AFFILIATE-MARKETING-INTEGRATION-CHECKLIST.md
(3) create a complete updated version of saas-user-journey-updated.md
(4) update all mermaid diagrams in the ui-frontend-user-journey/mermaid-diagrams folder (you may create new/add mermaid diagrams if deem appropriate)

Remark : I am not just doing business as a SaaS provider but doing business as SaaS distributor as well so affilate marketing plan is seriously deemed as core business as well.
