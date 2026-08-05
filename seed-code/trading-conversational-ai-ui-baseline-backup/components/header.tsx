import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 3L13 21L21 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="/templates"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Templates
            </Link>
            <Link
              href="/enterprise"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Enterprise
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/ios"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              iOS
            </Link>
            <Link
              href="/students"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Students
            </Link>
            <Link
              href="/faq"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              FAQ
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            Sign In
          </Button>
          <Button size="sm">Sign Up</Button>
        </div>
      </div>
    </header>
  );
}
