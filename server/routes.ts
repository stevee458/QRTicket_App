import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertParentSchema, insertStudentSchema, insertQRScanSchema } from "@shared/schema";
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
          const qrRecord = await storage.createQRCode(student.id, "");

          const qrData = JSON.stringify({
            studentId: student.id,
            name: student.name,
            school: student.school,
            version: qrRecord.version,
          });
          
          const qrCodeData = await QRCode.toDataURL(qrData, {
            width: 200,
            margin: 2,
          });

          await storage.updateQRCodeData(qrRecord.id, qrCodeData);

          return {
            ...student,
            qrCode: qrCodeData,
            qrCodeCreatedAt: qrRecord.createdAt,
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

      const qrRecord = await storage.regenerateQRCode(studentData.student.id, "");

      const qrData = JSON.stringify({
        studentId: studentData.student.id,
        name: studentData.student.name,
        school: studentData.student.school,
        version: qrRecord.version,
      });
      
      const qrCodeData = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
      });

      await storage.updateQRCodeData(qrRecord.id, qrCodeData);

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

  app.delete("/api/parents/:id", async (req, res) => {
    try {
      await storage.deleteParent(req.params.id);
      
      res.json({
        success: true,
        message: "Parent and associated students deleted successfully",
      });
    } catch (error) {
      console.error("Delete parent error:", error);
      if (error instanceof Error && error.message === "Parent not found") {
        res.status(404).json({
          success: false,
          error: "Parent not found",
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to delete parent",
        });
      }
    }
  });

  app.delete("/api/students/:id", async (req, res) => {
    try {
      const result = await storage.deleteStudent(req.params.id);
      
      res.json({
        success: true,
        message: result.deletedParent 
          ? "Student and parent deleted successfully" 
          : "Student deleted successfully",
        deletedParent: result.deletedParent,
      });
    } catch (error) {
      console.error("Delete student error:", error);
      if (error instanceof Error && error.message === "Student not found") {
        res.status(404).json({
          success: false,
          error: "Student not found",
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to delete student",
        });
      }
    }
  });

  app.get("/api/students/:id/siblings-count", async (req, res) => {
    try {
      const count = await storage.countSiblings(req.params.id);
      
      res.json({
        success: true,
        count,
      });
    } catch (error) {
      console.error("Count siblings error:", error);
      if (error instanceof Error && error.message === "Student not found") {
        res.status(404).json({
          success: false,
          error: "Student not found",
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to count siblings",
        });
      }
    }
  });

  app.post("/api/qr/validate", async (req, res) => {
    try {
      const { studentId, version } = req.body;

      if (!studentId || version === undefined) {
        res.status(400).json({
          success: false,
          error: "studentId and version are required",
        });
        return;
      }

      const result = await storage.validateQRCode(studentId, version);

      if (!result.valid) {
        res.json({
          success: false,
          valid: false,
          message: "Invalid or expired QR code",
        });
        return;
      }

      res.json({
        success: true,
        valid: true,
        student: result.student,
        message: "QR code validated successfully",
      });
    } catch (error) {
      console.error("Validate QR code error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to validate QR code",
      });
    }
  });

  app.post("/api/scans", async (req, res) => {
    try {
      const scanData = insertQRScanSchema.parse(req.body);
      const scan = await storage.recordScan(scanData);

      res.json({
        success: true,
        data: scan,
      });
    } catch (error) {
      console.error("Record scan error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to record scan",
        });
      }
    }
  });

  app.get("/api/students/:id/status", async (req, res) => {
    try {
      const status = await storage.getStudentStatus(req.params.id);

      res.json({
        success: true,
        status,
      });
    } catch (error) {
      console.error("Get student status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get student status",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
