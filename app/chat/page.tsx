import { ChatUI } from "@/components/ChatUI";
import { Sidebar } from "@/components/Sidebar";

export const metadata = {
  title: "AI Chat | Medical Research Intelligence Platform",
  description: "Ask natural-language questions over SQL and uploaded project documents.",
};

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-transparent text-slate-100 md:flex">
      <Sidebar />
      <main className="flex-1">
        <ChatUI projectId="default" projectName="Medical Research Workspace" />
      </main>
    </div>
  );
}
