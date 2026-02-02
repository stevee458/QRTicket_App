import { db } from "../db";
import { parents, students, qrCodeHistory, qrScans, vehicles, shifts, drivers, admins, vehicleDocuments, venues, venueStaff, venueScans, type InsertParent, type Parent, type InsertStudent, type Student, type QRCodeHistory, type InsertQRCodeHistory, type InsertQRScan, type QRScan, type InsertVehicle, type Vehicle, type InsertShift, type Shift, type InsertDriver, type Driver, type InsertAdmin, type Admin, type InsertVehicleDocument, type VehicleDocument, type InsertVenue, type Venue, type InsertVenueStaff, type VenueStaff, type InsertVenueScan, type VenueScan } from "@shared/schema";
import { eq, ilike, desc, and, gte, lte } from "drizzle-orm";
import bcrypt from "bcryptjs";

export type StudentStatus = "Not Boarded" | "Boarded" | "Alighted";

export type StudentWithQR = Student & { qrCode?: string; qrCodeCreatedAt?: Date; status?: StudentStatus };

export type CombinedScan = {
  id: string;
  studentId: string;
  scanType: string;
  scannedAt: Date;
  location: string | null;
  forced: boolean;
  source: "vehicle" | "venue";
  // Vehicle-specific fields
  driver?: { id: string; name: string } | null;
  vehicle?: { id: string; busNumber: string } | null;
  shift?: { id: string; title: string } | null;
  // Venue-specific fields
  venue?: { id: string; name: string } | null;
  staff?: { id: string; name: string } | null;
};

export interface IStorage {
  createRegistration(
    parentData: InsertParent,
    studentsData: Array<InsertStudent>
  ): Promise<{ parent: Parent; students: Student[] }>;
  
  getParentWithStudents(parentId: string): Promise<{ parent: Parent; students: StudentWithQR[] } | null>;
  
  searchParents(searchTerm: string): Promise<Array<{ parent: Parent; students: StudentWithQR[] }>>;
  
  searchStudents(searchTerm: string): Promise<Array<{ student: StudentWithQR; parent: Parent }>>;
  
  getStudentWithParent(studentId: string): Promise<{ student: StudentWithQR; parent: Parent } | null>;
  
  updateParent(parentId: string, data: Partial<InsertParent>): Promise<Parent>;
  
  updateStudent(studentId: string, data: Partial<InsertStudent>): Promise<Student>;
  
  createQRCode(studentId: string, qrCodeData: string): Promise<QRCodeHistory>;
  
  getActiveQRCode(studentId: string): Promise<QRCodeHistory | null>;
  
  regenerateQRCode(studentId: string, qrCodeData: string): Promise<QRCodeHistory>;
  
  deleteParent(parentId: string): Promise<void>;
  
  deleteStudent(studentId: string): Promise<{ deletedParent: boolean }>;
  
  countSiblings(studentId: string): Promise<number>;
  
  updateQRCodeData(qrId: string, qrCodeData: string): Promise<void>;
  
  validateQRCode(studentId: string, version: number): Promise<{ valid: boolean; student?: Student }>;
  
  recordScan(scanData: InsertQRScan): Promise<QRScan>;
  
  getStudentStatus(studentId: string): Promise<{
    status: StudentStatus;
    scanTime: Date | null;
    scanLocation: string | null;
    vehicle: { busNumber: string; registrationNumber: string } | null;
    shift: { shiftTitle: string } | null;
    driver: { driverName: string } | null;
  }>;

  getActiveQRVersion(studentId: string): Promise<{
    version: number;
    createdAt: Date;
  } | null>;
  
  createVehicle(data: InsertVehicle): Promise<Vehicle>;
  
  searchVehicles(searchTerm: string): Promise<Vehicle[]>;
  
  updateVehicle(vehicleId: string, data: Partial<InsertVehicle>): Promise<Vehicle>;
  
  deleteVehicle(vehicleId: string): Promise<void>;

  getVehicleById(vehicleId: string): Promise<Vehicle | null>;

  getVehicleWithDocuments(vehicleId: string): Promise<{ vehicle: Vehicle; documents: VehicleDocument[] } | null>;
  
  createVehicleDocument(data: InsertVehicleDocument): Promise<VehicleDocument>;
  
  deleteVehicleDocument(documentId: string): Promise<void>;

  getDriverById(driverId: string): Promise<Driver | null>;
  
  createShift(data: InsertShift): Promise<Shift>;
  
  searchShifts(searchTerm: string): Promise<Shift[]>;
  
  updateShift(shiftId: string, data: Partial<InsertShift>): Promise<Shift>;
  
  deleteShift(shiftId: string): Promise<void>;
  
  createDriver(data: InsertDriver): Promise<Driver>;
  
  searchDrivers(searchTerm: string): Promise<Driver[]>;
  
  updateDriver(driverId: string, data: Partial<InsertDriver>): Promise<Driver>;
  
  deleteDriver(driverId: string): Promise<void>;
  
  validateDriver(driverName: string, companyNumber: string): Promise<Driver | null>;
  
  getAllVehicles(): Promise<Vehicle[]>;
  
  getAllShifts(): Promise<Shift[]>;
  
  getAllParents(): Promise<Array<{ parent: Parent; students: StudentWithQR[] }>>;
  
  getAllStudents(): Promise<Array<{ student: StudentWithQR; parent: Parent }>>;
  
  getAllDrivers(): Promise<Driver[]>;
  
  createQRScan(scanData: InsertQRScan): Promise<QRScan>;
  
  getStudentByQRCode(qrData: string): Promise<StudentWithQR | null>;
  
  getOnboardStudents(driverId: string, vehicleId: string, shiftId: string): Promise<StudentWithQR[]>;
  
  authenticateParent(username: string, password: string): Promise<Parent | null>;
  
  getParentById(parentId: string): Promise<Parent | null>;
  
  getStudentScans(studentId: string, startDate?: Date, endDate?: Date): Promise<QRScan[]>;
  
  getStudentAllScans(studentId: string, startDate?: Date, endDate?: Date): Promise<CombinedScan[]>;
  
  authenticateAdmin(username: string, password: string): Promise<Admin | null>;
  
  getAdminById(adminId: string): Promise<Admin | null>;
  
  createAdmin(data: InsertAdmin): Promise<Admin>;
  
  seedSuperAdmin(): Promise<void>;
  
  createVenue(data: InsertVenue): Promise<Venue>;
  
  getAllVenues(): Promise<Venue[]>;
  
  getVenueById(venueId: string): Promise<Venue | null>;
  
  getVenueWithStaff(venueId: string): Promise<{ venue: Venue; staff: VenueStaff[] } | null>;
  
  updateVenue(venueId: string, data: Partial<InsertVenue>): Promise<Venue>;
  
  deleteVenue(venueId: string): Promise<void>;
  
  createVenueStaff(data: InsertVenueStaff): Promise<VenueStaff>;
  
  updateVenueStaff(staffId: string, data: Partial<InsertVenueStaff>): Promise<VenueStaff>;
  
  deleteVenueStaff(staffId: string): Promise<void>;
  
  authenticateVenueStaff(name: string, password: string): Promise<{ staff: VenueStaff; venue: Venue } | null>;
  
  getVenueStaffById(staffId: string): Promise<VenueStaff | null>;
  
  createVenueScan(data: InsertVenueScan): Promise<VenueScan>;
  
  getVenueScans(venueId: string, startDate?: Date, endDate?: Date): Promise<VenueScan[]>;
  
  getStudentsAtVenue(venueId: string): Promise<Array<{ student: Student; scanTime: Date }>>;
  
  getStudentVenueStatus(studentId: string): Promise<{
    isAtVenue: boolean;
    venueName: string | null;
    scanTime: Date | null;
  } | null>;

  getDashboardStats(): Promise<{
    totalStudents: number;
    totalParents: number;
    studentsOnBuses: number;
    studentsAtVenues: number;
    todayScans: number;
  }>;

  getActiveStudents(): Promise<Array<{
    student: Student;
    locationType: "bus" | "venue";
    locationName: string;
    since: Date;
    details?: {
      vehicleId?: string;
      busNumber?: string;
      shiftTitle?: string;
      driverName?: string;
      venueName?: string;
    };
  }>>;

  getRecentActivity(limit?: number): Promise<CombinedScan[]>;
}

export class DbStorage implements IStorage {
  async createRegistration(
    parentData: InsertParent,
    studentsData: Array<InsertStudent>
  ): Promise<{ parent: Parent; students: Student[] }> {
    const [parent] = await db.insert(parents).values(parentData).returning();
    
    const studentRecords = await db
      .insert(students)
      .values(
        studentsData.map((student) => ({
          name: student.name,
          phone: student.phone,
          email: student.email,
          dateOfBirth: student.dateOfBirth,
          school: student.school,
          parentId: parent.id,
        }))
      )
      .returning();

    return { parent, students: studentRecords };
  }

  async createQRCode(studentId: string, qrCodeData: string): Promise<QRCodeHistory> {
    const existingQRs = await db.query.qrCodeHistory.findMany({
      where: eq(qrCodeHistory.studentId, studentId),
      orderBy: [desc(qrCodeHistory.version)],
    });

    const nextVersion = existingQRs.length > 0 ? existingQRs[0].version + 1 : 1;

    const [newQR] = await db
      .insert(qrCodeHistory)
      .values({
        studentId,
        qrCodeData,
        version: nextVersion,
        isActive: true,
      })
      .returning();

    return newQR;
  }

  async getActiveQRCode(studentId: string): Promise<QRCodeHistory | null> {
    const activeQR = await db.query.qrCodeHistory.findFirst({
      where: and(
        eq(qrCodeHistory.studentId, studentId),
        eq(qrCodeHistory.isActive, true)
      ),
    });

    return activeQR || null;
  }

  async regenerateQRCode(studentId: string, qrCodeData: string): Promise<QRCodeHistory> {
    await db
      .update(qrCodeHistory)
      .set({ isActive: false })
      .where(eq(qrCodeHistory.studentId, studentId));

    const existingQRs = await db.query.qrCodeHistory.findMany({
      where: eq(qrCodeHistory.studentId, studentId),
      orderBy: [desc(qrCodeHistory.version)],
    });

    const nextVersion = existingQRs.length > 0 ? Math.max(...existingQRs.map(q => q.version)) + 1 : 1;

    const [newQR] = await db
      .insert(qrCodeHistory)
      .values({
        studentId,
        qrCodeData,
        version: nextVersion,
        isActive: true,
      })
      .returning();

    const allQRs = await db.query.qrCodeHistory.findMany({
      where: eq(qrCodeHistory.studentId, studentId),
      orderBy: [desc(qrCodeHistory.createdAt)],
    });

    if (allQRs.length > 4) {
      const qrsToDelete = allQRs.slice(4);
      for (const qr of qrsToDelete) {
        await db.delete(qrCodeHistory).where(eq(qrCodeHistory.id, qr.id));
      }
    }

    return newQR;
  }

  async getParentWithStudents(parentId: string): Promise<{ parent: Parent; students: StudentWithQR[] } | null> {
    const parent = await db.query.parents.findFirst({
      where: eq(parents.id, parentId),
      with: {
        students: {
          with: {
            qrCodes: {
              where: eq(qrCodeHistory.isActive, true),
              limit: 1,
            },
          },
        },
      },
    });

    if (!parent) {
      return null;
    }

    const studentsWithQR: StudentWithQR[] = parent.students.map(student => ({
      ...student,
      qrCode: student.qrCodes[0]?.qrCodeData,
      qrCodeCreatedAt: student.qrCodes[0]?.createdAt,
    }));

    return {
      parent: {
        id: parent.id,
        name: parent.name,
        idNumber: parent.idNumber,
        phone: parent.phone,
        email: parent.email,
        username: parent.username,
        password: parent.password,
        createdAt: parent.createdAt,
      },
      students: studentsWithQR,
    };
  }

  async searchParents(searchTerm: string): Promise<Array<{ parent: Parent; students: StudentWithQR[] }>> {
    const results = await db.query.parents.findMany({
      where: ilike(parents.name, `%${searchTerm}%`),
      with: {
        students: {
          with: {
            qrCodes: {
              where: eq(qrCodeHistory.isActive, true),
              limit: 1,
            },
          },
        },
      },
    });

    return results.map((result) => ({
      parent: {
        id: result.id,
        name: result.name,
        idNumber: result.idNumber,
        phone: result.phone,
        email: result.email,
        username: result.username,
        password: result.password,
        createdAt: result.createdAt,
      },
      students: result.students.map(student => ({
        ...student,
        qrCode: student.qrCodes[0]?.qrCodeData,
        qrCodeCreatedAt: student.qrCodes[0]?.createdAt,
      })),
    }));
  }

  async searchStudents(searchTerm: string): Promise<Array<{ student: StudentWithQR; parent: Parent }>> {
    const results = await db.query.students.findMany({
      where: ilike(students.name, `%${searchTerm}%`),
      with: {
        parent: true,
        qrCodes: {
          where: eq(qrCodeHistory.isActive, true),
          limit: 1,
        },
      },
    });

    return results.map((result) => ({
      student: {
        id: result.id,
        name: result.name,
        phone: result.phone,
        email: result.email,
        dateOfBirth: result.dateOfBirth,
        school: result.school,
        parentId: result.parentId,
        createdAt: result.createdAt,
        qrCode: result.qrCodes[0]?.qrCodeData,
        qrCodeCreatedAt: result.qrCodes[0]?.createdAt,
      },
      parent: result.parent,
    }));
  }

  async getStudentWithParent(studentId: string): Promise<{ student: StudentWithQR; parent: Parent } | null> {
    const result = await db.query.students.findFirst({
      where: eq(students.id, studentId),
      with: {
        parent: true,
        qrCodes: {
          where: eq(qrCodeHistory.isActive, true),
          limit: 1,
        },
      },
    });

    if (!result) {
      return null;
    }

    return {
      student: {
        id: result.id,
        name: result.name,
        phone: result.phone,
        email: result.email,
        dateOfBirth: result.dateOfBirth,
        school: result.school,
        parentId: result.parentId,
        createdAt: result.createdAt,
        qrCode: result.qrCodes[0]?.qrCodeData,
        qrCodeCreatedAt: result.qrCodes[0]?.createdAt,
      },
      parent: result.parent,
    };
  }

  async updateParent(parentId: string, data: Partial<InsertParent>): Promise<Parent> {
    const [updated] = await db
      .update(parents)
      .set(data)
      .where(eq(parents.id, parentId))
      .returning();

    return updated;
  }

  async updateStudent(studentId: string, data: Partial<InsertStudent>): Promise<Student> {
    const [updated] = await db
      .update(students)
      .set(data)
      .where(eq(students.id, studentId))
      .returning();

    return updated;
  }

  async deleteParent(parentId: string): Promise<void> {
    const parent = await db.query.parents.findFirst({
      where: eq(parents.id, parentId),
    });

    if (!parent) {
      throw new Error("Parent not found");
    }

    await db.delete(parents).where(eq(parents.id, parentId));
  }

  async countSiblings(studentId: string): Promise<number> {
    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
    });

    if (!student) {
      throw new Error("Student not found");
    }

    const siblings = await db.query.students.findMany({
      where: eq(students.parentId, student.parentId),
    });

    return siblings.length - 1;
  }

  async deleteStudent(studentId: string): Promise<{ deletedParent: boolean }> {
    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
    });

    if (!student) {
      throw new Error("Student not found");
    }

    const siblingCount = await this.countSiblings(studentId);

    await db.delete(students).where(eq(students.id, studentId));

    if (siblingCount === 0) {
      await db.delete(parents).where(eq(parents.id, student.parentId));
      return { deletedParent: true };
    }

    return { deletedParent: false };
  }

  async updateQRCodeData(qrId: string, qrCodeData: string): Promise<void> {
    await db
      .update(qrCodeHistory)
      .set({ qrCodeData })
      .where(eq(qrCodeHistory.id, qrId));
  }

  async validateQRCode(studentId: string, version: number): Promise<{ valid: boolean; student?: Student }> {
    const activeQR = await db.query.qrCodeHistory.findFirst({
      where: and(
        eq(qrCodeHistory.studentId, studentId),
        eq(qrCodeHistory.isActive, true)
      ),
    });

    if (!activeQR) {
      return { valid: false };
    }

    if (activeQR.version !== version) {
      return { valid: false };
    }

    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
    });

    if (!student) {
      return { valid: false };
    }

    return { valid: true, student };
  }

  async recordScan(scanData: InsertQRScan): Promise<QRScan> {
    const [scan] = await db.insert(qrScans).values(scanData).returning();
    return scan;
  }

  async getStudentStatus(studentId: string): Promise<{
    status: StudentStatus;
    scanTime: Date | null;
    scanLocation: string | null;
    vehicle: { busNumber: string; registrationNumber: string } | null;
    shift: { shiftTitle: string } | null;
    driver: { driverName: string } | null;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayScans = await db.query.qrScans.findMany({
      where: and(
        eq(qrScans.studentId, studentId),
        gte(qrScans.scannedAt, today)
      ),
      orderBy: [desc(qrScans.scannedAt)],
      with: {
        vehicle: true,
        shift: true,
        driver: true,
      },
    });

    if (todayScans.length === 0) {
      const lastAlightingScan = await db.query.qrScans.findFirst({
        where: and(
          eq(qrScans.studentId, studentId),
          eq(qrScans.scanType, "Off")
        ),
        orderBy: [desc(qrScans.scannedAt)],
      });

      return {
        status: "Not Boarded",
        scanTime: lastAlightingScan?.scannedAt || null,
        scanLocation: lastAlightingScan?.location || null,
        vehicle: null,
        shift: null,
        driver: null,
      };
    }

    const lastScan = todayScans[0];
    
    if (lastScan.scanType === "On") {
      return {
        status: "Boarded",
        scanTime: lastScan.scannedAt,
        scanLocation: lastScan.location,
        vehicle: lastScan.vehicle ? { 
          busNumber: lastScan.vehicle.busNumber, 
          registrationNumber: lastScan.vehicle.registrationNumber 
        } : null,
        shift: lastScan.shift ? { shiftTitle: lastScan.shift.shiftTitle } : null,
        driver: lastScan.driver ? { driverName: lastScan.driver.driverName } : null,
      };
    }

    if (lastScan.scanType === "Off") {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      if (lastScan.scannedAt > fifteenMinutesAgo) {
        return {
          status: "Alighted",
          scanTime: lastScan.scannedAt,
          scanLocation: lastScan.location,
          vehicle: null,
          shift: null,
          driver: null,
        };
      } else {
        const lastAlightingScan = await db.query.qrScans.findFirst({
          where: and(
            eq(qrScans.studentId, studentId),
            eq(qrScans.scanType, "Off")
          ),
          orderBy: [desc(qrScans.scannedAt)],
        });

        return {
          status: "Not Boarded",
          scanTime: lastAlightingScan?.scannedAt || null,
          scanLocation: lastAlightingScan?.location || null,
          vehicle: null,
          shift: null,
          driver: null,
        };
      }
    }

    return {
      status: "Not Boarded",
      scanTime: null,
      scanLocation: null,
      vehicle: null,
      shift: null,
      driver: null,
    };
  }

  async getActiveQRVersion(studentId: string): Promise<{
    version: number;
    createdAt: Date;
  } | null> {
    const activeQR = await db.query.qrCodeHistory.findFirst({
      where: and(
        eq(qrCodeHistory.studentId, studentId),
        eq(qrCodeHistory.isActive, true)
      ),
    });

    if (!activeQR) {
      return null;
    }

    return {
      version: activeQR.version,
      createdAt: activeQR.createdAt,
    };
  }

  async createVehicle(data: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(data).returning();
    return vehicle;
  }

  async searchVehicles(searchTerm: string): Promise<Vehicle[]> {
    const results = await db.query.vehicles.findMany({
      where: ilike(vehicles.busNumber, `%${searchTerm}%`),
    });
    return results;
  }

  async updateVehicle(vehicleId: string, data: Partial<InsertVehicle>): Promise<Vehicle> {
    const [updated] = await db
      .update(vehicles)
      .set(data)
      .where(eq(vehicles.id, vehicleId))
      .returning();
    return updated;
  }

  async deleteVehicle(vehicleId: string): Promise<void> {
    await db.delete(vehicles).where(eq(vehicles.id, vehicleId));
  }

  async getVehicleById(vehicleId: string): Promise<Vehicle | null> {
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, vehicleId),
    });
    return vehicle || null;
  }

  async getVehicleWithDocuments(vehicleId: string): Promise<{ vehicle: Vehicle; documents: VehicleDocument[] } | null> {
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, vehicleId),
      with: {
        documents: true,
      },
    });
    if (!vehicle) return null;
    return {
      vehicle,
      documents: vehicle.documents || [],
    };
  }

  async createVehicleDocument(data: InsertVehicleDocument): Promise<VehicleDocument> {
    const [document] = await db.insert(vehicleDocuments).values(data).returning();
    return document;
  }

  async deleteVehicleDocument(documentId: string): Promise<void> {
    await db.delete(vehicleDocuments).where(eq(vehicleDocuments.id, documentId));
  }

  async getDriverById(driverId: string): Promise<Driver | null> {
    const driver = await db.query.drivers.findFirst({
      where: eq(drivers.id, driverId),
    });
    return driver || null;
  }

  async createShift(data: InsertShift): Promise<Shift> {
    const [shift] = await db.insert(shifts).values(data).returning();
    return shift;
  }

  async searchShifts(searchTerm: string): Promise<Shift[]> {
    const results = await db.query.shifts.findMany({
      where: ilike(shifts.shiftNumber, `%${searchTerm}%`),
    });
    return results;
  }

  async updateShift(shiftId: string, data: Partial<InsertShift>): Promise<Shift> {
    const [updated] = await db
      .update(shifts)
      .set(data)
      .where(eq(shifts.id, shiftId))
      .returning();
    return updated;
  }

  async deleteShift(shiftId: string): Promise<void> {
    await db.delete(shifts).where(eq(shifts.id, shiftId));
  }

  async createDriver(data: InsertDriver): Promise<Driver> {
    const [driver] = await db.insert(drivers).values(data).returning();
    return driver;
  }

  async searchDrivers(searchTerm: string): Promise<Driver[]> {
    const results = await db.query.drivers.findMany({
      where: ilike(drivers.driverName, `%${searchTerm}%`),
    });
    return results;
  }

  async updateDriver(driverId: string, data: Partial<InsertDriver>): Promise<Driver> {
    const [updated] = await db
      .update(drivers)
      .set(data)
      .where(eq(drivers.id, driverId))
      .returning();
    return updated;
  }

  async deleteDriver(driverId: string): Promise<void> {
    await db.delete(drivers).where(eq(drivers.id, driverId));
  }

  async validateDriver(driverName: string, companyNumber: string): Promise<Driver | null> {
    const driver = await db.query.drivers.findFirst({
      where: and(
        eq(drivers.driverName, driverName),
        eq(drivers.companyNumber, companyNumber)
      ),
    });
    return driver || null;
  }

  async getAllVehicles(): Promise<Vehicle[]> {
    const allVehicles = await db.query.vehicles.findMany();
    return allVehicles;
  }

  async getAllShifts(): Promise<Shift[]> {
    const allShifts = await db.query.shifts.findMany();
    return allShifts;
  }

  async getAllParents(): Promise<Array<{ parent: Parent; students: StudentWithQR[] }>> {
    const allParents = await db.query.parents.findMany({
      with: {
        students: {
          with: {
            qrCodes: {
              where: eq(qrCodeHistory.isActive, true),
              limit: 1,
            },
          },
        },
      },
    });

    return allParents.map((parentRecord) => ({
      parent: {
        id: parentRecord.id,
        name: parentRecord.name,
        idNumber: parentRecord.idNumber,
        phone: parentRecord.phone,
        email: parentRecord.email,
        username: parentRecord.username,
        password: parentRecord.password,
        createdAt: parentRecord.createdAt,
      },
      students: parentRecord.students.map((student) => ({
        id: student.id,
        name: student.name,
        phone: student.phone,
        email: student.email,
        dateOfBirth: student.dateOfBirth,
        school: student.school,
        parentId: student.parentId,
        createdAt: student.createdAt,
        qrCode: student.qrCodes[0]?.qrCodeData,
        qrCodeCreatedAt: student.qrCodes[0]?.createdAt,
      })),
    }));
  }

  async getAllStudents(): Promise<Array<{ student: StudentWithQR; parent: Parent }>> {
    const allStudents = await db.query.students.findMany({
      with: {
        parent: true,
        qrCodes: {
          where: eq(qrCodeHistory.isActive, true),
          limit: 1,
        },
      },
    });

    return allStudents.map((result) => ({
      student: {
        id: result.id,
        name: result.name,
        phone: result.phone,
        email: result.email,
        dateOfBirth: result.dateOfBirth,
        school: result.school,
        parentId: result.parentId,
        createdAt: result.createdAt,
        qrCode: result.qrCodes[0]?.qrCodeData,
        qrCodeCreatedAt: result.qrCodes[0]?.createdAt,
      },
      parent: result.parent,
    }));
  }

  async getAllDrivers(): Promise<Driver[]> {
    const allDrivers = await db.query.drivers.findMany();
    return allDrivers;
  }

  async createQRScan(scanData: InsertQRScan): Promise<QRScan> {
    const [scan] = await db.insert(qrScans).values(scanData).returning();
    return scan;
  }

  async getStudentByQRCode(qrData: string): Promise<StudentWithQR | null> {
    try {
      const parsedQR = JSON.parse(qrData);
      const studentId = parsedQR.studentId;
      const version = parsedQR.version;

      const validation = await this.validateQRCode(studentId, version);
      
      if (!validation.valid || !validation.student) {
        return null;
      }

      const activeQR = await this.getActiveQRCode(studentId);
      const statusData = await this.getStudentStatus(studentId);

      return {
        ...validation.student,
        qrCode: activeQR?.qrCodeData,
        qrCodeCreatedAt: activeQR?.createdAt,
        status: statusData.status,
      };
    } catch (error) {
      console.error("Error parsing QR code:", error);
      return null;
    }
  }

  async getOnboardStudents(driverId: string, vehicleId: string, shiftId: string): Promise<StudentWithQR[]> {
    // Get ALL scans for this driver/vehicle/shift
    const allScans = await db.query.qrScans.findMany({
      where: and(
        eq(qrScans.driverId, driverId),
        eq(qrScans.vehicleId, vehicleId),
        eq(qrScans.shiftId, shiftId)
      ),
      with: {
        student: true,
      },
      orderBy: [desc(qrScans.scannedAt)],
    });

    // Group scans by student and find most recent for each
    const studentMostRecentScan = new Map();
    
    for (const scan of allScans) {
      if (!studentMostRecentScan.has(scan.studentId)) {
        studentMostRecentScan.set(scan.studentId, scan);
      }
    }

    // Filter to only students whose most recent scan is "On"
    const onboardStudents = Array.from(studentMostRecentScan.values())
      .filter(scan => scan.scanType === "On")
      .map(scan => scan.student);

    // Enrich with QR codes and status
    const studentsWithQR = await Promise.all(
      onboardStudents.map(async (student) => {
        const activeQR = await this.getActiveQRCode(student.id);
        const statusData = await this.getStudentStatus(student.id);
        return {
          ...student,
          qrCode: activeQR?.qrCodeData,
          qrCodeCreatedAt: activeQR?.createdAt,
          status: statusData.status,
        };
      })
    );

    return studentsWithQR;
  }

  async authenticateParent(username: string, password: string): Promise<Parent | null> {
    const parent = await db.query.parents.findFirst({
      where: and(
        eq(parents.username, username),
        eq(parents.password, password)
      ),
    });
    
    return parent || null;
  }

  async getParentById(parentId: string): Promise<Parent | null> {
    const parent = await db.query.parents.findFirst({
      where: eq(parents.id, parentId),
    });
    
    return parent || null;
  }

  async getStudentScans(studentId: string, startDate?: Date, endDate?: Date): Promise<QRScan[]> {
    let whereClause;
    
    if (startDate && endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      whereClause = and(
        eq(qrScans.studentId, studentId),
        gte(qrScans.scannedAt, startDate),
        lte(qrScans.scannedAt, endOfDay)
      );
    } else if (startDate) {
      whereClause = and(
        eq(qrScans.studentId, studentId),
        gte(qrScans.scannedAt, startDate)
      );
    } else {
      whereClause = eq(qrScans.studentId, studentId);
    }
    
    const scans = await db.query.qrScans.findMany({
      where: whereClause,
      with: {
        driver: true,
        vehicle: true,
        shift: true,
      },
      orderBy: [desc(qrScans.scannedAt)],
    });
    
    return scans;
  }

  async getStudentAllScans(studentId: string, startDate?: Date, endDate?: Date): Promise<CombinedScan[]> {
    let driverWhereClause;
    let venueWhereClause;
    
    if (startDate && endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      driverWhereClause = and(
        eq(qrScans.studentId, studentId),
        gte(qrScans.scannedAt, startDate),
        lte(qrScans.scannedAt, endOfDay)
      );
      venueWhereClause = and(
        eq(venueScans.studentId, studentId),
        gte(venueScans.scannedAt, startDate),
        lte(venueScans.scannedAt, endOfDay)
      );
    } else if (startDate) {
      driverWhereClause = and(
        eq(qrScans.studentId, studentId),
        gte(qrScans.scannedAt, startDate)
      );
      venueWhereClause = and(
        eq(venueScans.studentId, studentId),
        gte(venueScans.scannedAt, startDate)
      );
    } else {
      driverWhereClause = eq(qrScans.studentId, studentId);
      venueWhereClause = eq(venueScans.studentId, studentId);
    }
    
    const [driverScans, venueScansData] = await Promise.all([
      db.query.qrScans.findMany({
        where: driverWhereClause,
        with: {
          driver: true,
          vehicle: true,
          shift: true,
        },
      }),
      db.query.venueScans.findMany({
        where: venueWhereClause,
        with: {
          venue: true,
          staff: true,
        },
      }),
    ]);
    
    const combinedScans: CombinedScan[] = [
      ...driverScans.map(scan => ({
        id: scan.id,
        studentId: scan.studentId,
        scanType: scan.scanType === "On" ? "Board" : scan.scanType === "Off" ? "Alight" : scan.scanType,
        scannedAt: scan.scannedAt,
        location: scan.location,
        forced: scan.forced,
        source: "vehicle" as const,
        driver: scan.driver ? { id: scan.driver.id, name: scan.driver.driverName } : null,
        vehicle: scan.vehicle ? { id: scan.vehicle.id, busNumber: scan.vehicle.busNumber } : null,
        shift: scan.shift ? { id: scan.shift.id, title: scan.shift.shiftTitle } : null,
        venue: null,
        staff: null,
      })),
      ...venueScansData.map(scan => ({
        id: scan.id,
        studentId: scan.studentId,
        scanType: scan.scanType === "In" ? "Check In" : scan.scanType === "Out" ? "Check Out" : scan.scanType,
        scannedAt: scan.scannedAt,
        location: scan.location,
        forced: scan.forced,
        source: "venue" as const,
        driver: null,
        vehicle: null,
        shift: null,
        venue: scan.venue ? { id: scan.venue.id, name: scan.venue.name } : null,
        staff: scan.staff ? { id: scan.staff.id, name: scan.staff.name } : null,
      })),
    ];
    
    combinedScans.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
    
    return combinedScans;
  }

  async authenticateAdmin(username: string, password: string): Promise<Admin | null> {
    const admin = await db.query.admins.findFirst({
      where: eq(admins.username, username),
    });
    if (!admin) return null;
    
    const isValid = await bcrypt.compare(password, admin.password);
    return isValid ? admin : null;
  }

  async getAdminById(adminId: string): Promise<Admin | null> {
    const admin = await db.query.admins.findFirst({
      where: eq(admins.id, adminId),
    });
    return admin || null;
  }

  async createAdmin(data: InsertAdmin): Promise<Admin> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const [admin] = await db.insert(admins).values({
      ...data,
      password: hashedPassword,
    }).returning();
    return admin;
  }

  async seedSuperAdmin(): Promise<void> {
    const existing = await db.query.admins.findFirst({
      where: eq(admins.username, "Admin"),
    });
    
    if (!existing) {
      const hashedPassword = await bcrypt.hash("Jarvie", 10);
      await db.insert(admins).values({
        username: "Admin",
        password: hashedPassword,
      });
      console.log("Super admin user created: Admin / Jarvie");
    }
  }

  async createVenue(data: InsertVenue): Promise<Venue> {
    const [venue] = await db.insert(venues).values(data).returning();
    return venue;
  }

  async getAllVenues(): Promise<Venue[]> {
    const allVenues = await db.query.venues.findMany();
    return allVenues;
  }

  async getVenueById(venueId: string): Promise<Venue | null> {
    const venue = await db.query.venues.findFirst({
      where: eq(venues.id, venueId),
    });
    return venue || null;
  }

  async getVenueWithStaff(venueId: string): Promise<{ venue: Venue; staff: VenueStaff[] } | null> {
    const venue = await db.query.venues.findFirst({
      where: eq(venues.id, venueId),
      with: {
        staff: true,
      },
    });
    if (!venue) return null;
    return {
      venue,
      staff: venue.staff || [],
    };
  }

  async updateVenue(venueId: string, data: Partial<InsertVenue>): Promise<Venue> {
    const [updated] = await db
      .update(venues)
      .set(data)
      .where(eq(venues.id, venueId))
      .returning();
    return updated;
  }

  async deleteVenue(venueId: string): Promise<void> {
    await db.delete(venues).where(eq(venues.id, venueId));
  }

  async createVenueStaff(data: InsertVenueStaff): Promise<VenueStaff> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const [staff] = await db.insert(venueStaff).values({
      ...data,
      password: hashedPassword,
    }).returning();
    return staff;
  }

  async updateVenueStaff(staffId: string, data: Partial<InsertVenueStaff>): Promise<VenueStaff> {
    const updateData = { ...data };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    const [updated] = await db
      .update(venueStaff)
      .set(updateData)
      .where(eq(venueStaff.id, staffId))
      .returning();
    return updated;
  }

  async deleteVenueStaff(staffId: string): Promise<void> {
    await db.delete(venueStaff).where(eq(venueStaff.id, staffId));
  }

  async authenticateVenueStaff(name: string, password: string): Promise<{ staff: VenueStaff; venue: Venue } | null> {
    const staff = await db.query.venueStaff.findFirst({
      where: ilike(venueStaff.name, name),
      with: {
        venue: true,
      },
    });
    if (!staff) return null;
    
    const isValid = await bcrypt.compare(password, staff.password);
    if (!isValid) return null;
    
    return {
      staff,
      venue: staff.venue,
    };
  }

  async getVenueStaffById(staffId: string): Promise<VenueStaff | null> {
    const staff = await db.query.venueStaff.findFirst({
      where: eq(venueStaff.id, staffId),
      with: {
        venue: true,
      },
    });
    return staff || null;
  }

  async createVenueScan(data: InsertVenueScan): Promise<VenueScan> {
    const [scan] = await db.insert(venueScans).values(data).returning();
    return scan;
  }

  async getVenueScans(venueId: string, startDate?: Date, endDate?: Date): Promise<VenueScan[]> {
    let whereClause;
    
    if (startDate && endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      whereClause = and(
        eq(venueScans.venueId, venueId),
        gte(venueScans.scannedAt, startDate),
        lte(venueScans.scannedAt, endOfDay)
      );
    } else if (startDate) {
      whereClause = and(
        eq(venueScans.venueId, venueId),
        gte(venueScans.scannedAt, startDate)
      );
    } else {
      whereClause = eq(venueScans.venueId, venueId);
    }
    
    const scans = await db.query.venueScans.findMany({
      where: whereClause,
      with: {
        staff: true,
        student: true,
      },
      orderBy: [desc(venueScans.scannedAt)],
    });
    
    return scans;
  }

  async getStudentsAtVenue(venueId: string): Promise<Array<{ student: Student; scanTime: Date }>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayScans = await db.query.venueScans.findMany({
      where: and(
        eq(venueScans.venueId, venueId),
        gte(venueScans.scannedAt, today)
      ),
      with: {
        student: true,
      },
      orderBy: [desc(venueScans.scannedAt)],
    });

    const studentLatestScans = new Map<string, { student: Student; scanTime: Date; scanType: string }>();
    
    for (const scan of todayScans) {
      if (!studentLatestScans.has(scan.studentId)) {
        studentLatestScans.set(scan.studentId, {
          student: scan.student,
          scanTime: scan.scannedAt,
          scanType: scan.scanType,
        });
      }
    }

    const studentsAtVenue: Array<{ student: Student; scanTime: Date }> = [];
    
    Array.from(studentLatestScans.values()).forEach((data) => {
      if (data.scanType === "In") {
        studentsAtVenue.push({
          student: data.student,
          scanTime: data.scanTime,
        });
      }
    });

    return studentsAtVenue;
  }

  async getStudentVenueStatus(studentId: string): Promise<{
    isAtVenue: boolean;
    venueName: string | null;
    scanTime: Date | null;
  } | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const latestScan = await db.query.venueScans.findFirst({
      where: and(
        eq(venueScans.studentId, studentId),
        gte(venueScans.scannedAt, today)
      ),
      with: {
        venue: true,
      },
      orderBy: [desc(venueScans.scannedAt)],
    });

    if (!latestScan) {
      return null;
    }

    return {
      isAtVenue: latestScan.scanType === "In",
      venueName: latestScan.venue?.name || null,
      scanTime: latestScan.scannedAt,
    };
  }

  async getDashboardStats(): Promise<{
    totalStudents: number;
    totalParents: number;
    studentsOnBuses: number;
    studentsAtVenues: number;
    todayScans: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allStudents = await db.select().from(students);
    const allParents = await db.select().from(parents);
    
    const todayQRScans = await db.select().from(qrScans).where(gte(qrScans.scannedAt, today));
    const todayVenueScans = await db.select().from(venueScans).where(gte(venueScans.scannedAt, today));
    
    let studentsOnBuses = 0;
    let studentsAtVenues = 0;

    const studentIds = allStudents.map(s => s.id);
    
    const qrScansByStudent = new Map<string, { scanType: string; scannedAt: Date }>();
    for (const scan of todayQRScans) {
      const existing = qrScansByStudent.get(scan.studentId);
      if (!existing || scan.scannedAt > existing.scannedAt) {
        qrScansByStudent.set(scan.studentId, { scanType: scan.scanType, scannedAt: scan.scannedAt });
      }
    }

    const venueScansByStudent = new Map<string, { scanType: string; scannedAt: Date }>();
    for (const scan of todayVenueScans) {
      const existing = venueScansByStudent.get(scan.studentId);
      if (!existing || scan.scannedAt > existing.scannedAt) {
        venueScansByStudent.set(scan.studentId, { scanType: scan.scanType, scannedAt: scan.scannedAt });
      }
    }

    for (const studentId of studentIds) {
      const latestQR = qrScansByStudent.get(studentId);
      if (latestQR && latestQR.scanType === "Board") {
        studentsOnBuses++;
        continue;
      }

      const latestVenue = venueScansByStudent.get(studentId);
      if (latestVenue && latestVenue.scanType === "In") {
        studentsAtVenues++;
      }
    }

    return {
      totalStudents: allStudents.length,
      totalParents: allParents.length,
      studentsOnBuses,
      studentsAtVenues,
      todayScans: todayQRScans.length + todayVenueScans.length,
    };
  }

  async getActiveStudents(): Promise<Array<{
    student: Student;
    locationType: "bus" | "venue";
    locationName: string;
    since: Date;
    details?: {
      vehicleId?: string;
      busNumber?: string;
      shiftTitle?: string;
      driverName?: string;
      venueName?: string;
    };
  }>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeStudents: Array<{
      student: Student;
      locationType: "bus" | "venue";
      locationName: string;
      since: Date;
      details?: {
        vehicleId?: string;
        busNumber?: string;
        shiftTitle?: string;
        driverName?: string;
        venueName?: string;
      };
    }> = [];

    const allStudents = await db.select().from(students);
    
    const todayQRScans = await db.query.qrScans.findMany({
      where: gte(qrScans.scannedAt, today),
      with: {
        vehicle: true,
        shift: true,
        driver: true,
      },
      orderBy: [desc(qrScans.scannedAt)],
    });

    const todayVenueScans = await db.query.venueScans.findMany({
      where: gte(venueScans.scannedAt, today),
      with: {
        venue: true,
      },
      orderBy: [desc(venueScans.scannedAt)],
    });

    const latestQRByStudent = new Map<string, typeof todayQRScans[0]>();
    for (const scan of todayQRScans) {
      if (!latestQRByStudent.has(scan.studentId)) {
        latestQRByStudent.set(scan.studentId, scan);
      }
    }

    const latestVenueByStudent = new Map<string, typeof todayVenueScans[0]>();
    for (const scan of todayVenueScans) {
      if (!latestVenueByStudent.has(scan.studentId)) {
        latestVenueByStudent.set(scan.studentId, scan);
      }
    }

    for (const student of allStudents) {
      const latestQRScan = latestQRByStudent.get(student.id);

      if (latestQRScan && latestQRScan.scanType === "Board") {
        activeStudents.push({
          student,
          locationType: "bus",
          locationName: latestQRScan.vehicle?.busNumber || "Unknown Bus",
          since: latestQRScan.scannedAt,
          details: {
            vehicleId: latestQRScan.vehicleId || undefined,
            busNumber: latestQRScan.vehicle?.busNumber || undefined,
            shiftTitle: latestQRScan.shift?.shiftTitle || undefined,
            driverName: latestQRScan.driver?.driverName || undefined,
          },
        });
        continue;
      }

      const latestVenueScan = latestVenueByStudent.get(student.id);

      if (latestVenueScan && latestVenueScan.scanType === "In") {
        activeStudents.push({
          student,
          locationType: "venue",
          locationName: latestVenueScan.venue?.name || "Unknown Venue",
          since: latestVenueScan.scannedAt,
          details: {
            venueName: latestVenueScan.venue?.name || undefined,
          },
        });
      }
    }

    return activeStudents;
  }

  async getRecentActivity(limit: number = 20): Promise<CombinedScan[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recentQRScans = await db.query.qrScans.findMany({
      where: gte(qrScans.scannedAt, today),
      with: {
        vehicle: true,
        shift: true,
        driver: true,
        student: true,
      },
      orderBy: [desc(qrScans.scannedAt)],
      limit: limit,
    });

    const recentVenueScans = await db.query.venueScans.findMany({
      where: gte(venueScans.scannedAt, today),
      with: {
        venue: true,
        staff: true,
        student: true,
      },
      orderBy: [desc(venueScans.scannedAt)],
      limit: limit,
    });

    const combined: CombinedScan[] = [];

    for (const scan of recentQRScans) {
      combined.push({
        id: scan.id,
        studentId: scan.studentId,
        scanType: scan.scanType,
        scannedAt: scan.scannedAt,
        location: scan.location,
        forced: scan.forced,
        source: "vehicle",
        driver: scan.driver ? { id: scan.driver.id, name: scan.driver.driverName } : null,
        vehicle: scan.vehicle ? { id: scan.vehicle.id, busNumber: scan.vehicle.busNumber } : null,
        shift: scan.shift ? { id: scan.shift.id, title: scan.shift.shiftTitle } : null,
      });
    }

    for (const scan of recentVenueScans) {
      combined.push({
        id: scan.id,
        studentId: scan.studentId,
        scanType: scan.scanType === "In" ? "Check In" : "Check Out",
        scannedAt: scan.scannedAt,
        location: scan.location,
        forced: scan.forced,
        source: "venue",
        venue: scan.venue ? { id: scan.venue.id, name: scan.venue.name } : null,
        staff: scan.staff ? { id: scan.staff.id, name: scan.staff.name } : null,
      });
    }

    combined.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());

    return combined.slice(0, limit);
  }
}

export const storage = new DbStorage();
