import Image from 'next/image';
import Link from 'next/link';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({
  children,
}: AuthLayoutProps): React.ReactElement {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />

      <Link
        href="/"
        className="group relative z-10 mb-6 flex items-center gap-2"
      >
        <div className="relative flex h-10 w-10 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/20 p-0.5 shadow-lg shadow-amber-500/20 transition-transform group-hover:scale-105">
          <Image
            src="/davintrade-ai-icon.png"
            alt="DavinTrade AI"
            width={40}
            height={40}
            className="h-full w-full rounded-[9px] object-cover"
            priority
          />
        </div>
        <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 bg-clip-text text-xl font-black tracking-tight text-transparent dark:from-amber-400 dark:via-amber-200 dark:to-yellow-500">
          DavinTrade
        </span>
      </Link>

      <div className="relative z-10 flex w-full flex-col items-center">
        {children}
      </div>
    </div>
  );
}
