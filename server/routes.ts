import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertParentSchema, insertStudentSchema, insertQRScanSchema, insertVehicleSchema, insertShiftSchema, insertDriverSchema } from "@shared/schema";
import { z } from "zod";
import QRCode from "qrcode";

const registrationSchema = z.object({
  parentName: z.string().min(1),
  parentId: z.string().min(1),
  parentPhone: z.string().min(10),
  parentEmail: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(6),
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
        username: data.username,
        password: data.password,
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

      const results = searchTerm.toUpperCase() === "ALL" 
        ? await storage.getAllParents()
        : await storage.searchParents(searchTerm);
      
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

      const results = searchTerm.toUpperCase() === "ALL" 
        ? await storage.getAllStudents()
        : await storage.searchStudents(searchTerm);
      
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
      const statusData = await storage.getStudentStatus(req.params.id);

      res.json({
        success: true,
        ...statusData,
      });
    } catch (error) {
      console.error("Get student status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get student status",
      });
    }
  });

  app.post("/api/vehicles", async (req, res) => {
    try {
      const vehicleData = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(vehicleData);

      res.json({
        success: true,
        data: vehicle,
      });
    } catch (error) {
      console.error("Create vehicle error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to create vehicle",
        });
      }
    }
  });

  app.get("/api/search/vehicles", async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      
      if (!searchTerm) {
        res.status(400).json({
          success: false,
          error: "Search term is required",
        });
        return;
      }

      const results = searchTerm.toUpperCase() === "ALL" 
        ? await storage.getAllVehicles()
        : await storage.searchVehicles(searchTerm);
      
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Search vehicles error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search vehicles",
      });
    }
  });

  app.put("/api/vehicles/:id", async (req, res) => {
    try {
      const updateData = insertVehicleSchema.partial().parse(req.body);
      const updated = await storage.updateVehicle(req.params.id, updateData);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error("Update vehicle error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to update vehicle",
        });
      }
    }
  });

  app.delete("/api/vehicles/:id", async (req, res) => {
    try {
      await storage.deleteVehicle(req.params.id);
      
      res.json({
        success: true,
        message: "Vehicle deleted successfully",
      });
    } catch (error) {
      console.error("Delete vehicle error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete vehicle",
      });
    }
  });

  app.post("/api/shifts", async (req, res) => {
    try {
      const shiftData = insertShiftSchema.parse(req.body);
      const shift = await storage.createShift(shiftData);

      res.json({
        success: true,
        data: shift,
      });
    } catch (error) {
      console.error("Create shift error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to create shift",
        });
      }
    }
  });

  app.get("/api/search/shifts", async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      
      if (!searchTerm) {
        res.status(400).json({
          success: false,
          error: "Search term is required",
        });
        return;
      }

      const results = searchTerm.toUpperCase() === "ALL" 
        ? await storage.getAllShifts()
        : await storage.searchShifts(searchTerm);
      
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Search shifts error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search shifts",
      });
    }
  });

  app.put("/api/shifts/:id", async (req, res) => {
    try {
      const updateData = insertShiftSchema.partial().parse(req.body);
      const updated = await storage.updateShift(req.params.id, updateData);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error("Update shift error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to update shift",
        });
      }
    }
  });

  app.delete("/api/shifts/:id", async (req, res) => {
    try {
      await storage.deleteShift(req.params.id);
      
      res.json({
        success: true,
        message: "Shift deleted successfully",
      });
    } catch (error) {
      console.error("Delete shift error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete shift",
      });
    }
  });

  app.post("/api/drivers", async (req, res) => {
    try {
      const driverData = insertDriverSchema.parse(req.body);
      const driver = await storage.createDriver(driverData);

      res.json({
        success: true,
        data: driver,
      });
    } catch (error) {
      console.error("Create driver error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to create driver",
        });
      }
    }
  });

  app.get("/api/search/drivers", async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      
      if (!searchTerm) {
        res.status(400).json({
          success: false,
          error: "Search term is required",
        });
        return;
      }

      const results = searchTerm.toUpperCase() === "ALL" 
        ? await storage.getAllDrivers()
        : await storage.searchDrivers(searchTerm);
      
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Search drivers error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search drivers",
      });
    }
  });

  app.put("/api/drivers/:id", async (req, res) => {
    try {
      const updateData = insertDriverSchema.partial().parse(req.body);
      const updated = await storage.updateDriver(req.params.id, updateData);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error("Update driver error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to update driver",
        });
      }
    }
  });

  app.delete("/api/drivers/:id", async (req, res) => {
    try {
      await storage.deleteDriver(req.params.id);
      
      res.json({
        success: true,
        message: "Driver deleted successfully",
      });
    } catch (error) {
      console.error("Delete driver error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete driver",
      });
    }
  });

  app.post("/api/driver/login", async (req, res) => {
    try {
      const { driverName, companyNumber } = req.body;
      
      if (!driverName || !companyNumber) {
        res.status(400).json({
          success: false,
          error: "Driver name and company number are required",
        });
        return;
      }

      const driver = await storage.validateDriver(driverName, companyNumber);
      
      if (!driver) {
        res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
        return;
      }

      res.json({
        success: true,
        data: driver,
      });
    } catch (error) {
      console.error("Driver login error:", error);
      res.status(500).json({
        success: false,
        error: "Login failed",
      });
    }
  });

  app.get("/api/driver/vehicles", async (req, res) => {
    try {
      const vehicles = await storage.getAllVehicles();
      
      res.json({
        success: true,
        data: vehicles,
      });
    } catch (error) {
      console.error("Get vehicles error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch vehicles",
      });
    }
  });

  app.get("/api/driver/shifts", async (req, res) => {
    try {
      const shifts = await storage.getAllShifts();
      
      res.json({
        success: true,
        data: shifts,
      });
    } catch (error) {
      console.error("Get shifts error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch shifts",
      });
    }
  });

  app.post("/api/driver/scan", async (req, res) => {
    try {
      const scanData = insertQRScanSchema.parse(req.body);
      
      const scan = await storage.createQRScan(scanData);
      
      res.json({
        success: true,
        data: scan,
      });
    } catch (error) {
      console.error("Create scan error:", error);
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

  app.get("/api/driver/student/qr/:qrData", async (req, res) => {
    try {
      const qrData = decodeURIComponent(req.params.qrData);
      const student = await storage.getStudentByQRCode(qrData);
      
      if (!student) {
        res.status(404).json({
          success: false,
          error: "Student not found",
        });
        return;
      }

      res.json({
        success: true,
        data: student,
      });
    } catch (error) {
      console.error("Get student by QR error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch student",
      });
    }
  });

  app.get("/api/driver/onboard/:driverId/:vehicleId/:shiftId", async (req, res) => {
    try {
      const { driverId, vehicleId, shiftId } = req.params;
      const students = await storage.getOnboardStudents(driverId, vehicleId, shiftId);
      
      res.json({
        success: true,
        data: students,
      });
    } catch (error) {
      console.error("Get onboard students error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch onboard students",
      });
    }
  });

  app.post("/api/parent/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: "Username and password are required",
        });
        return;
      }

      const parent = await storage.authenticateParent(username, password);

      if (!parent) {
        res.status(401).json({
          success: false,
          error: "Invalid username or password",
        });
        return;
      }

      req.session.parentId = parent.id;
      console.log(`[LOGIN DEBUG] Setting parentId in session: ${parent.id}`);
      console.log(`[LOGIN DEBUG] Session ID before save: ${req.sessionID}`);

      req.session.save((err) => {
        if (err) {
          console.error("[LOGIN DEBUG] Session save error:", err);
          res.status(500).json({
            success: false,
            error: "Failed to save session",
          });
          return;
        }

        console.log(`[LOGIN DEBUG] Session saved successfully. Session ID: ${req.sessionID}`);
        console.log(`[LOGIN DEBUG] Session data after save:`, req.session);
        console.log(`[LOGIN DEBUG] Set-Cookie header:`, res.getHeader('Set-Cookie'));

        res.json({
          success: true,
          data: {
            id: parent.id,
            name: parent.name,
            email: parent.email,
          },
        });
      });
    } catch (error) {
      console.error("Parent login error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to login",
      });
    }
  });

  app.post("/api/parent/logout", async (req, res) => {
    try {
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
          res.status(500).json({
            success: false,
            error: "Failed to logout",
          });
          return;
        }

        res.json({
          success: true,
        });
      });
    } catch (error) {
      console.error("Parent logout error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to logout",
      });
    }
  });

  app.get("/api/parent/session", async (req, res) => {
    try {
      if (!req.session.parentId) {
        res.status(401).json({
          success: false,
          error: "Not authenticated",
        });
        return;
      }

      const parent = await storage.getParentById(req.session.parentId);

      if (!parent) {
        res.status(401).json({
          success: false,
          error: "Parent not found",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: parent.id,
          name: parent.name,
          email: parent.email,
        },
      });
    } catch (error) {
      console.error("Get parent session error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get session",
      });
    }
  });

  app.get("/api/parent/students", async (req, res) => {
    try {
      if (!req.session.parentId) {
        res.status(401).json({
          success: false,
          error: "Not authenticated",
        });
        return;
      }

      const result = await storage.getParentWithStudents(req.session.parentId);

      if (!result) {
        res.status(404).json({
          success: false,
          error: "Parent not found",
        });
        return;
      }

      res.json({
        success: true,
        data: result.students,
      });
    } catch (error) {
      console.error("Get parent students error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch students",
      });
    }
  });

  app.get("/api/parent/student/:studentId/scans", async (req, res) => {
    try {
      if (!req.session.parentId) {
        res.status(401).json({
          success: false,
          error: "Not authenticated",
        });
        return;
      }

      const student = await storage.getStudentWithParent(req.params.studentId);

      if (!student || student.parent.id !== req.session.parentId) {
        res.status(403).json({
          success: false,
          error: "Access denied",
        });
        return;
      }

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const scans = await storage.getStudentScans(req.params.studentId, startDate, endDate);

      res.json({
        success: true,
        data: scans,
      });
    } catch (error) {
      console.error("Get student scans error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch scans",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
