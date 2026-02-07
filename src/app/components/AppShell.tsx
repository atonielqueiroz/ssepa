import { Topbar } from "@/app/components/Topbar";
import { FeedbackWidget } from "@/app/components/FeedbackWidget";
import { TasksSidebar } from "@/app/components/TasksSidebar";

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string;
}) {
  return (
    <div className="ssepa-app">
      <Topbar userName={userName} />
      <div className="ssepa-workarea">
        <div className="ssepa-shell">
          <TasksSidebar />
          <div className="ssepa-container">{children}</div>
        </div>
      </div>
      <FeedbackWidget />
    </div>
  );
}
