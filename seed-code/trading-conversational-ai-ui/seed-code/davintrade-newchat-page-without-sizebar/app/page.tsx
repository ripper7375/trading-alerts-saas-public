import { ChatInterface } from '@/components/chat-interface';
import { AppSidebar } from '@/components/app-sidebar';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';

export default function Home() {
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
