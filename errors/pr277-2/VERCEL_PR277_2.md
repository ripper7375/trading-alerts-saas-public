03:21:09.343 Running build in Washington, D.C., USA (East) – iad1
03:21:09.344 Build machine configuration: 2 cores, 8 GB
03:21:09.471 Cloning github.com/ripper7375/trading-alerts-saas-public (Branch: claude/separate-ui-elements-ZKooT, Commit: f7f4baa)
03:21:11.361 Cloning completed: 1.890s
03:21:12.093 Restored build cache from previous deployment (5RnRxAPrKbUHwUkEW8to1e8evhnH)
03:21:12.556 Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: https://vercel.link/node-version
03:21:12.557 Running "vercel build"
03:21:14.997 Vercel CLI 50.4.4
03:21:15.386 Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: https://vercel.link/node-version
03:21:15.395 Running "install" command: `npm install`...
03:21:17.267
03:21:17.267 up to date, audited 701 packages in 2s
03:21:17.267
03:21:17.268 184 packages are looking for funding
03:21:17.268 run `npm fund` for details
03:21:17.269
03:21:17.270 found 0 vulnerabilities
03:21:17.303 Detected Next.js version: 15.5.9
03:21:17.304 Running "npm run build"
03:21:17.408
03:21:17.408 > trading-alerts-frontend@0.1.0 prebuild
03:21:17.409 > rm -rf .next tsconfig.tsbuildinfo node_modules/.prisma && prisma generate
03:21:17.409
03:21:17.807 Prisma schema loaded from prisma/schema.prisma
03:21:18.643
03:21:18.645 ✔ Generated Prisma Client (v5.22.0) to ./node_modules/.prisma/client in 417ms
03:21:18.646
03:21:18.646 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
03:21:18.647
03:21:18.647 Tip: Want to turn off tips and other hints? https://pris.ly/tip-4-nohints
03:21:18.647
03:21:18.839
03:21:18.840 > trading-alerts-frontend@0.1.0 build
03:21:18.840 > next build
03:21:18.840
03:21:19.537 Attention: Next.js now collects completely anonymous telemetry regarding usage.
03:21:19.538 This information is used to shape Next.js' roadmap and prioritize features.
03:21:19.538 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
03:21:19.538 https://nextjs.org/telemetry
03:21:19.538
03:21:19.638 ▲ Next.js 15.5.9
03:21:19.639 - Experiments (use with caution):
03:21:19.639 · serverActions
03:21:19.639 · optimizePackageImports
03:21:19.640
03:21:19.714 Creating an optimized production build ...
03:21:49.179 ✓ Compiled successfully in 28.9s
03:21:49.184 Linting and checking validity of types ...
03:21:52.958 ⨯ ESLint: Failed to load config "next/core-web-vitals" to extend from. Referenced from: /vercel/path0/.eslintrc.json
03:22:06.695 Failed to compile.
03:22:06.695
03:22:06.695 ./jest.setup.ts:11:3
03:22:06.695 Type error: Type '(id: Timeout) => void' is not assignable to type '(immediate: Immediate | undefined) => void'.
03:22:06.695 Types of parameters 'id' and 'immediate' are incompatible.
03:22:06.695 Type 'Immediate | undefined' is not assignable to type 'Timeout'.
03:22:06.695 Type 'undefined' is not assignable to type 'Timeout'.
03:22:06.695
03:22:06.696 [0m [90m 9 |[39m [90m// undici uses clearImmediate which is a Node.js global, not implemented in jsdom[39m
03:22:06.696 [90m 10 |[39m [36mif[39m ([36mtypeof[39m global[33m.[39mclearImmediate [33m===[39m [32m'undefined'[39m) {
03:22:06.696 [31m[1m>[22m[39m[90m 11 |[39m global[33m.[39mclearImmediate [33m=[39m [36mfunction[39m (id[33m:[39m [33mNodeJS[39m[33m.[39m[33mTimeout[39m) {
03:22:06.696 [90m |[39m [31m[1m^[22m[39m
03:22:06.696 [90m 12 |[39m [36mreturn[39m clearTimeout(id)[33m;[39m
03:22:06.696 [90m 13 |[39m }[33m;[39m
03:22:06.696 [90m 14 |[39m }[0m
03:22:06.751 Next.js build worker exited with code: 1 and signal: null
03:22:06.795 Error: Command "npm run build" exited with 1
