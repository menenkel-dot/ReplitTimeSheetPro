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
  getAllTimeEntries(startDate?: Date, endDate?: Date): Promise<TimeEntryWithRelations[]>;

  // Holidays
  getAllHolidays(): Promise<Holiday[]>;
  createHoliday(holiday: InsertHoliday): Promise<Holiday>;
  updateHoliday(id: string, holiday: Partial<InsertHoliday>): Promise<Holiday>;
  deleteHoliday(id: string): Promise<void>;

  // Working Hours
  getWorkingHoursByUser(userId: string): Promise<WorkingHours[]>;
  createWorkingHours(workingHours: InsertWorkingHours): Promise<WorkingHours>;
  updateWorkingHours(id: string, workingHours: Partial<InsertWorkingHours>): Promise<WorkingHours>;
}

export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;

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
  async getAllProjects(): Promise<Project[]>{
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
  async getTimeEntriesByUser(
    userId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<TimeEntryWithRelations[]> {
    let whereConditions = [eq(timeEntries.userId, userId)];

    if (startDate && endDate) {
      whereConditions.push(
        gte(timeEntries.date, startDate),
        lte(timeEntries.date, endDate)
      );
    }

    return await db
      .select({
        id: timeEntries.id,
        userId: timeEntries.userId,
        projectId: timeEntries.projectId,
        date: timeEntries.date,
        startTime: timeEntries.startTime,
        endTime: timeEntries.endTime,
        breakMinutes: timeEntries.breakMinutes,
        description: timeEntries.description,
        status: timeEntries.status,
        isRunning: timeEntries.isRunning,
        createdAt: timeEntries.createdAt,
        updatedAt: timeEntries.updatedAt,
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          hourlyRate: users.hourlyRate
        },
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
          color: projects.color
        }
      })
      .from(timeEntries)
      .leftJoin(users, eq(timeEntries.userId, users.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(and(...whereConditions))
      .orderBy(desc(timeEntries.date), desc(timeEntries.startTime));
  }

  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const result = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, id))
      .limit(1);

    return result[0];
  }

  async getAllTimeEntries(startDate?: Date, endDate?: Date): Promise<TimeEntryWithRelations[]> {
    let whereConditions = [];

    if (startDate && endDate) {
      whereConditions.push(
        gte(timeEntries.date, startDate),
        lte(timeEntries.date, endDate)
      );
    }

    return await db
      .select({
        id: timeEntries.id,
        userId: timeEntries.userId,
        projectId: timeEntries.projectId,
        date: timeEntries.date,
        startTime: timeEntries.startTime,
        endTime: timeEntries.endTime,
        breakMinutes: timeEntries.breakMinutes,
        description: timeEntries.description,
        status: timeEntries.status,
        isRunning: timeEntries.isRunning,
        createdAt: timeEntries.createdAt,
        updatedAt: timeEntries.updatedAt,
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          hourlyRate: users.hourlyRate
        },
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
          color: projects.color
        }
      })
      .from(timeEntries)
      .leftJoin(users, eq(timeEntries.userId, users.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(timeEntries.date), desc(timeEntries.startTime));
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

  async updateHoliday(id: string, updateHoliday: Partial<InsertHoliday>): Promise<Holiday> {
    const [holiday] = await db.update(holidays).set(updateHoliday).where(eq(holidays.id, id)).returning();
    return holiday;
  }

  async deleteHoliday(id: string): Promise<void> {
    await db.delete(holidays).where(eq(holidays.id, id));
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