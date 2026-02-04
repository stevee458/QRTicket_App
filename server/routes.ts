import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertParentSchema, insertStudentSchema, insertQRScanSchema, insertVehicleSchema, insertShiftSchema, insertDriverSchema, insertVehicleDocumentSchema, insertVenueSchema, insertVenueStaffSchema, insertVenueScanSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import { z } from "zod";
import QRCode from "qrcode";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

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
      dateOfBirth: z.string().min(1),
      school: z.string().min(1),
      specialNeeds: z.string().optional(),
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
        dateOfBirth: student.dateOfBirth,
        school: student.school,
        specialNeeds: student.specialNeeds || null,
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

  app.get("/api/students/:id/qr-version", async (req, res) => {
    try {
      const versionData = await storage.getActiveQRVersion(req.params.id);

      res.json({
        success: true,
        data: versionData,
      });
    } catch (error) {
      console.error("Get QR version error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get QR version",
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

  app.get("/api/search/venues", async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      
      if (!searchTerm) {
        res.status(400).json({
          success: false,
          error: "Search term is required",
        });
        return;
      }

      const allVenues = await storage.getAllVenues();
      
      let results;
      if (searchTerm.toUpperCase() === "ALL") {
        results = allVenues;
      } else {
        const lowerSearch = searchTerm.toLowerCase();
        results = allVenues.filter(venue => 
          venue.name.toLowerCase().includes(lowerSearch) ||
          (venue.locationDescription && venue.locationDescription.toLowerCase().includes(lowerSearch))
        );
      }
      
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Search venues error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search venues",
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

  app.get("/api/vehicles/:id", async (req, res) => {
    try {
      const result = await storage.getVehicleWithDocuments(req.params.id);
      
      if (!result) {
        res.status(404).json({
          success: false,
          error: "Vehicle not found",
        });
        return;
      }
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Get vehicle error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get vehicle",
      });
    }
  });

  app.post("/api/vehicles/:id/documents", async (req, res) => {
    try {
      const documentData = insertVehicleDocumentSchema.parse({
        vehicleId: req.params.id,
        ...req.body,
      });
      const document = await storage.createVehicleDocument(documentData);
      
      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      console.error("Create vehicle document error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to create vehicle document",
        });
      }
    }
  });

  app.delete("/api/vehicles/:vehicleId/documents/:documentId", async (req, res) => {
    try {
      await storage.deleteVehicleDocument(req.params.documentId);
      
      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error) {
      console.error("Delete vehicle document error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete document",
      });
    }
  });

  app.get("/api/drivers/:id", async (req, res) => {
    try {
      const driver = await storage.getDriverById(req.params.id);
      
      if (!driver) {
        res.status(404).json({
          success: false,
          error: "Driver not found",
        });
        return;
      }
      
      res.json({
        success: true,
        data: driver,
      });
    } catch (error) {
      console.error("Get driver error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get driver",
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

  app.post("/api/venues", async (req, res) => {
    try {
      const venueData = insertVenueSchema.parse(req.body);
      const venue = await storage.createVenue(venueData);

      res.json({
        success: true,
        data: venue,
      });
    } catch (error) {
      console.error("Create venue error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to create venue",
        });
      }
    }
  });

  app.get("/api/venues", async (req, res) => {
    try {
      const venues = await storage.getAllVenues();
      
      res.json({
        success: true,
        data: venues,
      });
    } catch (error) {
      console.error("Get venues error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch venues",
      });
    }
  });

  app.get("/api/venues/:id", async (req, res) => {
    try {
      const venue = await storage.getVenueById(req.params.id);
      
      if (!venue) {
        res.status(404).json({
          success: false,
          error: "Venue not found",
        });
        return;
      }
      
      res.json({
        success: true,
        data: venue,
      });
    } catch (error) {
      console.error("Get venue error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch venue",
      });
    }
  });

  app.get("/api/venues/:id/staff", async (req, res) => {
    try {
      const result = await storage.getVenueWithStaff(req.params.id);
      
      if (!result) {
        res.status(404).json({
          success: false,
          error: "Venue not found",
        });
        return;
      }
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Get venue with staff error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch venue with staff",
      });
    }
  });

  app.put("/api/venues/:id", async (req, res) => {
    try {
      const updateData = insertVenueSchema.partial().parse(req.body);
      const updated = await storage.updateVenue(req.params.id, updateData);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error("Update venue error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to update venue",
        });
      }
    }
  });

  app.delete("/api/venues/:id", async (req, res) => {
    try {
      await storage.deleteVenue(req.params.id);
      
      res.json({
        success: true,
        message: "Venue deleted successfully",
      });
    } catch (error) {
      console.error("Delete venue error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete venue",
      });
    }
  });

  app.post("/api/venues/:venueId/staff", async (req, res) => {
    try {
      const staffData = insertVenueStaffSchema.parse({
        venueId: req.params.venueId,
        ...req.body,
      });
      const staff = await storage.createVenueStaff(staffData);
      
      res.json({
        success: true,
        data: staff,
      });
    } catch (error) {
      console.error("Create venue staff error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to create venue staff",
        });
      }
    }
  });

  app.put("/api/venue-staff/:id", async (req, res) => {
    try {
      const updateData = insertVenueStaffSchema.partial().parse(req.body);
      const updated = await storage.updateVenueStaff(req.params.id, updateData);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error("Update venue staff error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to update venue staff",
        });
      }
    }
  });

  app.delete("/api/venue-staff/:id", async (req, res) => {
    try {
      await storage.deleteVenueStaff(req.params.id);
      
      res.json({
        success: true,
        message: "Venue staff deleted successfully",
      });
    } catch (error) {
      console.error("Delete venue staff error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete venue staff",
      });
    }
  });

  app.post("/api/venue/login", async (req, res) => {
    try {
      const { name, password } = req.body;

      if (!name || !password) {
        res.status(400).json({
          success: false,
          error: "Name and password are required",
        });
        return;
      }

      const result = await storage.authenticateVenueStaff(name, password);

      if (!result) {
        res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
        return;
      }

      (req.session as any).staffId = result.staff.id;
      (req.session as any).venueId = result.venue.id;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          res.status(500).json({
            success: false,
            error: "Failed to save session",
          });
          return;
        }

        res.json({
          success: true,
          data: {
            staff: {
              id: result.staff.id,
              name: result.staff.name,
            },
            venue: {
              id: result.venue.id,
              name: result.venue.name,
            },
          },
        });
      });
    } catch (error) {
      console.error("Venue login error:", error);
      res.status(500).json({
        success: false,
        error: "Login failed",
      });
    }
  });

  app.post("/api/venue/logout", async (req, res) => {
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

        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    } catch (error) {
      console.error("Venue logout error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to logout",
      });
    }
  });

  app.get("/api/venue/session", async (req, res) => {
    try {
      const staffId = (req.session as any).staffId;
      const venueId = (req.session as any).venueId;
      
      if (!staffId || !venueId) {
        res.status(401).json({
          success: false,
          error: "Not authenticated",
        });
        return;
      }

      const staff = await storage.getVenueStaffById(staffId);
      const venue = await storage.getVenueById(venueId);

      if (!staff || !venue) {
        res.status(401).json({
          success: false,
          error: "Session invalid",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          staff: {
            id: staff.id,
            name: staff.name,
          },
          venue: {
            id: venue.id,
            name: venue.name,
          },
        },
      });
    } catch (error) {
      console.error("Get venue session error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get session",
      });
    }
  });

  app.post("/api/venue-scans", async (req, res) => {
    try {
      const { venueId, staffId, studentId, scanType, location, locationConfirmed, forced } = req.body;

      if (!venueId || !studentId || !scanType) {
        res.status(400).json({
          success: false,
          error: "venueId, studentId, and scanType are required",
        });
        return;
      }

      const studentExists = await storage.getStudentWithParent(studentId);
      if (!studentExists) {
        res.status(404).json({
          success: false,
          error: "STUDENT_NOT_FOUND",
          message: "This QR code belongs to a student that no longer exists in the system. Please use an updated QR code.",
        });
        return;
      }

      // If checking in (In), release from any previous location first
      if (scanType === "In") {
        const scanTime = req.body.scannedAt ? new Date(req.body.scannedAt) : new Date();
        await storage.releaseStudentFromPreviousLocation(
          studentId, 
          scanTime, 
          "Auto-released: Student scanned at new location"
        );
      }

      const scan = await storage.createVenueScan({
        venueId,
        staffId,
        studentId,
        scanType,
        location,
        locationConfirmed: locationConfirmed || false,
        forced: forced || false,
        synced: true,
      });

      res.json({
        success: true,
        data: scan,
      });
    } catch (error) {
      console.error("Create venue scan error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create venue scan",
      });
    }
  });

  app.get("/api/venue/at-venue/:venueId", async (req, res) => {
    try {
      const venueId = req.params.venueId;

      if (!venueId) {
        res.status(400).json({
          success: false,
          error: "Venue ID is required",
        });
        return;
      }

      const studentsAtVenue = await storage.getStudentsAtVenue(venueId);

      res.json({
        success: true,
        data: studentsAtVenue.map(item => item.student),
      });
    } catch (error) {
      console.error("Get students at venue error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get students at venue",
      });
    }
  });

  app.get("/api/venue/at-venue", async (req, res) => {
    try {
      const venueId = (req.session as any).venueId;

      if (!venueId) {
        res.status(401).json({
          success: false,
          error: "Not authenticated",
        });
        return;
      }

      const studentsAtVenue = await storage.getStudentsAtVenue(venueId);

      res.json({
        success: true,
        data: studentsAtVenue.map(item => item.student),
      });
    } catch (error) {
      console.error("Get students at venue error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get students at venue",
      });
    }
  });

  app.get("/api/students/:id/venue-status", async (req, res) => {
    try {
      const venueStatus = await storage.getStudentVenueStatus(req.params.id);

      res.json({
        success: true,
        data: venueStatus,
      });
    } catch (error) {
      console.error("Get student venue status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get student venue status",
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
      
      const studentExists = await storage.getStudentWithParent(scanData.studentId);
      if (!studentExists) {
        res.status(404).json({
          success: false,
          error: "STUDENT_NOT_FOUND",
          message: "This QR code belongs to a student that no longer exists in the system. Please use an updated QR code.",
        });
        return;
      }
      
      // If boarding (On), release from any previous location first
      if (scanData.scanType === "On") {
        const scanTime = req.body.scannedAt ? new Date(req.body.scannedAt) : new Date();
        await storage.releaseStudentFromPreviousLocation(
          scanData.studentId, 
          scanTime, 
          "Auto-released: Student scanned at new location"
        );
      }
      
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

  app.post("/api/driver/end-shift", async (req, res) => {
    try {
      const { driverId, vehicleId, shiftId, location } = req.body;

      if (!driverId || !vehicleId || !shiftId) {
        res.status(400).json({
          success: false,
          error: "driverId, vehicleId, and shiftId are required",
        });
        return;
      }

      const onboardStudents = await storage.getOnboardStudents(driverId, vehicleId, shiftId);

      const forceAlightedStudents: Array<{ studentId: string; studentName: string }> = [];

      for (const student of onboardStudents) {
        await storage.createQRScan({
          studentId: student.id,
          driverId,
          vehicleId,
          shiftId,
          scanType: "Off",
          location: location || "Shift ended by driver",
          forced: true,
          forceReason: "Driver ended shift",
          synced: true,
        });
        forceAlightedStudents.push({ studentId: student.id, studentName: student.name });
      }

      res.json({
        success: true,
        data: {
          forceAlightedCount: forceAlightedStudents.length,
          forceAlightedStudents,
        },
      });
    } catch (error) {
      console.error("End shift error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to end shift",
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

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          res.status(500).json({
            success: false,
            error: "Failed to save session",
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

      const scans = await storage.getStudentAllScans(req.params.studentId, startDate, endDate);

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

  // Special Needs Access Logs - MUST be before /api/parent/:id to avoid route conflict
  app.get("/api/parent/access-logs", async (req, res) => {
    try {
      const parentId = req.session.parentId;
      if (!parentId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const logs = await storage.getSpecialNeedsAccessLogs(parentId);
      res.json({ success: true, data: logs });
    } catch (error) {
      console.error("Get access logs error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch access logs" });
    }
  });

  app.get("/api/parent/access-logs/unacknowledged-count", async (req, res) => {
    try {
      const parentId = req.session.parentId;
      if (!parentId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const count = await storage.getUnacknowledgedAccessCount(parentId);
      res.json({ success: true, data: { count } });
    } catch (error) {
      console.error("Get unacknowledged count error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch count" });
    }
  });

  app.post("/api/parent/access-logs/acknowledge", async (req, res) => {
    try {
      const parentId = req.session.parentId;
      if (!parentId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const { logIds } = req.body;
      if (!Array.isArray(logIds)) {
        res.status(400).json({ success: false, error: "logIds must be an array" });
        return;
      }

      await storage.acknowledgeSpecialNeedsAccess(logIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Acknowledge access logs error:", error);
      res.status(500).json({ success: false, error: "Failed to acknowledge logs" });
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

  // Admin Authentication Routes
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: "Username and password are required",
        });
        return;
      }

      const admin = await storage.authenticateAdmin(username, password);

      if (!admin) {
        res.status(401).json({
          success: false,
          error: "Invalid username or password",
        });
        return;
      }

      req.session.adminId = admin.id;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          res.status(500).json({
            success: false,
            error: "Failed to save session",
          });
          return;
        }

        res.json({
          success: true,
          data: {
            id: admin.id,
            username: admin.username,
          },
        });
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({
        success: false,
        error: "Login failed",
      });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
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

        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    } catch (error) {
      console.error("Admin logout error:", error);
      res.status(500).json({
        success: false,
        error: "Logout failed",
      });
    }
  });

  // Admin force-release a student from their current location
  app.post("/api/admin/force-release/:studentId", async (req, res) => {
    try {
      const adminId = req.session.adminId;
      if (!adminId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const { studentId } = req.params;
      const { reason } = req.body;

      // Get student's current active location
      const activeLocation = await storage.getStudentActiveLocation(studentId);
      
      if (!activeLocation) {
        res.status(400).json({
          success: false,
          error: "Student is not currently at any active location",
        });
        return;
      }

      // Create forced release record
      const releaseTime = new Date();
      const forceReason = reason || "Admin force release";

      await storage.releaseStudentFromPreviousLocation(
        studentId,
        new Date(releaseTime.getTime() + 1000), // Ensure it's "newer" than current location
        forceReason
      );

      res.json({
        success: true,
        data: {
          releasedFrom: activeLocation.type,
          releaseTime,
          reason: forceReason,
        },
      });
    } catch (error) {
      console.error("Admin force release error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to force release student",
      });
    }
  });

  app.get("/api/admin/me", async (req, res) => {
    try {
      const adminId = req.session.adminId;

      if (!adminId) {
        res.status(401).json({
          success: false,
          error: "Not authenticated",
        });
        return;
      }

      const admin = await storage.getAdminById(adminId);

      if (!admin) {
        res.status(401).json({
          success: false,
          error: "Admin not found",
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: admin.id,
          username: admin.username,
        },
      });
    } catch (error) {
      console.error("Fetch admin error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch admin data",
      });
    }
  });

  app.get("/api/admin/dashboard/stats", async (req, res) => {
    try {
      const adminId = req.session.adminId;
      if (!adminId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const stats = await storage.getDashboardStats();
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/admin/dashboard/active-students", async (req, res) => {
    try {
      const adminId = req.session.adminId;
      if (!adminId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const activeStudents = await storage.getActiveStudents();
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json({ success: true, data: activeStudents });
    } catch (error) {
      console.error("Active students error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch active students" });
    }
  });

  app.get("/api/admin/dashboard/recent-activity", async (req, res) => {
    try {
      const adminId = req.session.adminId;
      if (!adminId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const activity = await storage.getRecentActivity(limit);
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json({ success: true, data: activity });
    } catch (error) {
      console.error("Recent activity error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch recent activity" });
    }
  });

  app.get("/api/admin/student/:studentId/scans", async (req, res) => {
    try {
      const adminId = req.session.adminId;
      if (!adminId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const { studentId } = req.params;
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const scans = await storage.getStudentAllScans(studentId, start, end);
      res.json({ success: true, data: scans });
    } catch (error) {
      console.error("Student scans error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch student scans" });
    }
  });

  // Special needs access endpoints
  app.post("/api/students/:studentId/special-needs/view", async (req, res) => {
    try {
      const { studentId } = req.params;
      const { viewerName, viewerRole, viewerContext } = req.body;

      if (!viewerName || !viewerRole) {
        res.status(400).json({
          success: false,
          error: "Viewer name and role are required",
        });
        return;
      }

      const studentData = await storage.getStudentSpecialNeeds(studentId);
      
      if (!studentData) {
        res.status(404).json({
          success: false,
          error: "Student not found",
        });
        return;
      }

      await storage.logSpecialNeedsAccess({
        studentId,
        viewerName,
        viewerRole,
        viewerContext: viewerContext || null,
      });

      res.json({
        success: true,
        data: studentData,
      });
    } catch (error) {
      console.error("Special needs view error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve special needs",
      });
    }
  });

  await storage.seedSuperAdmin();

  registerObjectStorageRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
