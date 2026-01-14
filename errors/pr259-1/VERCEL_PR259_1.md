20:33:46.900 Running build in Washington, D.C., USA (East) – iad1
20:33:46.901 Build machine configuration: 2 cores, 8 GB
20:33:47.117 Cloning github.com/ripper7375/trading-alerts-saas-public (Branch: claude/restore-part-6-service-W2h6I, Commit: 140209a)
20:33:49.147 Cloning completed: 2.029s
20:33:49.897 Restored build cache from previous deployment (2EzY3XuVWJ8VktA1t5MS5aBhJpko)
20:33:51.636 Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: http://vercel.link/node-version
20:33:51.637 Running "vercel build"
20:33:52.064 Vercel CLI 50.1.6
20:33:52.456 Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: http://vercel.link/node-version
20:33:52.468 Running "install" command: `npm install`...
20:33:54.399
20:33:54.400 up to date, audited 701 packages in 2s
20:33:54.401
20:33:54.401 184 packages are looking for funding
20:33:54.401 run `npm fund` for details
20:33:54.402
20:33:54.403 found 0 vulnerabilities
20:33:54.431 Detected Next.js version: 15.5.9
20:33:54.432 Running "npm run build"
20:33:54.537
20:33:54.538 > trading-alerts-frontend@0.1.0 prebuild
20:33:54.538 > rm -rf .next tsconfig.tsbuildinfo node_modules/.prisma && prisma generate
20:33:54.538
20:33:55.426 Prisma schema loaded from prisma/schema.prisma
20:33:56.229
20:33:56.231 ✔ Generated Prisma Client (v5.22.0) to ./node_modules/.prisma/client in 400ms
20:33:56.231
20:33:56.231 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
20:33:56.232
20:33:56.232 Tip: Want to turn off tips and other hints? https://pris.ly/tip-4-nohints
20:33:56.232
20:33:56.427
20:33:56.428 > trading-alerts-frontend@0.1.0 build
20:33:56.428 > next build
20:33:56.429
20:33:57.207 Attention: Next.js now collects completely anonymous telemetry regarding usage.
20:33:57.209 This information is used to shape Next.js' roadmap and prioritize features.
20:33:57.209 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
20:33:57.209 https://nextjs.org/telemetry
20:33:57.209
20:33:57.337 ▲ Next.js 15.5.9
20:33:57.338 - Experiments (use with caution):
20:33:57.338 · serverActions
20:33:57.339 · optimizePackageImports
20:33:57.339
20:33:57.414 Creating an optimized production build ...
20:34:20.305 Failed to compile.
20:34:20.305
20:34:20.305 ./components/charts/trading-chart.tsx
20:34:20.305 Module not found: Can't resolve './indicator-overlay'
20:34:20.305
20:34:20.305 https://nextjs.org/docs/messages/module-not-found
20:34:20.306
20:34:20.306 Import trace for requested module:
20:34:20.306 ./app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx
20:34:20.306
20:34:20.308
20:34:20.313 > Build failed because of webpack errors
20:34:20.379 Error: Command "npm run build" exited with 1
