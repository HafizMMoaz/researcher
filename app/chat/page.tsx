import { ChatUI } from "@/components/ChatUI";
import { Sidebar } from "@/components/Sidebar";

export const metadata = {
  title: "AI Chat | Medical Research Intelligence Platform",
  description: "Ask natural-language questions over SQL and uploaded project documents.",
};

export default function ChatPage() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
        <ChatUI projectId="default" projectName="Medical Research Workspace" />
      </main>
    </div>
  );
}
