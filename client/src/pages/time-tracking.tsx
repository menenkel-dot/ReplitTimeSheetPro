import MainLayout from "@/components/layout/main-layout";
import TimeEntriesTable from "@/components/time-entries/time-entries-table";

export default function TimeTracking() {
  return (
    <MainLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-timetracking-title">Zeiterfassung</h1>
              <p className="text-muted-foreground">
                Verwalten Sie Ihre Arbeitszeiten
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <TimeEntriesTable 
            title="Zeiteinträge"
            showFilters={true}
            showPagination={true}
          />
        </div>
      </div>
    </MainLayout>
  );
}
