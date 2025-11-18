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

      const studentsWithQRCodes = await Promise.all(
        data.students.map(async (student) => {
          const studentId = `STU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const qrData = JSON.stringify({
            studentId,
            name: student.name,
            school: student.school,
          });
          
          const qrCode = await QRCode.toDataURL(qrData, {
            width: 200,
            margin: 2,
          });

          return {
            name: student.name,
            phone: student.phone,
            email: student.email,
            age: student.age,
            school: student.school,
            qrCode,
          };
        })
      );

      const result = await storage.createRegistration(parentData, studentsWithQRCodes);

      res.json({
        success: true,
        data: {
          parent: result.parent,
          students: result.students,
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

  const httpServer = createServer(app);
  return httpServer;
}
