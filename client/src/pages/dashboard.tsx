import MainLayout from "@/components/layout/main-layout";
import BalanceCards from "@/components/dashboard/balance-cards";
import TimerWidget from "@/components/dashboard/timer-widget";
import TimeEntriesTable from "@/components/time-entries/time-entries-table";
import AdminSetup from "@/components/admin-setup";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <MainLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
              <p className="text-muted-foreground" data-testid="text-current-date">
                Heute ist {new Date().toLocaleDateString('de-DE', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <TimerWidget />
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <AdminSetup />

          <div className="mt-6">
            <BalanceCards />
          </div>

          <div className="mt-8">
            <TimeEntriesTable 
            title="Letzte Zeiteinträge" 
            limit={5}
            showAllForAdmin={false}
          />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}