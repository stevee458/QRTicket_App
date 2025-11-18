import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertParentSchema, insertStudentSchema } from "@shared/schema";
import { z } from "zod";
import QRCode from "qrcode";

const registrationSchema = z.object({
  parentName: z.string().min(1),
  parentId: z.string().min(1),
  parentPhone: z.string().min(10),
  parentEmail: z.string().email(),
  students: z.array(
    z.object({
      name: z.string().min(1),
      phone: z.string().min(10),
      email: z.string().email(),
      age: z.string().transform((val) => parseInt(val, 10)),
      school: z.string().min(1),
    })
  ).min(1),
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/register", async (req, res) => {
    try {
      const data = registrationSchema.parse(req.body);

      const parentData = {
        name: data.parentName,
        idNumber: data.parentId,
        phone: data.parentPhone,
        email: data.parentEmail,
      };

      const studentsData = data.students.map((student) => ({
        name: student.name,
        phone: student.phone,
        email: student.email,
        age: student.age,
        school: student.school,
      }));

      const result = await storage.createRegistration(parentData, studentsData);

      const studentsWithQRCodes = await Promise.all(
        result.students.map(async (student) => {
          const qrData = JSON.stringify({
            studentId: student.id,
            name: student.name,
            school: student.school,
          });
          
          const qrCode = await QRCode.toDataURL(qrData, {
            width: 200,
            margin: 2,
          });

          await storage.updateStudentQRCode(student.id, qrCode);

          return {
            ...student,
            qrCode,
          };
        })
      );

      res.json({
        success: true,
        data: {
          parent: result.parent,
          students: studentsWithQRCodes,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Registration failed",
        });
      }
    }
  });

  app.get("/api/parent/:id", async (req, res) => {
    try {
      const result = await storage.getParentWithStudents(req.params.id);
      
      if (!result) {
        res.status(404).json({
          success: false,
          error: "Parent not found",
        });
        return;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Fetch parent error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch parent data",
      });
    }
  });

  app.get("/api/search/parents", async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      
      if (!searchTerm) {
        res.status(400).json({
          success: false,
          error: "Search term is required",
        });
        return;
      }

      const results = await storage.searchParents(searchTerm);
      
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Search parents error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search parents",
      });
    }
  });

  app.get("/api/search/students", async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      
      if (!searchTerm) {
        res.status(400).json({
          success: false,
          error: "Search term is required",
        });
        return;
      }

      const results = await storage.searchStudents(searchTerm);
      
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Search students error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search students",
      });
    }
  });

  app.put("/api/parent/:id", async (req, res) => {
    try {
      const updateData = insertParentSchema.partial().parse(req.body);
      const updated = await storage.updateParent(req.params.id, updateData);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error("Update parent error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to update parent",
        });
      }
    }
  });

  app.put("/api/student/:id", async (req, res) => {
    try {
      const updateData = insertStudentSchema.partial().parse(req.body);
      const updated = await storage.updateStudent(req.params.id, updateData);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error("Update student error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to update student",
        });
      }
    }
  });

  app.post("/api/student/:id/regenerate-qr", async (req, res) => {
    try {
      const studentData = await storage.getStudentWithParent(req.params.id);
      
      if (!studentData) {
        res.status(404).json({
          success: false,
          error: "Student not found",
        });
        return;
      }

      const qrData = JSON.stringify({
        studentId: studentData.student.id,
        name: studentData.student.name,
        school: studentData.student.school,
      });
      
      const qrCode = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
      });

      await storage.updateStudentQRCode(studentData.student.id, qrCode);

      const updatedStudent = await storage.getStudentWithParent(req.params.id);

      res.json({
        success: true,
        data: updatedStudent,
      });
    } catch (error) {
      console.error("Regenerate QR code error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to regenerate QR code",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
