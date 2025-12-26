import Link from 'next/link';

/**
 * Dashboard Footer Component
 *
 * Minimal footer for the dashboard with essential links.
 * Full marketing footer is separate for public pages.
 */
export function Footer(): React.ReactElement {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-white dark:bg-gray-800 dark:border-gray-700">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          {/* Copyright */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span role="img" aria-label="Trading Alerts">
              📊
            </span>
            <span>© {currentYear} Trading Alerts. All rights reserved.</span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <Link
              href="/settings/help"
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Help Center
            </Link>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <Link
              href="/settings/privacy"
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Privacy
            </Link>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <Link
              href="/settings/terms"
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Terms
            </Link>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <a
              href="https://status.tradingalerts.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Status
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
