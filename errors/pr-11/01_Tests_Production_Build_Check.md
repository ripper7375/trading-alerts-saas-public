The job failed due to two issues:

1. Several Next.js routes (including /charts/[symbol]/[timeframe], /watchlist, and others) attempt to use the headers API, which is not allowed during static rendering. See the Next.js error: "Route ... couldn't be rendered statically because it used headers. See more info here: https://nextjs.org/docs/messages/dynamic-server-error".

   **Solution:** Refactor these pages so that dynamic features requiring headers are only used in Server Components or API routes, not in components/pages that must be statically generated. For pages in app/(dashboard)/charts/[symbol]/[timeframe]/page.js and app/(dashboard)/watchlist/page.js, move any logic requiring headers into `getServerSideProps` or a server-side function, or ensure the page is marked as `dynamic = 'force-dynamic'` if you need dynamic rendering.

   Example:

   ```js
   // At the top of your page file
   export const dynamic = 'force-dynamic';
   ```

   Or move header-dependent logic to a server action or API route.

2. The production bundle size exceeds 250MB (actual: 267MB), which triggers a failure in the Build Check step.

   **Solution:** Reduce the bundle size by:
   - Removing unused dependencies and code.
   - Using dynamic imports for large, infrequently used components.
   - Auditing your .next output and dependencies for large modules.

   Adjustments should be made to keep the bundle size under 250MB to pass the workflow.

Review and apply these changes to fix the failing job.
