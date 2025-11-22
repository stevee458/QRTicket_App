import { db } from "../db";
import { parents, students, qrCodeHistory, qrScans, vehicles, shifts, drivers, type InsertParent, type Parent, type InsertStudent, type Student, type QRCodeHistory, type InsertQRCodeHistory, type InsertQRScan, type QRScan, type InsertVehicle, type Vehicle, type InsertShift, type Shift, type InsertDriver, type Driver } from "@shared/schema";
import { eq, ilike, desc, and, gte } from "drizzle-orm";

export type StudentStatus = "Not Boarded" | "Boarded" | "Alighted";

export type StudentWithQR = Student & { qrCode?: string; qrCodeCreatedAt?: Date; status?: StudentStatus };

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
  
  getStudentStatus(studentId: string): Promise<StudentStatus>;
  
  createVehicle(data: InsertVehicle): Promise<Vehicle>;
  
  searchVehicles(searchTerm: string): Promise<Vehicle[]>;
  
  updateVehicle(vehicleId: string, data: Partial<InsertVehicle>): Promise<Vehicle>;
  
  deleteVehicle(vehicleId: string): Promise<void>;
  
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
          age: student.age,
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
        age: result.age,
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
        age: result.age,
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

  async getStudentStatus(studentId: string): Promise<StudentStatus> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayScans = await db.query.qrScans.findMany({
      where: and(
        eq(qrScans.studentId, studentId),
        gte(qrScans.scannedAt, today)
      ),
      orderBy: [desc(qrScans.scannedAt)],
    });

    if (todayScans.length === 0) {
      return "Not Boarded";
    }

    const lastScan = todayScans[0];
    
    if (lastScan.scanType === "On") {
      return "Boarded";
    }

    if (lastScan.scanType === "Off") {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      if (lastScan.scannedAt > fifteenMinutesAgo) {
        return "Alighted";
      } else {
        return "Not Boarded";
      }
    }

    return "Not Boarded";
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
        createdAt: parentRecord.createdAt,
      },
      students: parentRecord.students.map((student) => ({
        id: student.id,
        name: student.name,
        phone: student.phone,
        email: student.email,
        age: student.age,
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
        age: result.age,
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
      const status = await this.getStudentStatus(studentId);

      return {
        ...validation.student,
        qrCode: activeQR?.qrCodeData,
        qrCodeCreatedAt: activeQR?.createdAt,
        status,
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
        const status = await this.getStudentStatus(student.id);
        return {
          ...student,
          qrCode: activeQR?.qrCodeData,
          qrCodeCreatedAt: activeQR?.createdAt,
          status,
        };
      })
    );

    return studentsWithQR;
  }
}

export const storage = new DbStorage();
