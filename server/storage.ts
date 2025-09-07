import { 
  users, timeEntries, projects, holidays, workingHours,
  type User, type InsertUser, type TimeEntry, type InsertTimeEntry,
  type Project, type InsertProject, type Holiday, type InsertHoliday,
  type WorkingHours, type InsertWorkingHours, type TimeEntryWithRelations
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, asc, or } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Projects
  getAllProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  
  // Time Entries
  getTimeEntriesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<TimeEntryWithRelations[]>;
  getTimeEntry(id: string): Promise<TimeEntryWithRelations | undefined>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, entry: Partial<InsertTimeEntry>): Promise<TimeEntry>;
  deleteTimeEntry(id: string): Promise<void>;
  getRunningTimeEntry(userId: string): Promise<TimeEntry | undefined>;
  
  // Holidays
  getAllHolidays(): Promise<Holiday[]>;
  createHoliday(holiday: InsertHoliday): Promise<Holiday>;
  
  // Working Hours
  getWorkingHoursByUser(userId: string): Promise<WorkingHours[]>;
  createWorkingHours(workingHours: InsertWorkingHours): Promise<WorkingHours>;
  updateWorkingHours(id: string, workingHours: Partial<InsertWorkingHours>): Promise<WorkingHours>;
  
  sessionStore: session.SessionStore;
}

export class DatabaseStorage implements IStorage {
  public sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updateUser: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updateUser).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true)).orderBy(asc(users.firstName));
  }

  // Projects
  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.isActive, true)).orderBy(asc(projects.name));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async updateProject(id: string, updateProject: Partial<InsertProject>): Promise<Project> {
    const [project] = await db.update(projects).set(updateProject).where(eq(projects.id, id)).returning();
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    await db.update(projects).set({ isActive: false }).where(eq(projects.id, id));
  }

  // Time Entries
  async getTimeEntriesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<TimeEntryWithRelations[]> {
    let query = db.select({
      timeEntry: timeEntries,
      user: users,
      project: projects,
    }).from(timeEntries)
      .leftJoin(users, eq(timeEntries.userId, users.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(eq(timeEntries.userId, userId));

    if (startDate && endDate) {
      query = query.where(
        and(
          eq(timeEntries.userId, userId),
          gte(timeEntries.date, startDate),
          lte(timeEntries.date, endDate)
        )
      );
    }

    const results = await query.orderBy(desc(timeEntries.date), desc(timeEntries.startTime));
    
    return results.map(result => ({
      ...result.timeEntry,
      user: result.user || undefined,
      project: result.project || undefined,
    }));
  }

  async getTimeEntry(id: string): Promise<TimeEntryWithRelations | undefined> {
    const [result] = await db.select({
      timeEntry: timeEntries,
      user: users,
      project: projects,
    }).from(timeEntries)
      .leftJoin(users, eq(timeEntries.userId, users.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(eq(timeEntries.id, id));

    if (!result) return undefined;

    return {
      ...result.timeEntry,
      user: result.user || undefined,
      project: result.project || undefined,
    };
  }

  async createTimeEntry(insertEntry: InsertTimeEntry): Promise<TimeEntry> {
    const [entry] = await db.insert(timeEntries).values(insertEntry).returning();
    return entry;
  }

  async updateTimeEntry(id: string, updateEntry: Partial<InsertTimeEntry>): Promise<TimeEntry> {
    const [entry] = await db.update(timeEntries)
      .set({ ...updateEntry, updatedAt: new Date() })
      .where(eq(timeEntries.id, id))
      .returning();
    return entry;
  }

  async deleteTimeEntry(id: string): Promise<void> {
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
  }

  async getRunningTimeEntry(userId: string): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), eq(timeEntries.isRunning, true)));
    return entry;
  }

  // Holidays
  async getAllHolidays(): Promise<Holiday[]> {
    return await db.select().from(holidays).orderBy(asc(holidays.date));
  }

  async createHoliday(insertHoliday: InsertHoliday): Promise<Holiday> {
    const [holiday] = await db.insert(holidays).values(insertHoliday).returning();
    return holiday;
  }

  // Working Hours
  async getWorkingHoursByUser(userId: string): Promise<WorkingHours[]> {
    return await db.select().from(workingHours)
      .where(eq(workingHours.userId, userId))
      .orderBy(asc(workingHours.dayOfWeek));
  }

  async createWorkingHours(insertWorkingHours: InsertWorkingHours): Promise<WorkingHours> {
    const [wh] = await db.insert(workingHours).values(insertWorkingHours).returning();
    return wh;
  }

  async updateWorkingHours(id: string, updateWorkingHours: Partial<InsertWorkingHours>): Promise<WorkingHours> {
    const [wh] = await db.update(workingHours).set(updateWorkingHours).where(eq(workingHours.id, id)).returning();
    return wh;
  }
}

export const storage = new DatabaseStorage();
