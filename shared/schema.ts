import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const parents = pgTable("parents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  idNumber: text("id_number").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: varchar("parent_id").notNull().references(() => parents.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  age: integer("age").notNull(),
  school: text("school").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const qrCodeHistory = pgTable("qr_code_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  qrCodeData: text("qr_code_data").notNull(),
  version: integer("version").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const qrScans = pgTable("qr_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  scanType: text("scan_type").notNull(),
  location: text("location"),
  driverInfo: text("driver_info"),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
});

export const parentsRelations = relations(parents, ({ many }) => ({
  students: many(students),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  parent: one(parents, {
    fields: [students.parentId],
    references: [parents.id],
  }),
  qrCodes: many(qrCodeHistory),
  scans: many(qrScans),
}));

export const qrCodeHistoryRelations = relations(qrCodeHistory, ({ one }) => ({
  student: one(students, {
    fields: [qrCodeHistory.studentId],
    references: [students.id],
  }),
}));

export const qrScansRelations = relations(qrScans, ({ one }) => ({
  student: one(students, {
    fields: [qrScans.studentId],
    references: [students.id],
  }),
}));

export const insertParentSchema = createInsertSchema(parents).omit({
  id: true,
  createdAt: true,
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  parentId: true,
  createdAt: true,
});

export const insertQRCodeHistorySchema = createInsertSchema(qrCodeHistory).omit({
  id: true,
  createdAt: true,
});

export const insertQRScanSchema = createInsertSchema(qrScans).omit({
  id: true,
  scannedAt: true,
});

export type InsertParent = z.infer<typeof insertParentSchema>;
export type Parent = typeof parents.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;
export type InsertQRCodeHistory = z.infer<typeof insertQRCodeHistorySchema>;
export type QRCodeHistory = typeof qrCodeHistory.$inferSelect;
export type InsertQRScan = z.infer<typeof insertQRScanSchema>;
export type QRScan = typeof qrScans.$inferSelect;
