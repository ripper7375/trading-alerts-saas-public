23:44:57.334 Running build in Washington, D.C., USA (East) – iad1
23:44:57.335 Build machine configuration: 2 cores, 8 GB
23:44:57.504 Cloning github.com/ripper7375/trading-alerts-saas-public (Branch: claude/implementation-roadmap-ZKooT, Commit: dbac2b6)
23:44:59.343 Cloning completed: 1.839s
23:44:59.908 Restored build cache from previous deployment (4ToKwyB66Y99zuiEXgNRXQv3GEVW)
23:45:00.315 Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: https://vercel.link/node-version
23:45:00.316 Running "vercel build"
23:45:01.407 Vercel CLI 50.4.4
23:45:01.765 Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: https://vercel.link/node-version
23:45:01.773 Running "install" command: `npm install`...
23:45:03.653
23:45:03.654 up to date, audited 701 packages in 2s
23:45:03.654
23:45:03.655 184 packages are looking for funding
23:45:03.655 run `npm fund` for details
23:45:03.655
23:45:03.656 found 0 vulnerabilities
23:45:03.689 Detected Next.js version: 15.5.9
23:45:03.690 Running "npm run build"
23:45:03.802
23:45:03.803 > trading-alerts-frontend@0.1.0 prebuild
23:45:03.803 > rm -rf .next tsconfig.tsbuildinfo node_modules/.prisma && prisma generate
23:45:03.803
23:45:04.187 Prisma schema loaded from prisma/schema.prisma
23:45:05.005
23:45:05.006 ✔ Generated Prisma Client (v5.22.0) to ./node_modules/.prisma/client in 399ms
23:45:05.006
23:45:05.007 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
23:45:05.007
23:45:05.007 Help us improve the Prisma ORM for everyone. Share your feedback in a short 2-min survey: https://pris.ly/orm/survey/release-5-22
23:45:05.007
23:45:05.203
23:45:05.203 > trading-alerts-frontend@0.1.0 build
23:45:05.203 > next build
23:45:05.203
23:45:05.884 Attention: Next.js now collects completely anonymous telemetry regarding usage.
23:45:05.885 This information is used to shape Next.js' roadmap and prioritize features.
23:45:05.885 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
23:45:05.886 https://nextjs.org/telemetry
23:45:05.886
23:45:05.968 ▲ Next.js 15.5.9
23:45:05.970 - Experiments (use with caution):
23:45:05.970 · serverActions
23:45:05.971 · optimizePackageImports
23:45:05.972
23:45:06.035 Creating an optimized production build ...
23:45:34.911 ✓ Compiled successfully in 28.4s
23:45:34.917 Linting and checking validity of types ...
23:45:38.002 ⨯ ESLint: Failed to load config "next/core-web-vitals" to extend from. Referenced from: /vercel/path0/.eslintrc.json
23:45:52.226 Failed to compile.
23:45:52.227
23:45:52.228 ./lib/api-client.ts:56:51
23:45:52.228 Type error: Property 'NEXT_PUBLIC_API_URL' comes from an index signature, so it must be accessed with ['NEXT_PUBLIC_API_URL'].
23:45:52.229
23:45:52.229 [0m [90m 54 |[39m constructor(config[33m?[39m[33m:[39m [33mApiClientConfig[39m) {
23:45:52.229 [90m 55 |[39m [90m// Use NEXT_PUBLIC_API_URL if set, otherwise default to Next.js API routes[39m
23:45:52.230 [31m[1m>[22m[39m[90m 56 |[39m [36mthis[39m[33m.[39mbaseURL [33m=[39m config[33m?[39m[33m.[39mbaseURL [33m||[39m process[33m.[39menv[33m.[39m[33mNEXT_PUBLIC_API_URL[39m [33m||[39m [32m'/api'[39m[33m;[39m
23:45:52.230 [90m |[39m [31m[1m^[22m[39m
23:45:52.230 [90m 57 |[39m
23:45:52.231 [90m 58 |[39m [90m// Remove trailing slash if present[39m
23:45:52.231 [90m 59 |[39m [36mif[39m ([36mthis[39m[33m.[39mbaseURL[33m.[39mendsWith([32m'/'[39m)) {[0m
23:45:52.282 Next.js build worker exited with code: 1 and signal: null
23:45:52.328 Error: Command "npm run build" exited with 1
