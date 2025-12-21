RiseWorks API Overview for Disbursement Integration

Key Information:
Base URL:

Production: https://b2b-api.riseworks.io/v1
Staging: https://b2b-api.staging-riseworks.io/v1

Core Integration Flow:

1. Authentication (SIWE - Sign-In with Ethereum)
   RiseWorks uses blockchain-based authentication:

Get a message to sign from the API
Sign it with your Ethereum wallet
Exchange the signature for a JWT bearer token
Use this token for all subsequent API calls

2. Key API Endpoints for Your Use Case:
   Teams & Talent Management:

GET /teams - Get your teams
GET /teams/{teamId}/talent - Get all users/affiliates in a team
GET /teams/{teamId}/talent/{talentId} - Get specific affiliate information

Invites:

POST /invites - Create and send email invites to affiliates
POST /invites/warmed - Create warmed invites
GET /invites - Get all invites for your company

Payments:

PUT /payments/pay - Initiate a payment (get typed data for signing)
POST /payments/pay - Execute a payment after signing
PUT /payments/batch-pay - Initiate batch payments
POST /payments/batch-pay - Execute batch payments
POST /payments/batch-pay-intents - Create pay intents to be executed manually

RiseID Information:

GET /riseid/{rise_id}/balance - Check balance

3. Payment Flow:
   Each affiliate needs a RiseID (blockchain-based account):

Invite affiliates via API or web app
Affiliates complete KYC/AML
They receive a RiseID address (e.g., 0xA35b2F326F07a7C92BedB0D318C237F30948E425)
You can then pay them using this RiseID

Payment amounts are in 1e6 units (USDC decimals):

$50 = 50,000,000 (50 \* 1e6)

4. Webhook Events
   RiseWorks provides webhooks for real-time notifications:

invite.accepted - When affiliate accepts invite
fund.received - When you receive funds
pay_schedule.created - When pay schedule is created
payment.received - When payment is received
account.duplication_detected - Security event

Integration Strategy for Your Affiliate Stack:

Sync Affiliate Data:

Use GET /teams/{teamId}/talent to fetch all affiliates and their RiseIDs
Store RiseID mapping in your affiliate marketing database

Calculate Commissions:

Your backend calculates commission amounts
Map affiliate identifiers to their RiseIDs

Execute Disbursements:

Use batch payment APIs for efficiency
Submit all payments in one API call
Affiliates can choose to receive in fiat (90+ currencies) or crypto

Monitor Status:

Set up webhooks to receive payment confirmations
Update your system when payments complete

Important Notes:

Compliance: All users must complete KYC/AML before receiving payments
Blockchain-based: All payments are executed on Arbitrum blockchain
Flexible withdrawal: Affiliates can withdraw in local currency, stablecoins, or cryptocurrencies
Setup time: After inviting affiliates, allow 1-2 days for onboarding completion
