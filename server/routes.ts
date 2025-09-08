import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProjectSchema, insertTimeEntrySchema, insertHolidaySchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

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
        // Regular user or admin on dashboard requesting their own entries
        entries = await storage.getTimeEntriesByUser(
          req.user.id,
          startDate ? new Date(startDate as string) : undefined,
          endDate ? new Date(endDate as string) : undefined
        );
      }
      
      res.json(entries);
    } catch (error) {
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
      
      const user = await storage.updateUser(req.params.id, { role: 'admin' });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Fehler beim Befördern des Benutzers" });
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
      switch (format) {
        case 'csv':
          const csv = generateCSV(processedData, showCosts);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
          res.send(csv);
          break;
        case 'xlsx':
          // For now, return CSV for xlsx requests too
          const xlsxCsv = generateCSV(processedData, showCosts);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
          res.send(xlsxCsv);
          break;
        case 'pdf':
          // For now, return CSV for pdf requests too
          const pdfCsv = generateCSV(processedData, showCosts);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
          res.send(pdfCsv);
          break;
        default:
          const defaultCsv = generateCSV(processedData, showCosts);
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

    return Object.entries(grouped).map(([date, entries]: [string, any[]]) => {
      const stats = calculateHoursAndCosts(entries, includeCosts);
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

    return Object.entries(grouped).map(([project, entries]: [string, any[]]) => {
      const stats = calculateHoursAndCosts(entries, includeCosts);
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

    return Object.entries(grouped).map(([user, entries]: [string, any[]]) => {
      const stats = calculateHoursAndCosts(entries, includeCosts);
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

    return Object.entries(grouped).map(([week, entries]: [string, any[]]) => {
      const stats = calculateHoursAndCosts(entries, includeCosts);
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

    return Object.entries(grouped).map(([month, entries]: [string, any[]]) => {
      const stats = calculateHoursAndCosts(entries, includeCosts);
      return {
        month,
        entries,
        ...stats
      };
    });
  }

  function generateCSV(data: any[], includeCosts: boolean = false) {
    if (data.length === 0) return 'Keine Daten verfügbar';

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

  const httpServer = createServer(app);
  return httpServer;
}
