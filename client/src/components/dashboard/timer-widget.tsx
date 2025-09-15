import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Plus } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TimeEntry } from "@shared/schema";
import NewEntryModal from "@/components/time-entries/new-entry-modal";

export default function TimerWidget() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: runningEntry } = useQuery<TimeEntry | null>({
    queryKey: ["/api/time-entries", "running"],
    refetchInterval: (query) =>
      (query.state.data as (TimeEntry | null) | undefined)?.isRunning ? 1000 : false,
  });

  const [displayTime, setDisplayTime] = useState("00:00:00");

  useEffect(() => {
    if (runningEntry && runningEntry.startTime && runningEntry.isRunning) {
      const interval = setInterval(() => {
        const start = new Date(runningEntry.startTime!);
        const now = new Date();
        const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
        
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        setDisplayTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setDisplayTime("00:00:00");
    }
  }, [runningEntry]);

  const startTimerMutation = useMutation({
    mutationFn: async (data: { projectId?: string; description?: string }) => {
      const res = await fetch("/api/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Fehler beim Starten des Timers");
      return res.json();
    },
    onSuccess: (entry) => {
      // Set the returned running entry into cache to enable polling immediately
      queryClient.setQueryData(["/api/time-entries", "running"], entry);
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries", ""] }); // Also invalidate dashboard cache
      toast({
        title: "Timer gestartet",
        description: "Die Zeiterfassung wurde gestartet."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const stopTimerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/timer/stop", {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Fehler beim Stoppen des Timers");
      return res.json();
    },
    onSuccess: () => {
      // Immediately clear the running entry from cache to stop the timer display
      queryClient.setQueryData<TimeEntry | null>(["/api/time-entries", "running"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries", ""] }); // Also invalidate dashboard cache
      toast({
        title: "Timer gestoppt",
        description: "Die Zeiterfassung wurde beendet."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleStartStop = () => {
    if (runningEntry && runningEntry.isRunning) {
      stopTimerMutation.mutate();
    } else if (!runningEntry) {
      startTimerMutation.mutate({});
    }
  };

  const resetTimer = () => {
    if (runningEntry && runningEntry.isRunning) {
      stopTimerMutation.mutate();
    }
    setDisplayTime("00:00:00");
  };

  return (
    <div className="flex items-center gap-4">
      <Card className="bg-accent border border-border min-w-[200px]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Aktuelle Session</span>
            {runningEntry && runningEntry.isRunning && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <div className="text-2xl font-bold font-mono mb-3" data-testid="text-timer-display">
            {displayTime}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleStartStop}
              className="flex-1"
              disabled={startTimerMutation.isPending || stopTimerMutation.isPending}
              data-testid="button-timer-toggle"
            >
              {runningEntry && runningEntry.isRunning ? (
                <>
                  <Pause className="w-3 h-3 mr-1" />
                  Stopp
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  Start
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={resetTimer}
              disabled={startTimerMutation.isPending || stopTimerMutation.isPending}
              data-testid="button-timer-reset"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => setIsModalOpen(true)} data-testid="button-new-entry">
        <Plus className="w-4 h-4 mr-2" />
        Neuer Eintrag
      </Button>

      <NewEntryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
