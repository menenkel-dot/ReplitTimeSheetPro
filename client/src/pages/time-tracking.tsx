import { useState } from "react";
import MainLayout from "@/components/layout/main-layout";
import TimeEntriesTable from "@/components/time-entries/time-entries-table";
import NewEntryModal from "@/components/time-entries/new-entry-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function TimeTracking() {
  const [isNewEntryModalOpen, setIsNewEntryModalOpen] = useState(false);
  
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
            
            <div className="flex items-center gap-4">
              <Button 
                onClick={() => setIsNewEntryModalOpen(true)}
                data-testid="button-new-entry"
              >
                <Plus className="w-4 h-4 mr-2" />
                Neuer Eintrag
              </Button>
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
      
      <NewEntryModal 
        isOpen={isNewEntryModalOpen}
        onClose={() => setIsNewEntryModalOpen(false)}
      />
    </MainLayout>
  );
}
