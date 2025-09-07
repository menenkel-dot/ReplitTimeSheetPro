import type { TimeEntryWithRelations } from "@shared/schema";

export function calculateWorkingHours(entries: TimeEntryWithRelations[]): number {
  return entries.reduce((total, entry) => {
    if (!entry.startTime || !entry.endTime || entry.isRunning) {
      return total;
    }

    const start = new Date(entry.startTime);
    const end = new Date(entry.endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const breakHours = (entry.breakMinutes || 0) / 60;
    
    return total + Math.max(0, diffHours - breakHours);
  }, 0);
}

export function calculateOvertimeBalance(
  workedHours: number, 
  targetHours: number
): number {
  return workedHours - targetHours;
}

export function formatDuration(hours: number): string {
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  const sign = hours < 0 ? '-' : '';
  return `${sign}${h}:${m.toString().padStart(2, '0')}h`;
}

export function parseTimeString(timeString: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeString.split(':').map(Number);
  return { hours, minutes };
}

export function timeStringToMinutes(timeString: string): number {
  const { hours, minutes } = parseTimeString(timeString);
  return hours * 60 + minutes;
}

export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function calculateTargetHoursForPeriod(
  startDate: Date,
  endDate: Date,
  targetHoursPerDay: number = 8,
  holidays: Date[] = []
): number {
  let totalTargetHours = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    const isHoliday = holidays.some(holiday => 
      holiday.toDateString() === current.toDateString()
    );
    
    if (isWeekday && !isHoliday) {
      totalTargetHours += targetHoursPerDay;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return totalTargetHours;
}

export function getBalanceStatus(balance: number): {
  status: 'positive' | 'negative' | 'neutral';
  color: string;
  text: string;
} {
  if (balance > 0) {
    return {
      status: 'positive',
      color: 'text-green-600',
      text: 'Überstunden'
    };
  } else if (balance < 0) {
    return {
      status: 'negative', 
      color: 'text-red-600',
      text: 'Minusstunden'
    };
  } else {
    return {
      status: 'neutral',
      color: 'text-muted-foreground',
      text: 'Ausgeglichen'
    };
  }
}
