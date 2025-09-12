import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProjectSchema, insertTimeEntrySchema, insertHolidaySchema, insertUserSchema, insertGroupSchema, InsertUser } from "@shared/schema";
import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import * as XLSX from "xlsx";
import puppeteer from "puppeteer";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Projects API
  app.get("/api/projects", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Laden der Projekte" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Ungültige Projektdaten", errors: error.errors });
      }
      res.status(500).json({ message: "Fehler beim Erstellen des Projekts" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const projectData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, projectData);
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Ungültige Projektdaten", errors: error.errors });
      }
      res.status(500).json({ message: "Fehler beim Aktualisieren des Projekts" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      await storage.deleteProject(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Löschen des Projekts" });
    }
  });

  // Time Entries API
  app.get("/api/time-entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { startDate, endDate, showAll } = req.query;
      
      let entries;
      if (req.user.role === 'admin' && req.query.userId) {
        // Admin requesting specific user's entries
        entries = await storage.getTimeEntriesByUser(
          req.query.userId as string,
          startDate ? new Date(startDate as string) : undefined,
          endDate ? new Date(endDate as string) : undefined
        );
      } else if (req.user.role === 'admin' && showAll === 'true') {
        // Admin requesting all entries (only in time tracking view)
        entries = await storage.getAllTimeEntries(
          startDate ? new Date(startDate as string) : undefined,
          endDate ? new Date(endDate as string) : undefined
        );
      } else {
        // Regular employees can only see their own entries
        entries = await storage.getTimeEntriesByUser(
          req.user.id,
          startDate ? new Date(startDate as string) : undefined,
          endDate ? new Date(endDate as string) : undefined
        );
      }
      res.json(entries);
    } catch (error) {
      console.error(`[ERROR] Failed to load time entries for user ${req.user?.id}:`, error);
      res.status(500).json({ message: "Fehler beim Laden der Zeiteinträge" });
    }
  });

  app.get("/api/time-entries/running", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const runningEntry = await storage.getRunningTimeEntry(req.user.id);
      res.json(runningEntry);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Laden des laufenden Timers" });
    }
  });

  app.post("/api/time-entries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const entryData = insertTimeEntrySchema.parse({
        ...req.body,
        userId: req.user.id,
        date: new Date(req.body.date),
        startTime: new Date(req.body.startTime),
        endTime: req.body.endTime ? new Date(req.body.endTime) : null,
      });

      // Check for overlapping entries
      const existingEntries = await storage.getTimeEntriesByUser(
        req.user.id,
        entryData.date,
        entryData.date
      );

      const hasOverlap = existingEntries.some(entry => {
        if (!entry.startTime || !entry.endTime || !entryData.startTime || !entryData.endTime) return false;
        
        const entryStart = new Date(entry.startTime).getTime();
        const entryEnd = new Date(entry.endTime).getTime();
        const newStart = new Date(entryData.startTime).getTime();
        const newEnd = new Date(entryData.endTime).getTime();

        return (newStart < entryEnd && newEnd > entryStart);
      });

      if (hasOverlap) {
        return res.status(400).json({ message: "Überlappende Zeiten erkannt" });
      }

      const entry = await storage.createTimeEntry(entryData);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Ungültige Zeiteintrags-Daten", errors: error.errors });
      }
      res.status(500).json({ message: "Fehler beim Erstellen des Zeiteintrags" });
    }
  });

  app.put("/api/time-entries/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const entry = await storage.getTimeEntry(req.params.id);
      if (!entry) return res.status(404).json({ message: "Zeiteintrag nicht gefunden" });
      
      if (entry.userId !== req.user.id && req.user.role !== 'admin') {
        return res.sendStatus(403);
      }

      const entryData = insertTimeEntrySchema.partial().parse({
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : undefined,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      });

      const updatedEntry = await storage.updateTimeEntry(req.params.id, entryData);
      res.json(updatedEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Ungültige Zeiteintrags-Daten", errors: error.errors });
      }
      res.status(500).json({ message: "Fehler beim Aktualisieren des Zeiteintrags" });
    }
  });

  app.delete("/api/time-entries/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const entry = await storage.getTimeEntry(req.params.id);
      if (!entry) return res.status(404).json({ message: "Zeiteintrag nicht gefunden" });
      
      if (entry.userId !== req.user.id && req.user.role !== 'admin') {
        return res.sendStatus(403);
      }

      await storage.deleteTimeEntry(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Löschen des Zeiteintrags" });
    }
  });

  // Timer API
  app.post("/api/timer/start", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Stop any running timer first
      const runningEntry = await storage.getRunningTimeEntry(req.user.id);
      if (runningEntry) {
        await storage.updateTimeEntry(runningEntry.id, {
          endTime: new Date(),
          isRunning: false
        });
      }

      // Start new timer
      const newEntry = await storage.createTimeEntry({
        userId: req.user.id,
        projectId: req.body.projectId || null,
        date: new Date(),
        startTime: new Date(),
        endTime: null,
        description: req.body.description || '',
        isRunning: true,
        status: 'draft'
      });

      res.status(201).json(newEntry);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Starten des Timers" });
    }
  });

  app.post("/api/timer/stop", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const runningEntry = await storage.getRunningTimeEntry(req.user.id);
      if (!runningEntry) {
        return res.status(400).json({ message: "Kein laufender Timer gefunden" });
      }

      const stoppedEntry = await storage.updateTimeEntry(runningEntry.id, {
        endTime: new Date(),
        isRunning: false
      });

      res.json(stoppedEntry);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Stoppen des Timers" });
    }
  });

  // Check if admin exists (no auth required)
  app.get("/api/admin-exists", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const adminExists = users.some(user => user.role === 'admin');
      res.json({ adminExists });
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Prüfen der Admin-Existenz" });
    }
  });

  // Users API (Admin only)
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Laden der Benutzer" });
    }
  });

  app.post("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const userData = insertUserSchema.parse({
        ...req.body,
        password: await hashPassword(req.body.password),
        isActive: true
      });
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Ungültige Benutzerdaten", errors: error.errors });
      }
      res.status(500).json({ message: "Fehler beim Erstellen des Benutzers" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const userData = { ...req.body };
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }
      const user = await storage.updateUser(req.params.id, userData);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Aktualisieren des Benutzers" });
    }
  });

  // Promote user to admin (only for initial setup when no admin exists)
  app.post("/api/users/:id/promote", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Check if any admin already exists
      const users = await storage.getAllUsers();
      const hasAdmin = users.some(user => user.role === 'admin');
      
      if (hasAdmin) {
        return res.status(403).json({ message: "Ein Administrator existiert bereits im System" });
      }
      
      // Only allow users to promote themselves for initial setup
      if (req.params.id !== req.user.id) {
        return res.status(403).json({ message: "Sie können nur sich selbst befördern" });
      }
      
      const user = await storage.updateUser(req.params.id, { role: 'admin' } as Partial<InsertUser>);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Befördern des Benutzers" });
    }
  });

  // Project Statistics API (Admin only)
  app.get("/api/projects/statistics", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const { startDate, endDate } = req.query;
      
      let entries;
      if (startDate && endDate) {
        entries = await storage.getAllTimeEntries(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        entries = await storage.getAllTimeEntries();
      }
      
      // Group by project and calculate statistics
      const projectStats = entries.reduce((acc, entry) => {
        const projectId = entry.projectId || 'no-project';
        const projectName = entry.project?.name || 'Ohne Projekt';
        
        if (!acc[projectId]) {
          acc[projectId] = {
            id: projectId,
            name: projectName,
            totalHours: 0,
            totalCosts: 0,
            color: entry.project?.color || '#6b7280'
          };
        }
        
        if (entry.startTime && entry.endTime) {
          const start = new Date(entry.startTime);
          const end = new Date(entry.endTime);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          const breakHours = (entry.breakMinutes || 0) / 60;
          const actualHours = Math.max(0, hours - breakHours);
          
          acc[projectId].totalHours += actualHours;
          
          // Calculate costs if user has hourly rate
          if (entry.user?.hourlyRate) {
            const rate = parseFloat(entry.user.hourlyRate || '0');
            acc[projectId].totalCosts += actualHours * rate;
          }
        }
        
        return acc;
      }, {} as Record<string, { id: string; name: string; totalHours: number; totalCosts: number; color: string }>);
      
      res.json(Object.values(projectStats));
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Laden der Projekt-Statistiken" });
    }
  });

  // Holidays API
  app.get("/api/holidays", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const holidays = await storage.getAllHolidays();
      res.json(holidays);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Laden der Feiertage" });
    }
  });

  app.post("/api/holidays", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const holidayData = insertHolidaySchema.parse({
        ...req.body,
        date: new Date(req.body.date)
      });
      const holiday = await storage.createHoliday(holidayData);
      res.status(201).json(holiday);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Ungültige Feiertagsdaten", errors: error.errors });
      }
      res.status(500).json({ message: "Fehler beim Erstellen des Feiertags" });
    }
  });

  app.put("/api/holidays/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const holidayData = {
        ...req.body,
        date: new Date(req.body.date)
      };
      const holiday = await storage.updateHoliday(req.params.id, holidayData);
      res.json(holiday);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Aktualisieren des Feiertags" });
    }
  });

  app.delete("/api/holidays/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      await storage.deleteHoliday(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Löschen des Feiertags" });
    }
  });

  // Reports API
  app.get("/api/reports/export", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { startDate, endDate, groupBy, format, includeCosts } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start- und Enddatum sind erforderlich" });
      }

      let entries;
      if (req.user.role === 'admin' && req.query.userId) {
        // Admin requesting specific user's entries
        entries = await storage.getTimeEntriesByUser(
          req.query.userId as string,
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else if (req.user.role === 'admin' && !req.query.userId) {
        // Admin requesting all entries
        entries = await storage.getAllTimeEntries(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        // Regular user requesting their own entries
        entries = await storage.getTimeEntriesByUser(
          req.user.id,
          new Date(startDate as string),
          new Date(endDate as string)
        );
      }

      // Group and process data based on groupBy parameter
      let processedData;
      const showCosts = req.user.role === 'admin' && includeCosts === 'true';
      
      switch (groupBy) {
        case 'project':
          processedData = groupByProject(entries, showCosts);
          break;
        case 'week':
          processedData = groupByWeek(entries, showCosts);
          break;
        case 'month':
          processedData = groupByMonth(entries, showCosts);
          break;
        case 'user':
          processedData = req.user.role === 'admin' ? groupByUser(entries, showCosts) : groupByDay(entries, showCosts);
          break;
        default:
          processedData = groupByDay(entries, showCosts);
      }

      // Generate export based on format
      const isAdmin = req.user.role === 'admin';
      
      switch (format) {
        case 'csv':
          const csv = generateCSV(processedData, showCosts, isAdmin);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
          res.send(csv);
          break;
        case 'xlsx':
          const xlsxBuffer = generateXLSX(processedData, showCosts, isAdmin);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename=report.xlsx');
          res.send(xlsxBuffer);
          break;
        case 'pdf':
          // For now, return CSV for pdf requests too
          const pdfCsv = generateCSV(processedData, showCosts, isAdmin);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
          res.send(pdfCsv);
          break;
        default:
          const defaultCsv = generateCSV(processedData, showCosts, isAdmin);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
          res.send(defaultCsv);
      }
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Generieren des Reports" });
    }
  });

  // Helper functions for grouping data
  function calculateHoursAndCosts(entries: any[], includeCosts: boolean = false) {
    return entries.reduce((sum, entry) => {
      if (entry.startTime && entry.endTime) {
        const start = new Date(entry.startTime);
        const end = new Date(entry.endTime);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const breakHours = (entry.breakMinutes || 0) / 60;
        const actualHours = Math.max(0, hours - breakHours);
        
        sum.totalHours += actualHours;
        
        if (includeCosts && entry.user?.hourlyRate) {
          const rate = parseFloat(entry.user.hourlyRate || '0');
          sum.totalCosts += actualHours * rate;
        }
      }
      return sum;
    }, { totalHours: 0, totalCosts: 0 });
  }

  function groupByDay(entries: any[], includeCosts: boolean = false) {
    const grouped = entries.reduce((acc, entry) => {
      const date = new Date(entry.date).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(entry);
      return acc;
    }, {});

    return Object.entries(grouped).map(([date, entries]) => {
      const stats = calculateHoursAndCosts(entries as any[], includeCosts);
      return {
        date,
        entries,
        ...stats
      };
    });
  }

  function groupByProject(entries: any[], includeCosts: boolean = false) {
    const grouped = entries.reduce((acc, entry) => {
      const projectName = entry.project?.name || 'Ohne Projekt';
      if (!acc[projectName]) acc[projectName] = [];
      acc[projectName].push(entry);
      return acc;
    }, {});

    return Object.entries(grouped).map(([project, entries]) => {
      const stats = calculateHoursAndCosts(entries as any[], includeCosts);
      return {
        project,
        entries,
        ...stats
      };
    });
  }

  function groupByUser(entries: any[], includeCosts: boolean = false) {
    const grouped = entries.reduce((acc, entry) => {
      const userName = `${entry.user?.firstName || ''} ${entry.user?.lastName || ''}`.trim() || 'Unbekannt';
      if (!acc[userName]) acc[userName] = [];
      acc[userName].push(entry);
      return acc;
    }, {});

    return Object.entries(grouped).map(([user, entries]) => {
      const stats = calculateHoursAndCosts(entries as any[], includeCosts);
      return {
        user,
        entries,
        ...stats
      };
    });
  }

  function groupByWeek(entries: any[], includeCosts: boolean = false) {
    const grouped = entries.reduce((acc, entry) => {
      const date = new Date(entry.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!acc[weekKey]) acc[weekKey] = [];
      acc[weekKey].push(entry);
      return acc;
    }, {});

    return Object.entries(grouped).map(([week, entries]) => {
      const stats = calculateHoursAndCosts(entries as any[], includeCosts);
      return {
        week,
        entries,
        ...stats
      };
    });
  }

  function groupByMonth(entries: any[], includeCosts: boolean = false) {
    const grouped = entries.reduce((acc, entry) => {
      const date = new Date(entry.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[monthKey]) acc[monthKey] = [];
      acc[monthKey].push(entry);
      return acc;
    }, {});

    return Object.entries(grouped).map(([month, entries]) => {
      const stats = calculateHoursAndCosts(entries as any[], includeCosts);
      return {
        month,
        entries,
        ...stats
      };
    });
  }

  function generateCSV(data: any[], includeCosts: boolean = false, isAdmin: boolean = false) {
    if (data.length === 0) return 'Keine Daten verfügbar';

    // Check if we have detailed entries (not grouped data)
    const hasDetailedEntries = data.some(item => item.entries && item.entries.length > 0);
    
    if (isAdmin && hasDetailedEntries) {
      // Generate detailed CSV with individual entries
      const headers = ['Datum', 'Startzeit', 'Endzeit', 'Dauer (Std)', 'Pause (Min)', 'Beschreibung', 'Mitarbeiter', 'Projekt', 'Status'];
      if (includeCosts) {
        headers.push('Stundensatz (€)', 'Kosten (€)');
      }

      const rows: string[][] = [];
      
      data.forEach(group => {
        group.entries.forEach((entry: any) => {
          const duration = entry.startTime && entry.endTime 
            ? calculateDuration(entry.startTime, entry.endTime, entry.breakMinutes || 0)
            : 0;
          
          const userName = entry.user 
            ? `${entry.user.firstName} ${entry.user.lastName}`.trim()
            : 'Unbekannt';
          
          const projectName = entry.project?.name || 'Ohne Projekt';
          
          const row = [
            new Date(entry.date).toLocaleDateString('de-DE'),
            entry.startTime ? new Date(entry.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
            entry.endTime ? new Date(entry.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
            duration.toFixed(2),
            (entry.breakMinutes || 0).toString(),
            entry.description || '',
            userName,
            projectName,
            entry.status || 'draft'
          ];
          
          if (includeCosts) {
            const hourlyRate = parseFloat(entry.user?.hourlyRate || '0');
            const costs = duration * hourlyRate;
            row.push(hourlyRate.toFixed(2), costs.toFixed(2));
          }
          
          rows.push(row);
        });
      });

      return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    } else {
      // Generate summary CSV (existing functionality)
      const headers = ['Zeitraum', 'Gesamtstunden', 'Anzahl Einträge'];
      if (includeCosts) {
        headers.push('Personalkosten (€)');
      }

      const rows = data.map(item => {
        const row = [
          item.date || item.project || item.week || item.month || item.user,
          item.totalHours.toFixed(2),
          item.entries.length
        ];
        
        if (includeCosts) {
          row.push(item.totalCosts?.toFixed(2) || '0.00');
        }
        
        return row;
      });

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
  }

  async function generatePDF(data: any[], includeCosts: boolean = false, isAdmin: boolean = false): Promise<Buffer> {
    if (data.length === 0) {
      return await createPDFFromHTML('<html><body><h1>Keine Daten verfügbar</h1></body></html>');
    }

    // Check if we have detailed entries (not grouped data)
    const hasDetailedEntries = data.some(item => item.entries && item.entries.length > 0);
    
    let html: string;
    
    if (isAdmin && hasDetailedEntries) {
      // Generate detailed PDF with individual entries
      html = generateDetailedReportHTML(data, includeCosts);
    } else {
      // Generate summary PDF
      html = generateSummaryReportHTML(data, includeCosts);
    }

    return await createPDFFromHTML(html);
  }

  function generateDetailedReportHTML(data: any[], includeCosts: boolean = false): string {
    const headers = ['Datum', 'Startzeit', 'Endzeit', 'Dauer (Std)', 'Pause (Min)', 'Beschreibung', 'Mitarbeiter', 'Projekt', 'Status'];
    if (includeCosts) {
      headers.push('Stundensatz (€)', 'Kosten (€)');
    }

    let tableRows = '';
    data.forEach(group => {
      group.entries.forEach((entry: any) => {
        const duration = entry.startTime && entry.endTime 
          ? calculateDuration(entry.startTime, entry.endTime, entry.breakMinutes || 0)
          : 0;
        
        const userName = entry.user 
          ? `${entry.user.firstName} ${entry.user.lastName}`.trim()
          : 'Unbekannt';
        
        const projectName = entry.project?.name || 'Ohne Projekt';
        
        const cells = [
          new Date(entry.date).toLocaleDateString('de-DE'),
          entry.startTime ? new Date(entry.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
          entry.endTime ? new Date(entry.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
          duration.toFixed(2),
          (entry.breakMinutes || 0).toString(),
          entry.description || '',
          userName,
          projectName,
          entry.status || 'draft'
        ];
        
        if (includeCosts) {
          const hourlyRate = parseFloat(entry.user?.hourlyRate || '0');
          const costs = duration * hourlyRate;
          cells.push(hourlyRate.toFixed(2), costs.toFixed(2));
        }
        
        tableRows += `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
      });
    });

    return createReportHTML('Detaillierter Zeiterfassungs-Report', headers, tableRows);
  }

  function generateSummaryReportHTML(data: any[], includeCosts: boolean = false): string {
    const headers = ['Zeitraum', 'Gesamtstunden', 'Anzahl Einträge'];
    if (includeCosts) {
      headers.push('Personalkosten (€)');
    }

    let tableRows = '';
    data.forEach(item => {
      const cells = [
        item.date || item.project || item.week || item.month || item.user,
        item.totalHours.toFixed(2),
        item.entries.length.toString()
      ];
      
      if (includeCosts) {
        cells.push(item.totalCosts?.toFixed(2) || '0.00');
      }
      
      tableRows += `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
    });

    return createReportHTML('Zeiterfassungs-Report Übersicht', headers, tableRows);
  }

  function createReportHTML(title: string, headers: string[], tableRows: string): string {
    const headerCells = headers.map(header => `<th>${header}</th>`).join('');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px;
            color: #333;
          }
          h1 { 
            color: #2563eb;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
          }
          table { 
            border-collapse: collapse; 
            width: 100%; 
            margin-top: 20px;
          }
          th, td { 
            border: 1px solid #d1d5db; 
            padding: 8px; 
            text-align: left;
          }
          th { 
            background-color: #f3f4f6;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Erstellt am: ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')}</p>
        <table>
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="footer">
          <p>Zeiterfassungs-System - Automatisch generierter Report</p>
        </div>
      </body>
      </html>
    `;
  }

  async function createPDFFromHTML(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });
      
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  function calculateDuration(startTime: Date | string, endTime: Date | string, breakMinutes: number = 0) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const breakHours = breakMinutes / 60;
    
    return Math.max(0, diffHours - breakHours);
  }

  function generateXLSX(data: any[], includeCosts: boolean = false, isAdmin: boolean = false): Buffer {
    if (data.length === 0) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['Keine Daten verfügbar']]);
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    // Check if we have detailed entries (not grouped data)
    const hasDetailedEntries = data.some(item => item.entries && item.entries.length > 0);
    
    const wb = XLSX.utils.book_new();
    
    if (isAdmin && hasDetailedEntries) {
      // Generate detailed XLSX with individual entries
      const headers = ['Datum', 'Startzeit', 'Endzeit', 'Dauer (Std)', 'Pause (Min)', 'Beschreibung', 'Mitarbeiter', 'Projekt', 'Status'];
      if (includeCosts) {
        headers.push('Stundensatz (€)', 'Kosten (€)');
      }

      const rows: any[][] = [headers];
      
      data.forEach(group => {
        group.entries.forEach((entry: any) => {
          const duration = entry.startTime && entry.endTime 
            ? calculateDuration(entry.startTime, entry.endTime, entry.breakMinutes || 0)
            : 0;
          
          const userName = entry.user 
            ? `${entry.user.firstName} ${entry.user.lastName}`.trim()
            : 'Unbekannt';
          
          const projectName = entry.project?.name || 'Ohne Projekt';
          
          const row = [
            new Date(entry.date).toLocaleDateString('de-DE'),
            entry.startTime ? new Date(entry.startTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
            entry.endTime ? new Date(entry.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
            parseFloat(duration.toFixed(2)),
            entry.breakMinutes || 0,
            entry.description || '',
            userName,
            projectName,
            entry.status || 'draft'
          ];
          
          if (includeCosts) {
            const hourlyRate = parseFloat(entry.user?.hourlyRate || '0');
            const costs = duration * hourlyRate;
            row.push(hourlyRate, costs);
          }
          
          rows.push(row);
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      
      // Auto-size columns
      const colWidths = headers.map((header, i) => {
        const maxLength = Math.max(
          header.length,
          ...rows.slice(1).map(row => String(row[i] || '').length)
        );
        return { wch: Math.min(maxLength + 2, 30) };
      });
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Zeiteinträge');
    } else {
      // Generate summary XLSX (existing functionality)
      const headers = ['Zeitraum', 'Gesamtstunden', 'Anzahl Einträge'];
      if (includeCosts) {
        headers.push('Personalkosten (€)');
      }

      const rows = [headers];
      
      data.forEach(item => {
        const row = [
          item.date || item.project || item.week || item.month || item.user,
          parseFloat(item.totalHours.toFixed(2)),
          item.entries.length
        ];
        
        if (includeCosts) {
          row.push(parseFloat(item.totalCosts?.toFixed(2) || '0'));
        }
        
        rows.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      
      // Auto-size columns
      const colWidths = headers.map((header, i) => {
        const maxLength = Math.max(
          header.length,
          ...rows.slice(1).map(row => String(row[i] || '').length)
        );
        return { wch: Math.min(maxLength + 2, 20) };
      });
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Zusammenfassung');
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // Reports data API for frontend display
  app.get("/api/reports/data", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { startDate, endDate, groupBy, userId } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start- und Enddatum sind erforderlich" });
      }

      let entries;
      if (req.user.role === 'admin' && userId) {
        // Admin requesting specific user's entries
        entries = await storage.getTimeEntriesByUser(
          userId as string,
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else if (req.user.role === 'admin' && !userId) {
        // Admin requesting all entries
        entries = await storage.getAllTimeEntries(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        // Regular user requesting their own entries
        entries = await storage.getTimeEntriesByUser(
          req.user.id,
          new Date(startDate as string),
          new Date(endDate as string)
        );
      }

      // Group and process data based on groupBy parameter
      let processedData;
      const showCosts = req.user.role === 'admin';
      
      switch (groupBy) {
        case 'project':
          processedData = groupByProject(entries, showCosts);
          break;
        case 'week':
          processedData = groupByWeek(entries, showCosts);
          break;
        case 'month':
          processedData = groupByMonth(entries, showCosts);
          break;
        case 'user':
          processedData = req.user.role === 'admin' ? groupByUser(entries, showCosts) : groupByDay(entries, showCosts);
          break;
        default:
          processedData = groupByDay(entries, showCosts);
      }

      res.json({
        data: processedData,
        isAdmin: req.user.role === 'admin',
        totalEntries: entries.length
      });
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Laden der Berichte-Daten" });
    }
  });

  // Seed data endpoint
  app.post("/api/seed", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Create some sample projects if they don't exist
      const existingProjects = await storage.getAllProjects();
      if (existingProjects.length === 0) {
        await storage.createProject({
          name: "Internes Projekt",
          description: "Interne Arbeiten und Meetings",
          color: "#3b82f6"
        });
        
        await storage.createProject({
          name: "Kundenprojekt A",
          description: "Entwicklungsarbeiten für Kunde A",
          color: "#10b981"
        });
        
        await storage.createProject({
          name: "Administration",
          description: "Administrative Tätigkeiten",
          color: "#f59e0b"
        });
      }
      
      res.json({ message: "Seed-Daten erfolgreich erstellt" });
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Erstellen der Seed-Daten" });
    }
  });

  // Groups API
  app.get("/api/groups", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const groups = await storage.getAllGroups();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Laden der Gruppen" });
    }
  });

  app.post("/api/groups", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const groupData = insertGroupSchema.parse(req.body);
      const group = await storage.createGroup(groupData);
      res.status(201).json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Ungültige Gruppendaten", errors: error.errors });
      }
      // Handle unique constraint violation for group name
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return res.status(409).json({ message: "Eine Gruppe mit diesem Namen existiert bereits" });
      }
      res.status(500).json({ message: "Fehler beim Erstellen der Gruppe" });
    }
  });

  app.put("/api/groups/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      const groupData = insertGroupSchema.partial().parse(req.body);
      const group = await storage.updateGroup(req.params.id, groupData);
      if (!group) return res.sendStatus(404);
      res.json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Ungültige Gruppendaten", errors: error.errors });
      }
      // Handle unique constraint violation for group name
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return res.status(409).json({ message: "Eine Gruppe mit diesem Namen existiert bereits" });
      }
      res.status(500).json({ message: "Fehler beim Aktualisieren der Gruppe" });
    }
  });

  app.delete("/api/groups/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);

    try {
      await storage.deleteGroup(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Löschen der Gruppe" });
    }
  });

  app.get("/api/groups/:id/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user.role !== 'admin') return res.sendStatus(403);
    
    try {
      const group = await storage.getGroupWithUsers(req.params.id);
      if (!group) return res.sendStatus(404);
      res.json(group);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Laden der Gruppe mit Benutzern" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
