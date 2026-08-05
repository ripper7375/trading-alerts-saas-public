'use client';

import { Card } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const communityExamples = [
  {
    title: 'Effortless custom contract billing by Brilliance',
    description:
      'Streamline your billing process with seamless automation for custom contracts, powered by Brilliance.',
    image: '/contract-billing-interface-light-theme.jpg',
    symbol: 'XAUUSD',
  },
  {
    title: 'I create, therefore I am',
    description: 'A philosophical exploration through creative expression.',
    image: '/abstract-creative-dark-theme.jpg',
    dark: true,
    symbol: 'BTCUSD',
  },
  {
    title: 'Unleash the Power of AI Agents',
    description:
      'Accelerate your development workflow with intelligent AI agents that write, review, and optimize your code.',
    image: '/ai-agent-interface-gradient-dark-theme.jpg',
    dark: true,
    symbol: 'EURUSD',
  },
];

export function CommunitySection() {
  const router = useRouter();

  const handleCardClick = (symbol: string) => {
    router.push(`/?symbol=${symbol}`);
  };

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">From the Community</h2>
            <p className="text-muted-foreground">
              Explore what the community is building with v0.
            </p>
          </div>
          <Link
            href="/browse"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Browse All
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {communityExamples.map((example, index) => (
            <Card
              key={index}
              className="hover:border-foreground/20 group cursor-pointer overflow-hidden border border-border transition-colors"
              onClick={() => handleCardClick(example.symbol)}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={example.image || '/placeholder.svg'}
                  alt={example.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="space-y-2 p-6">
                <h3 className="text-lg font-medium leading-tight">
                  {example.title}
                </h3>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {example.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
