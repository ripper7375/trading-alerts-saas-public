15:15:39.858 Running build in Washington, D.C., USA (East) – iad1
15:15:39.859 Build machine configuration: 2 cores, 8 GB
15:15:40.112 Cloning github.com/ripper7375/trading-alerts-saas-public (Branch: claude/update-database-schema-4vEMp, Commit: 186059a)
15:15:42.686 Cloning completed: 2.573s
15:15:43.231 Restored build cache from previous deployment (2LbYxiSb4RuFoDNWzyUuiRUhGJmt)
15:15:43.734 Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: https://vercel.link/node-version
15:15:43.735 Running "vercel build"
15:15:44.936 Vercel CLI 50.4.3
15:15:45.305 Warning: Detected "engines": { "node": ">=20.0.0" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: https://vercel.link/node-version
15:15:45.314 Running "install" command: `npm install`...
15:15:48.348
15:15:48.348 up to date, audited 701 packages in 3s
15:15:48.349
15:15:48.350 184 packages are looking for funding
15:15:48.350 run `npm fund` for details
15:15:48.351
15:15:48.351 found 0 vulnerabilities
15:15:48.384 Detected Next.js version: 15.5.9
15:15:48.385 Running "npm run build"
15:15:48.494
15:15:48.495 > trading-alerts-frontend@0.1.0 prebuild
15:15:48.495 > rm -rf .next tsconfig.tsbuildinfo node_modules/.prisma && prisma generate
15:15:48.495
15:15:48.988 Prisma schema loaded from prisma/schema.prisma
15:15:49.880
15:15:49.882 ✔ Generated Prisma Client (v5.22.0) to ./node_modules/.prisma/client in 457ms
15:15:49.883
15:15:49.883 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
15:15:49.884
15:15:49.884 Tip: Want to turn off tips and other hints? https://pris.ly/tip-4-nohints
15:15:49.884
15:15:50.075
15:15:50.076 > trading-alerts-frontend@0.1.0 build
15:15:50.076 > next build
15:15:50.076
15:15:50.798 Attention: Next.js now collects completely anonymous telemetry regarding usage.
15:15:50.798 This information is used to shape Next.js' roadmap and prioritize features.
15:15:50.798 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
15:15:50.799 https://nextjs.org/telemetry
15:15:50.799
15:15:50.888 ▲ Next.js 15.5.9
15:15:50.888 - Experiments (use with caution):
15:15:50.889 · serverActions
15:15:50.889 · optimizePackageImports
15:15:50.889
15:15:50.960 Creating an optimized production build ...
15:16:21.564 ✓ Compiled successfully in 30.1s
15:16:21.567 Linting and checking validity of types ...
15:16:25.100 ⨯ ESLint: Failed to load config "next/core-web-vitals" to extend from. Referenced from: /vercel/path0/.eslintrc.json
15:16:39.115 Failed to compile.
15:16:39.115
15:16:39.115 ./components/charts/indicator-toggles.tsx:102:19
15:16:39.115 Type error: Property 'colors' does not exist on type 'IndicatorMeta'. Did you mean 'color'?
15:16:39.115
15:16:39.115 [0m [90m 100 |[39m {meta[33m.[39mlabel}
15:16:39.116 [90m 101 |[39m [33m<[39m[33m/[39m[33mspan[39m[33m>[39m
15:16:39.116 [31m[1m>[22m[39m[90m 102 |[39m {meta[33m.[39mcolors [33m&&[39m hasAccess [33m&&[39m [33mObject[39m[33m.[39mvalues(meta[33m.[39mcolors)[[35m0[39m] [33m&&[39m (
15:16:39.116 [90m |[39m [31m[1m^[22m[39m
15:16:39.116 [90m 103 |[39m [33m<[39m[33mspan[39m
15:16:39.116 [90m 104 |[39m className[33m=[39m[32m"w-3 h-3 rounded-full flex-shrink-0"[39m
15:16:39.116 [90m 105 |[39m style[33m=[39m{{ backgroundColor[33m:[39m [33mObject[39m[33m.[39mvalues(meta[33m.[39mcolors)[[35m0[39m] }}[0m
15:16:39.168 Next.js build worker exited with code: 1 and signal: null
15:16:39.213 Error: Command "npm run build" exited with 1
