/**
 * Layout for Affiliate Registration
 *
 * This layout wraps the register page and bypasses
 * the parent layout's authentication requirement.
 */

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Simple wrapper that doesn't require authentication
  return <>{children}</>;
}
