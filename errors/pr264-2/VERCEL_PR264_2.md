12:57:59.677 Running build in Washington, D.C., USA (East) – iad1
12:57:59.678 Build machine configuration: 2 cores, 8 GB
12:57:59.811 Cloning github.com/ripper7375/trading-alerts-saas-public (Branch: claude/update-database-schema-4vEMp, Commit: 79cad39)
12:58:01.844 Cloning completed: 2.032s
12:58:02.468 Restored build cache from previous deployment (2LbYxiSb4RuFoDNWzyUuiRUhGJmt)
12:58:02.874 Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: https://vercel.link/node-version
12:58:02.875 Running "vercel build"
12:58:04.355 Vercel CLI 50.4.3
12:58:04.687 Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: https://vercel.link/node-version
12:58:04.696 Running "install" command: `npm install`...
12:58:06.671
12:58:06.672 up to date, audited 701 packages in 2s
12:58:06.672
12:58:06.672 184 packages are looking for funding
12:58:06.673 run `npm fund` for details
12:58:06.674
12:58:06.674 found 0 vulnerabilities
12:58:06.703 Detected Next.js version: 15.5.9
12:58:06.704 Running "npm run build"
12:58:07.163
12:58:07.166 > trading-alerts-frontend@0.1.0 prebuild
12:58:07.166 > rm -rf .next tsconfig.tsbuildinfo node_modules/.prisma && prisma generate
12:58:07.166
12:58:07.527 Prisma schema loaded from prisma/schema.prisma
12:58:08.306
12:58:08.307 ✔ Generated Prisma Client (v5.22.0) to ./node_modules/.prisma/client in 384ms
12:58:08.307
12:58:08.308 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
12:58:08.308
12:58:08.308 Tip: Need your database queries to be 1000x faster? Accelerate offers you that and more: https://pris.ly/tip-2-accelerate
12:58:08.308
12:58:08.505
12:58:08.505 > trading-alerts-frontend@0.1.0 build
12:58:08.505 > next build
12:58:08.505
12:58:09.148 Attention: Next.js now collects completely anonymous telemetry regarding usage.
12:58:09.149 This information is used to shape Next.js' roadmap and prioritize features.
12:58:09.149 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
12:58:09.149 https://nextjs.org/telemetry
12:58:09.150
12:58:09.227 ▲ Next.js 15.5.9
12:58:09.228 - Experiments (use with caution):
12:58:09.229 · serverActions
12:58:09.230 · optimizePackageImports
12:58:09.230
12:58:09.289 Creating an optimized production build ...
12:58:37.261 ✓ Compiled successfully in 27.5s
12:58:37.266 Linting and checking validity of types ...
12:58:40.541 ⨯ ESLint: Failed to load config "next/core-web-vitals" to extend from. Referenced from: /vercel/path0/.eslintrc.json
12:58:53.764 Failed to compile.
12:58:53.764
12:58:53.764 ./components/charts/indicator-toggles.tsx:102:19
12:58:53.764 Type error: Property 'colors' does not exist on type 'IndicatorMeta'. Did you mean 'color'?
12:58:53.764
12:58:53.764 [0m [90m 100 |[39m {meta[33m.[39mlabel}
12:58:53.764 [90m 101 |[39m [33m<[39m[33m/[39m[33mspan[39m[33m>[39m
12:58:53.764 [31m[1m>[22m[39m[90m 102 |[39m {meta[33m.[39mcolors [33m&&[39m hasAccess [33m&&[39m [33mObject[39m[33m.[39mvalues(meta[33m.[39mcolors)[[35m0[39m] [33m&&[39m (
12:58:53.764 [90m |[39m [31m[1m^[22m[39m
12:58:53.764 [90m 103 |[39m [33m<[39m[33mspan[39m
12:58:53.764 [90m 104 |[39m className[33m=[39m[32m"w-3 h-3 rounded-full flex-shrink-0"[39m
12:58:53.765 [90m 105 |[39m style[33m=[39m{{ backgroundColor[33m:[39m [33mObject[39m[33m.[39mvalues(meta[33m.[39mcolors)[[35m0[39m] }}[0m
12:58:53.817 Next.js build worker exited with code: 1 and signal: null
12:58:53.860 Error: Command "npm run build" exited with 1
