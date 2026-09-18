Source of Truth & Core References

docs/policies/08-locale-i18n-compliance.md (Mandatory: describes the 3 failure modes, currency gotchas, and audit procedures).

lib/context/locale-context.tsx (useLocale hook for Client Components).

lib/i18n/server-locale.ts & lib/i18n/get-dictionary.ts (for Server Components).

lib/country-config.ts (for SUPPORTED_COUNTRIES and server-side currency formatting).

docs/migration-orders/LESSONS-LEARNED.md (specifically **L40** for testing components wrapped in LocaleProvider).
