'use client';

import dynamic from 'next/dynamic';

// Import components with ssr disabled to preserve React context
const ChatInterface = dynamic(
  () => import('@davintrade/components/chat-interface')
    .then((mod) => ({ default: mod.ChatInterface })),
  { ssr: false }
);

const AppSidebar = dynamic(
  () => import('@davintrade/components/app-sidebar')
    .then((mod) => ({ default: mod.AppSidebar })),
  { ssr: false }
);

const SidebarProvider = dynamic(
  () => import('@davintrade/components/ui/sidebar')
    .then((mod) => ({ default: mod.SidebarProvider })),
  { ssr: false }
);

const SidebarInset = dynamic(
  () => import('@davintrade/components/ui/sidebar')
    .then((mod) => ({ default: mod.SidebarInset })),
  { ssr: false }
);

const SidebarTrigger = dynamic(
  () => import('@davintrade/components/ui/sidebar')
    .then((mod) => ({ default: mod.SidebarTrigger })),
  { ssr: false }
);

export default function Page() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-4 left-4 z-50">
          <SidebarTrigger className="rounded-md p-2 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-[#1a1a1a] dark:hover:text-white" />
        </div>
        <div className="min-h-screen overflow-hidden">
          <ChatInterface />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
