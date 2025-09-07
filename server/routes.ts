import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProjectSchema, insertTimeEntrySchema, insertHolidaySchema } from "@shared/schema";
import { z } from "zod";

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
      const { startDate, endDate } = req.query;
      const userId = req.user.role === 'admin' && req.query.userId 
        ? req.query.userId as string 
        : req.user.id;

      const entries = await storage.getTimeEntriesByUser(
        userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
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

  // Promote user to admin (temporary endpoint for setup)
  app.post("/api/users/:id/promote", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Allow any authenticated user to promote themselves for initial setup
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
