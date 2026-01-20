Migration Roadmap to Link Backend Stack A and Frontend UI Only Stack Together

1. Create Nest.js project in monolith folder (basic setup only)
   - Install Nest.js dependencies
   - Set up folder structure (src/modules/, src/shared/)
   - Configure Prisma connection
   - Create main.ts entry point
   - Test locally: npm run start:dev → should start (even if empty)

2. Migrate ONE API module to Nest.js (e.g., alerts)
   - Create alerts.controller.ts
   - Create alerts.service.ts
   - Create alerts.module.ts
   - Test locally: http://localhost:3001/api/alerts

3. Test Nest.js API independently (local testing)
   - Use Postman/Insomnia to test endpoints
   - Verify authentication works
   - Verify database queries work
   - Check error handling

4. Deploy Nest.js to Railway (with working alerts module)
   - Configure Railway environment variables
   - Deploy and verify it starts
   - Test Railway API URL works

5. Update frontend to point to Railway API
   - Set NEXT_PUBLIC_API_URL in Vercel
   - Redeploy frontend
   - Test alerts module works from UI

6. Verify everything works end-to-end
   - Frontend (Vercel) → Nest.js API (Railway) → Database
   - Authentication works across domains
   - CORS configured correctly

7. Repeat for other modules
   - Migrate watchlist module
   - Deploy to Railway (same deployment)
   - Test end-to-end
   - Repeat for all modules

8. Remove Next.js files from monolith when all migrated
   - Delete app/ folder (UI already in frontend/)
   - Delete components/ folder
   - Keep only: src/, prisma/, package.json (Nest.js)

===========================================================

✅ 1. Create Nest.js project in monolith folder

Install Nest.js dependencies

Set up folder structure

Configure Prisma connection

✅ 2. Migrate ONE API module (e.g., alerts)

Create controller, service, module

Test locally first

✅ 3. Test Nest.js API independently (local)

Use Postman/Insomnia

Verify all endpoints work

✅ 4. Deploy to Railway (after module works)

Configure environment variables

Deploy and test

✅ 5. Update frontend to point to Railway API

Set NEXT_PUBLIC_API_URL in Vercel

Redeploy frontend

✅ 6. Verify everything works end-to-end

Frontend (Vercel) → Nest.js (Railway) → Database

Test authentication, CORS, etc.

✅ 7. Repeat for other modules

Migrate watchlist, users, settings, etc.

✅ 8. Remove Next.js files when all migrated

Clean up monolith folder

Keep only Nest.js files
