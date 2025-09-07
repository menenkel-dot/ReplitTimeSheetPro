import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CalendarDays, CalendarRange, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { calculateWorkingHours } from "@/lib/time-calculations";
import type { TimeEntryWithRelations } from "@shared/schema";

export default function BalanceCards() {
  const { user } = useAuth();
  
  const { data: timeEntries = [] } = useQuery<TimeEntryWithRelations[]>({
    queryKey: ["/api/time-entries"],
  });

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Calculate hours for different periods
  const todayEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate.toDateString() === today.toDateString();
  });

  const weekEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate >= startOfWeek && entryDate <= today;
  });

  const monthEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate >= startOfMonth && entryDate <= today;
  });

  const todayHours = calculateWorkingHours(todayEntries);
  const weekHours = calculateWorkingHours(weekEntries);
  const monthHours = calculateWorkingHours(monthEntries);

  const targetHoursPerDay = user?.targetHoursPerDay || 8;
  const targetWeekHours = targetHoursPerDay * 5; // Mon-Fri
  const targetMonthHours = targetHoursPerDay * 22; // ~22 working days per month

  const todayBalance = todayHours - targetHoursPerDay;
  const weekBalance = weekHours - targetWeekHours;
  const monthBalance = monthHours - targetMonthHours;
  
  // Mock total balance - in production this would be calculated from historical data
  const totalBalance = 12.75;

  const formatHours = (hours: number) => {
    const h = Math.floor(Math.abs(hours));
    const m = Math.round((Math.abs(hours) - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}h`;
  };

  const getBalanceColor = (balance: number) => {
    return balance >= 0 ? "text-green-600" : "text-red-600";
  };

  const getProgressWidth = (worked: number, target: number) => {
    const percentage = Math.min((worked / target) * 100, 120);
    return `${percentage}%`;
  };

  const getProgressColor = (worked: number, target: number) => {
    return worked >= target ? "bg-green-500" : "bg-red-500";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            Heute
            <Calendar className="w-4 h-4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold mb-1" data-testid="text-today-hours">
            {formatHours(todayHours)}
          </div>
          <div className={`text-sm mb-2 ${getBalanceColor(todayBalance)}`} data-testid="text-today-balance">
            {todayBalance >= 0 ? "+" : ""}{formatHours(todayBalance)} {todayBalance >= 0 ? "Überstunden" : "Minusstunden"}
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(todayHours, targetHoursPerDay)}`}
              style={{ width: getProgressWidth(todayHours, targetHoursPerDay) }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            Diese Woche
            <CalendarDays className="w-4 h-4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold mb-1" data-testid="text-week-hours">
            {formatHours(weekHours)}
          </div>
          <div className={`text-sm mb-2 ${getBalanceColor(weekBalance)}`} data-testid="text-week-balance">
            {weekBalance >= 0 ? "+" : ""}{formatHours(weekBalance)} {weekBalance >= 0 ? "Überstunden" : "Minusstunden"}
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(weekHours, targetWeekHours)}`}
              style={{ width: getProgressWidth(weekHours, targetWeekHours) }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            Dieser Monat
            <CalendarRange className="w-4 h-4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold mb-1" data-testid="text-month-hours">
            {formatHours(monthHours)}
          </div>
          <div className={`text-sm mb-2 ${getBalanceColor(monthBalance)}`} data-testid="text-month-balance">
            {monthBalance >= 0 ? "+" : ""}{formatHours(monthBalance)} {monthBalance >= 0 ? "Überstunden" : "Minusstunden"}
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getProgressColor(monthHours, targetMonthHours)}`}
              style={{ width: getProgressWidth(monthHours, targetMonthHours) }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            Gesamt Saldo
            <TrendingUp className="w-4 h-4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold mb-1" data-testid="text-total-balance">
            +{formatHours(totalBalance)}
          </div>
          <div className="text-sm text-green-600 mb-2">
            Guthaben
          </div>
          <div className="flex items-center mt-2 gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Positiv
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
