'use client';

import { Button } from '@/components/ui/button';
import { Paperclip, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function HeroSection() {
  const [prompt, setPrompt] = useState('');
  const router = useRouter();

  const handleSubmit = () => {
    if (prompt.trim()) {
      router.push('/chat');
    }
  };

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-4xl space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-balance md:text-6xl">
            What do you want to create?
          </h1>
          <p className="text-muted-foreground text-xl">
            Start building with a single prompt. No coding needed.
          </p>
        </div>

        <div className="relative">
          <div className="border-border bg-background relative rounded-2xl border shadow-sm">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask v0 to build..."
              className="placeholder:text-muted-foreground min-h-[120px] w-full resize-none rounded-2xl bg-transparent px-6 py-4 text-base outline-none"
            />
            <div className="flex items-center justify-between px-4 pb-4">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                className="h-8 w-8 rounded-lg"
                disabled={!prompt.trim()}
                onClick={handleSubmit}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
