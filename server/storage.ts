import { db } from "../db";
import { parents, students, qrCodeHistory, type InsertParent, type Parent, type InsertStudent, type Student, type QRCodeHistory, type InsertQRCodeHistory } from "@shared/schema";
import { eq, ilike, desc, and } from "drizzle-orm";

export type StudentWithQR = Student & { qrCode?: string; qrCodeCreatedAt?: Date };

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
}

export const storage = new DbStorage();
