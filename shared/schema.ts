import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const parents = pgTable("parents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  idNumber: text("id_number").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  username: text("username"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: varchar("parent_id").notNull().references(() => parents.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  school: text("school").notNull(),
  specialNeeds: text("special_needs"),
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
  driverId: varchar("driver_id").references(() => drivers.id, { onDelete: 'set null' }),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id, { onDelete: 'set null' }),
  shiftId: varchar("shift_id").references(() => shifts.id, { onDelete: 'set null' }),
  scanType: text("scan_type").notNull(),
  location: text("location"),
  forced: boolean("forced").notNull().default(false),
  forceReason: text("force_reason"),
  synced: boolean("synced").notNull().default(true),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
});

export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  busNumber: text("bus_number").notNull(),
  registrationNumber: text("registration_number").notNull(),
  depotName: text("depot_name").notNull(),
  make: text("make"),
  model: text("model"),
  licenseDiskImage: text("license_disk_image"),
  licenseExpiryDate: date("license_expiry_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vehicleDocuments = pgTable("vehicle_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  documentImage: text("document_image").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shiftNumber: text("shift_number").notNull(),
  shiftTitle: text("shift_title").notNull(),
  shiftDescription: text("shift_description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyNumber: text("company_number").notNull(),
  driverName: text("driver_name").notNull(),
  idNumber: text("id_number"),
  contactNumber: text("contact_number"),
  idCopyImage: text("id_copy_image"),
  driversLicenseImage: text("drivers_license_image"),
  pdpImage: text("pdp_image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const venues = pgTable("venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  locationDescription: text("location_description"),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  contactDetails: text("contact_details"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const venueStaff = pgTable("venue_staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  venueId: varchar("venue_id").notNull().references(() => venues.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  idNumber: text("id_number"),
  contactNumber: text("contact_number"),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const venueScans = pgTable("venue_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  venueId: varchar("venue_id").notNull().references(() => venues.id, { onDelete: 'cascade' }),
  staffId: varchar("staff_id").references(() => venueStaff.id, { onDelete: 'set null' }),
  studentId: varchar("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  scanType: text("scan_type").notNull(),
  location: text("location"),
  locationConfirmed: boolean("location_confirmed").notNull().default(false),
  forced: boolean("forced").notNull().default(false),
  forceReason: text("force_reason"),
  synced: boolean("synced").notNull().default(true),
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
  driver: one(drivers, {
    fields: [qrScans.driverId],
    references: [drivers.id],
  }),
  vehicle: one(vehicles, {
    fields: [qrScans.vehicleId],
    references: [vehicles.id],
  }),
  shift: one(shifts, {
    fields: [qrScans.shiftId],
    references: [shifts.id],
  }),
}));

export const vehiclesRelations = relations(vehicles, ({ many }) => ({
  scans: many(qrScans),
  documents: many(vehicleDocuments),
}));

export const vehicleDocumentsRelations = relations(vehicleDocuments, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [vehicleDocuments.vehicleId],
    references: [vehicles.id],
  }),
}));

export const shiftsRelations = relations(shifts, ({ many }) => ({
  scans: many(qrScans),
}));

export const driversRelations = relations(drivers, ({ many }) => ({
  scans: many(qrScans),
}));

export const venuesRelations = relations(venues, ({ many }) => ({
  staff: many(venueStaff),
  scans: many(venueScans),
}));

export const venueStaffRelations = relations(venueStaff, ({ one, many }) => ({
  venue: one(venues, {
    fields: [venueStaff.venueId],
    references: [venues.id],
  }),
  scans: many(venueScans),
}));

export const venueScansRelations = relations(venueScans, ({ one }) => ({
  venue: one(venues, {
    fields: [venueScans.venueId],
    references: [venues.id],
  }),
  staff: one(venueStaff, {
    fields: [venueScans.staffId],
    references: [venueStaff.id],
  }),
  student: one(students, {
    fields: [venueScans.studentId],
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

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
});

export const insertVehicleDocumentSchema = createInsertSchema(vehicleDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertShiftSchema = createInsertSchema(shifts).omit({
  id: true,
  createdAt: true,
});

export const insertDriverSchema = createInsertSchema(drivers).omit({
  id: true,
  createdAt: true,
});

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
});

export const insertVenueSchema = createInsertSchema(venues).omit({
  id: true,
  createdAt: true,
});

export const insertVenueStaffSchema = createInsertSchema(venueStaff).omit({
  id: true,
  createdAt: true,
});

export const insertVenueScanSchema = createInsertSchema(venueScans).omit({
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
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicleDocument = z.infer<typeof insertVehicleDocumentSchema>;
export type VehicleDocument = typeof vehicleDocuments.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof drivers.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertVenue = z.infer<typeof insertVenueSchema>;
export type Venue = typeof venues.$inferSelect;
export type InsertVenueStaff = z.infer<typeof insertVenueStaffSchema>;
export type VenueStaff = typeof venueStaff.$inferSelect;
export type InsertVenueScan = z.infer<typeof insertVenueScanSchema>;
export type VenueScan = typeof venueScans.$inferSelect;
