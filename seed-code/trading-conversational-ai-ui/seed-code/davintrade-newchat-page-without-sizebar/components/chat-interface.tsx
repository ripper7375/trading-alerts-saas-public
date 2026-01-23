'use client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Brain, Link, Folder, ArrowUp } from 'lucide-react';
import { PulsingBorder } from '@paper-design/shaders-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export function ChatInterface() {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      const dashboardUrl =
        process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
      const url = new URL(dashboardUrl);
      if (theme) url.searchParams.set('theme', theme);
      window.location.href = url.toString();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center overflow-hidden p-4">
      <div className="relative w-full max-w-4xl">
        <motion.div
          className="mb-4 flex flex-col items-center justify-center gap-0"
          animate={{
            y: isFocused ? -20 : 0,
            opacity: isFocused ? 0 : 100,
            filter: isFocused ? 'blur(4px)' : 'blur(0px)',
          }}
          transition={{
            duration: 0.5,
            type: 'spring',
            stiffness: 200,
            damping: 20,
          }}
        >
          <div className="flex -translate-x-20 items-end justify-center gap-0">
            <Image
              src="/davintrade-mascot.svg"
              alt="DavinTrade Mascot"
              width={500}
              height={500}
              className="object-contain"
            />
            <Image
              src="/davintrade-logo.svg"
              alt="DavinTrade Logo"
              width={320}
              height={90}
              className="-ml-40 object-contain"
            />
          </div>
          <p className="-mt-8 text-center text-sm font-medium tracking-wide text-[#BA9465] opacity-90">
            I am here to help with chart technical analysis and trade setup
          </p>
        </motion.div>

        <div className="relative">
          <motion.div
            className="absolute z-0 flex h-full w-full items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isFocused ? 1 : 0 }}
            transition={{
              duration: 0.8,
            }}
          >
            <PulsingBorder
              style={{ height: '146.5%', minWidth: '143%' }}
              colorBack={
                theme === 'dark' ? 'hsl(0, 0%, 0%)' : 'hsl(0, 0%, 100%)'
              }
              roundness={0.18}
              thickness={0}
              softness={0}
              intensity={0.3}
              bloom={2}
              spots={2}
              spotSize={0.25}
              pulse={0}
              smoke={0.35}
              smokeSize={0.4}
              scale={0.7}
              rotation={0}
              offsetX={0}
              offsetY={0}
              speed={1}
              colors={[
                'hsl(29, 70%, 37%)',
                'hsl(32, 100%, 83%)',
                'hsl(4, 32%, 30%)',
                'hsl(25, 60%, 50%)',
                'hsl(0, 100%, 10%)',
              ]}
            />
          </motion.div>

          <motion.div
            className="relative z-10 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-zinc-200/50 dark:border-[#3D3D3D] dark:bg-[#040404] dark:shadow-black/80"
            animate={{
              borderColor: isFocused ? '#BA9465' : '',
            }}
            transition={{
              duration: 0.6,
              delay: 0.1,
            }}
            style={{
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            {/* Message Input */}
            <div className="relative mb-6">
              <Textarea
                placeholder="How can I help you today ?"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[80px] resize-none border-none bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none dark:text-white dark:placeholder:text-zinc-500 [&:focus]:ring-0 [&:focus]:outline-none [&:focus-visible]:ring-0 [&:focus-visible]:outline-none"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </div>

            <div className="flex items-center justify-between">
              {/* Left side icons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full bg-zinc-100 p-0 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:hover:text-white"
                >
                  <Brain className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full bg-zinc-100 p-0 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                >
                  <Link className="h-4 w-4" />
                </Button>
                {/* Center model selector */}
                <div className="flex items-center">
                  {mounted && (
                    <Select defaultValue="gpt-4">
                      <SelectTrigger className="h-8 min-w-[150px] rounded-full border-zinc-200 bg-zinc-100 px-2 text-xs text-zinc-900 hover:bg-zinc-200 dark:border-[#3D3D3D] dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-700">
                        <div className="flex items-center gap-2">
                          <span className="text-xs">⚡</span>
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="z-30 rounded-xl border-zinc-200 bg-white shadow-lg dark:border-[#3D3D3D] dark:bg-zinc-900">
                        <SelectItem
                          value="gemini-2.5-pro"
                          className="rounded-lg text-zinc-900 hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-700"
                        >
                          Gemini 2.5 Pro
                        </SelectItem>
                        <SelectItem
                          value="gpt-4"
                          className="rounded-lg text-zinc-900 hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-700"
                        >
                          GPT-4
                        </SelectItem>
                        <SelectItem
                          value="claude-3"
                          className="rounded-lg text-zinc-900 hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-700"
                        >
                          Claude 3
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Right side icons */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 rounded-full bg-zinc-100 p-0 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                >
                  <Folder className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSubmit}
                  className="h-10 w-10 rounded-full bg-orange-200 p-0 text-orange-800 hover:bg-orange-300"
                >
                  <ArrowUp className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
