import { db } from "../db";
import { parents, students, type InsertParent, type Parent, type InsertStudent, type Student } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  createRegistration(
    parentData: InsertParent,
    studentsData: Array<InsertStudent>
  ): Promise<{ parent: Parent; students: Student[] }>;
  
  getParentWithStudents(parentId: string): Promise<{ parent: Parent; students: Student[] } | null>;
  
  updateStudentQRCode(studentId: string, qrCode: string): Promise<void>;
}

export class DbStorage implements IStorage {
  async createRegistration(
    parentData: InsertParent,
    studentsData: Array<InsertStudent>
  ): Promise<{ parent: Parent; students: Student[] }> {
    return await db.transaction(async (tx) => {
      const [parent] = await tx.insert(parents).values(parentData).returning();
      
      const studentRecords = await tx
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
    });
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
}

export const storage = new DbStorage();
