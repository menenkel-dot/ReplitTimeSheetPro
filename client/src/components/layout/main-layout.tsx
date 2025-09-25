import { ReactNode } from "react";
import Sidebar from "./sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className={`flex-1 flex flex-col overflow-hidden ${isMobile ? "pt-16" : ""}`}>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
