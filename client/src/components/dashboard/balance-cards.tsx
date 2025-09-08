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
  
  // Calculate start of week (Monday) more reliably
  const startOfWeek = new Date(today);
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so we need to go back 6 days
  startOfWeek.setDate(today.getDate() - daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Calculate hours for different periods
  const todayEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    entryDate.setHours(0, 0, 0, 0);
    const todayNormalized = new Date(today);
    todayNormalized.setHours(0, 0, 0, 0);
    return entryDate.getTime() === todayNormalized.getTime();
  });

  const weekEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    entryDate.setHours(0, 0, 0, 0);
    const todayNormalized = new Date(today);
    todayNormalized.setHours(23, 59, 59, 999);
    return entryDate >= startOfWeek && entryDate <= todayNormalized;
  });

  const monthEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    entryDate.setHours(0, 0, 0, 0);
    const todayNormalized = new Date(today);
    todayNormalized.setHours(23, 59, 59, 999);
    return entryDate >= startOfMonth && entryDate <= todayNormalized;
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
  
  // Calculate total balance from all time entries
  const allTimeHours = calculateWorkingHours(timeEntries);
  const totalWorkingDays = timeEntries.length > 0 ? 
    Math.ceil((Date.now() - Math.min(...timeEntries.map(e => new Date(e.date).getTime()))) / (1000 * 60 * 60 * 24)) : 0;
  const expectedTotalHours = Math.max(1, Math.floor(totalWorkingDays / 7) * 5) * targetHoursPerDay; // Rough estimate of working days
  const totalBalance = allTimeHours - expectedTotalHours;

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
          <div className={`text-2xl font-bold mb-1 ${getBalanceColor(totalBalance)}`} data-testid="text-total-balance">
            {totalBalance >= 0 ? "+" : ""}{formatHours(totalBalance)}
          </div>
          <div className={`text-sm mb-2 ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
            {totalBalance >= 0 ? "Guthaben" : "Schulden"}
          </div>
          <div className="flex items-center mt-2 gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${totalBalance >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {totalBalance >= 0 ? "Positiv" : "Negativ"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
