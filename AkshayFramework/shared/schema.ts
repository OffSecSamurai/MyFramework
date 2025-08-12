import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const targets = pgTable("targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  inputType: text("input_type").notNull(), // 'domain' | 'list'
  domain: text("domain"),
  urls: jsonb("urls").$type<string[]>(),
  status: text("status").notNull().default("created"), // 'created' | 'running' | 'completed' | 'failed'
  subdomainCount: integer("subdomain_count").default(0),
  hostCount: integer("host_count").default(0),
  vulnerabilityCount: integer("vulnerability_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const tools = pgTable("tools", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  stage: integer("stage").notNull(), // 1-4
  icon: text("icon").notNull(),
  description: text("description").notNull(),
  command: text("command").notNull(),
  dependencies: jsonb("dependencies").$type<string[]>().default([]),
  inputFiles: jsonb("input_files").$type<string[]>().default([]),
  outputFiles: jsonb("output_files").$type<string[]>().default([]),
  enabled: boolean("enabled").default(true).notNull(),
});

export const executions = pgTable("executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetId: varchar("target_id").references(() => targets.id).notNull(),
  toolId: varchar("tool_id").references(() => tools.id).notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'running' | 'completed' | 'failed'
  progress: integer("progress").default(0),
  command: text("command").notNull(),
  output: text("output"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetId: varchar("target_id").references(() => targets.id).notNull(),
  executionId: varchar("execution_id").references(() => executions.id),
  filename: text("filename").notNull(),
  filepath: text("filepath").notNull(),
  filesize: integer("filesize").default(0),
  contentType: text("content_type").default("text/plain"),
  content: text("content"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const vulnerabilities = pgTable("vulnerabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetId: varchar("target_id").references(() => targets.id).notNull(),
  executionId: varchar("execution_id").references(() => executions.id),
  toolId: varchar("tool_id").references(() => tools.id).notNull(),
  severity: text("severity").notNull(), // 'low' | 'medium' | 'high' | 'critical'
  title: text("title").notNull(),
  description: text("description"),
  host: text("host"),
  url: text("url"),
  evidence: text("evidence"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTargetSchema = createInsertSchema(targets).pick({
  name: true,
  inputType: true,
  domain: true,
  urls: true,
});

export const insertToolSchema = createInsertSchema(tools);
export const insertExecutionSchema = createInsertSchema(executions);
export const insertFileSchema = createInsertSchema(files);
export const insertVulnerabilitySchema = createInsertSchema(vulnerabilities);

export type Target = typeof targets.$inferSelect;
export type InsertTarget = z.infer<typeof insertTargetSchema>;
export type Tool = typeof tools.$inferSelect;
export type InsertTool = z.infer<typeof insertToolSchema>;
export type Execution = typeof executions.$inferSelect;
export type InsertExecution = z.infer<typeof insertExecutionSchema>;
export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type Vulnerability = typeof vulnerabilities.$inferSelect;
export type InsertVulnerability = z.infer<typeof insertVulnerabilitySchema>;
