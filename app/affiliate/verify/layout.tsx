/**
 * Layout for Affiliate Email Verification
 *
 * This layout wraps the verify page and bypasses
 * the parent layout's authentication requirement.
 */

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Simple wrapper that doesn't require authentication
  return <>{children}</>;
}
