import { db } from "../db";
import { parents, students, type InsertParent, type Parent, type InsertStudent, type Student } from "@shared/schema";
import { eq, ilike } from "drizzle-orm";

export interface IStorage {
  createRegistration(
    parentData: InsertParent,
    studentsData: Array<InsertStudent>
  ): Promise<{ parent: Parent; students: Student[] }>;
  
  getParentWithStudents(parentId: string): Promise<{ parent: Parent; students: Student[] } | null>;
  
  searchParents(searchTerm: string): Promise<Array<{ parent: Parent; students: Student[] }>>;
  
  searchStudents(searchTerm: string): Promise<Array<{ student: Student; parent: Parent }>>;
  
  getStudentWithParent(studentId: string): Promise<{ student: Student; parent: Parent } | null>;
  
  updateParent(parentId: string, data: Partial<InsertParent>): Promise<Parent>;
  
  updateStudent(studentId: string, data: Partial<InsertStudent>): Promise<Student>;
  
  updateStudentQRCode(studentId: string, qrCode: string): Promise<void>;
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
          qrCode: "",
          parentId: parent.id,
        }))
      )
      .returning();

    return { parent, students: studentRecords };
  }

  async updateStudentQRCode(studentId: string, qrCode: string): Promise<void> {
    await db
      .update(students)
      .set({ qrCode })
      .where(eq(students.id, studentId));
  }

  async getParentWithStudents(parentId: string): Promise<{ parent: Parent; students: Student[] } | null> {
    const parent = await db.query.parents.findFirst({
      where: eq(parents.id, parentId),
      with: {
        students: true,
      },
    });

    if (!parent) {
      return null;
    }

    return {
      parent: {
        id: parent.id,
        name: parent.name,
        idNumber: parent.idNumber,
        phone: parent.phone,
        email: parent.email,
        createdAt: parent.createdAt,
      },
      students: parent.students,
    };
  }

  async searchParents(searchTerm: string): Promise<Array<{ parent: Parent; students: Student[] }>> {
    const results = await db.query.parents.findMany({
      where: ilike(parents.name, `%${searchTerm}%`),
      with: {
        students: true,
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
      students: result.students,
    }));
  }

  async searchStudents(searchTerm: string): Promise<Array<{ student: Student; parent: Parent }>> {
    const results = await db.query.students.findMany({
      where: ilike(students.name, `%${searchTerm}%`),
      with: {
        parent: true,
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
        qrCode: result.qrCode,
        qrCodeVersion: result.qrCodeVersion,
        parentId: result.parentId,
        createdAt: result.createdAt,
      },
      parent: result.parent,
    }));
  }

  async getStudentWithParent(studentId: string): Promise<{ student: Student; parent: Parent } | null> {
    const result = await db.query.students.findFirst({
      where: eq(students.id, studentId),
      with: {
        parent: true,
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
        qrCode: result.qrCode,
        qrCodeVersion: result.qrCodeVersion,
        parentId: result.parentId,
        createdAt: result.createdAt,
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
