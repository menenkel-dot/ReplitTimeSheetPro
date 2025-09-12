import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, pgEnum, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum('role', ['employee', 'admin']);
export const statusEnum = pgEnum('status', ['draft', 'submitted', 'approved', 'rejected']);

export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").default('#10b981'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: roleEnum("role").notNull().default('employee'),
  groupId: varchar("group_id").references(() => groups.id),
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }),
  targetHoursPerDay: integer("target_hours_per_day").default(8),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default('#3b82f6'),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").references(() => projects.id),
  date: timestamp("date").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  breakMinutes: integer("break_minutes").default(0),
  description: text("description"),
  status: statusEnum("status").notNull().default('draft'),
  isRunning: boolean("is_running").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const holidays = pgTable("holidays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  date: timestamp("date").notNull(),
  isRecurring: boolean("is_recurring").default(false),
});

export const workingHours = pgTable("working_hours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, etc.
  startTime: text("start_time"), // "09:00"
  endTime: text("end_time"), // "17:00"
  targetHours: decimal("target_hours", { precision: 4, scale: 2 }).default('8.00'),
  isWorkday: boolean("is_workday").default(true),
});

// Relations
export const groupsRelations = relations(groups, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  timeEntries: many(timeEntries),
  workingHours: many(workingHours),
  group: one(groups, {
    fields: [users.groupId],
    references: [groups.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  timeEntries: many(timeEntries),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  user: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [timeEntries.projectId],
    references: [projects.id],
  }),
}));

export const workingHoursRelations = relations(workingHours, ({ one }) => ({
  user: one(users, {
    fields: [workingHours.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  hourlyRate: z.string().optional(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({
  id: true,
});

export const insertWorkingHoursSchema = createInsertSchema(workingHours).omit({
  id: true,
});

// Types
export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type WorkingHours = typeof workingHours.$inferSelect;
export type InsertWorkingHours = z.infer<typeof insertWorkingHoursSchema>;

// Extended types for queries with relations
export type GroupWithRelations = Group & {
  users?: User[];
};

export type TimeEntryWithRelations = TimeEntry & {
  user?: User & { group?: Group };
  project?: Project;
};

export type UserWithRelations = User & {
  timeEntries?: TimeEntry[];
  workingHours?: WorkingHours[];
  group?: Group;
};